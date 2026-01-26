import type { Chart, ChartDifficulty, ControllerConfig, SpeedModifier } from "@stepfever/core";
import { AudioPlayer } from "../engine/AudioPlayer";
import { BrowserConductor } from "../engine/Conductor";
import { InputManager } from "../engine/InputManager";
import { Renderer } from "../engine/Renderer";
import { calculateBeatsAhead } from "../engine/visibility";
import type { GamepadConfig } from "../stores/preferencesStore";
import { LayoutManager } from "./LayoutManager";
import { type PlayerResult, type PlayerState, toPlayerResult } from "./PlayerState";

interface MultiplayerEngineConfig {
	playerCount: number;
	controllers: ControllerConfig[];
	gamepadAssignments: (number | null)[]; // Gamepad index per player (null = keyboard-only)
	gamepadConfig?: GamepadConfig | null; // Shared gamepad config from preferences
	chart: Chart;
	difficulty: ChartDifficulty;
	audioFile: string;
	globalOffset: number;
	speedModifier?: SpeedModifier | null;
	songOffset?: number;
	songName?: string;
	speedModifierText?: string;
}

export class MultiplayerEngine {
	private container: HTMLElement;
	private canvases: HTMLCanvasElement[] = [];
	private config: MultiplayerEngineConfig;
	private players: PlayerState[] = [];
	private audioPlayer: AudioPlayer | null = null;
	private layoutManager: LayoutManager;
	private animationFrameId: number | null = null;
	private onComplete: ((results: PlayerResult[]) => void) | null = null;
	private lastFrameTime: number | null = null;
	private isStopped = false;
	private isPaused = false;

	constructor(container: HTMLElement, config: MultiplayerEngineConfig, width: number, height: number) {
		this.container = container;
		this.config = config;
		// Use dynamic resolution for layout calculations
		this.layoutManager = new LayoutManager(width, height);

		if (config.playerCount !== config.controllers.length) {
			throw new Error("Player count must match controller count");
		}
	}

	resize(width: number, height: number): void {
		this.layoutManager.setCanvasSize(width, height);
		const viewports = this.layoutManager.calculateViewports(this.config.playerCount);

		for (let i = 0; i < this.players.length; i++) {
			const player = this.players[i];
			const viewport = viewports[i];
			const canvas = this.canvases[i];

			if (viewport && canvas && player) {
				// Update canvas dimensions and position
				canvas.width = viewport.width;
				canvas.height = viewport.height;
				canvas.style.left = `${viewport.x}px`;
				canvas.style.top = `${viewport.y}px`;

				// Update renderer viewport
				player.renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
			}
		}
	}

	async start(): Promise<void> {
		try {
			// Create shared audio player
			this.audioPlayer = new AudioPlayer(this.config.audioFile);
			await this.audioPlayer.load();

			// Calculate viewports (all vertical splits)
			const viewports = this.layoutManager.calculateViewports(this.config.playerCount);

			// Create player instances
			for (let i = 0; i < this.config.playerCount; i++) {
				const viewport = viewports[i];
				if (!viewport) {
					throw new Error(`Viewport ${i} not found`);
				}
				const controller = this.config.controllers[i];
				if (!controller) {
					throw new Error(`Controller ${i} not found`);
				}

				// Create dedicated canvas for this player
				const canvas = document.createElement("canvas");
				canvas.width = viewport.width;
				canvas.height = viewport.height;

				// Position canvas based on layout
				canvas.style.position = "absolute";
				canvas.style.left = `${viewport.x}px`;
				canvas.style.top = `${viewport.y}px`;

				this.container.appendChild(canvas);
				this.canvases.push(canvas);

				// Track resources for cleanup on partial failure
				let renderer: Renderer | null = null;
				let conductor: BrowserConductor | null = null;
				let inputManager: InputManager | null = null;

				try {
					// Create renderer for this player's viewport
					renderer = new Renderer(canvas, {
						viewport,
						playerId: i,
						...(this.config.songName ? { songName: this.config.songName } : {}),
						...(this.config.speedModifierText ? { speedModifierText: this.config.speedModifierText } : {}),
					});
					await renderer.init();

					// Create conductor with shared audio time
					conductor = new BrowserConductor(
						this.config.chart,
						this.config.difficulty,
						this.config.globalOffset,
						this.config.speedModifier ?? null,
						this.config.songOffset ?? 0,
					);

					// Create input manager (keyboard + optional gamepad)
					const gamepadIndex = this.config.gamepadAssignments[i];
					const gamepadConfig = gamepadIndex !== null ? this.config.gamepadConfig : undefined;
					inputManager = new InputManager(controller, gamepadConfig, gamepadIndex ?? undefined);
					inputManager.onPress = (column: number) => {
						conductor!.handleInput(column);
						renderer!.setColumnPressed(column, true);
					};
					// Wire up release for lift notes
					inputManager.onRelease = (column: number) => {
						conductor!.handleRelease(column);
						renderer!.setColumnPressed(column, false);
					};

					// Setup conductor callbacks
					conductor.onJudgment = (result) => {
						renderer!.showJudgment(result);
					};

					conductor.onComboChange = (combo) => {
						renderer!.updateCombo(combo);
					};

					// Start conductor
					conductor.start();

					this.players.push({
						playerId: i,
						controller,
						conductor,
						renderer,
						inputManager,
						score: null,
						isFinished: false,
						rank: 0,
					});
				} catch (playerError) {
					// Clean up partially created resources for this player
					renderer?.destroy();
					try {
						conductor?.stop();
					} catch {}
					inputManager?.destroy();
					throw playerError;
				}
			}

			// Start audio playback
			this.audioPlayer.play();

			// Initialize frame time tracking
			this.lastFrameTime = performance.now();

			// Start game loop
			this.gameLoop();
		} catch (error) {
			// Clean up partially created resources on failure
			this.stop();
			throw error;
		}
	}

	private gameLoop = (): void => {
		// Exit early if paused
		if (this.isPaused) return;

		// Calculate visual delta for smooth interpolation
		const now = performance.now();
		const visualDelta = this.lastFrameTime !== null ? (now - this.lastFrameTime) / 1000 : 0;
		this.lastFrameTime = now;

		// Update all players
		let allFinished = true;

		for (const player of this.players) {
			if (!player.isFinished) {
				player.conductor.update(visualDelta);

				// Update renderer scroll speed based on current BPM and speed modifier
				const scrollSpeed = player.conductor.getScrollSpeed();
				const bpm = player.conductor.getCurrentBpm();
				player.renderer.updateScrollSpeed(scrollSpeed, bpm);

				// Update progress bar
				player.renderer.updateProgress(player.conductor.getProgress());

				// Calculate dynamic look-ahead based on viewport height and scroll speed
				const beatsAhead = calculateBeatsAhead({
					viewportHeight: player.renderer.getViewportHeight(),
					scrollSpeed,
					bpm,
				});

				player.renderer.render(
					player.conductor.getVisibleNotes(beatsAhead, 1),
					player.conductor.getCurrentBeat(),
					player.conductor.getCombo(),
					player.conductor.getAccuracy(),
				);

				// Check if player finished
				if (player.conductor.isComplete()) {
					player.score = player.conductor.finalize();
					player.isFinished = true;
				} else {
					allFinished = false;
				}
			}
		}

		// Continue loop or finish
		if (!allFinished) {
			this.animationFrameId = requestAnimationFrame(this.gameLoop);
		} else {
			this.finish();
		}
	};

	private finish(): void {
		// Calculate rankings (use spread to avoid mutating original array)
		const sortedPlayers = [...this.players].sort((a, b) => {
			const aAcc = a.score?.accuracy || 0;
			const bAcc = b.score?.accuracy || 0;
			return bAcc - aAcc;
		});

		for (let i = 0; i < sortedPlayers.length; i++) {
			const player = sortedPlayers[i];
			if (player) {
				player.rank = i + 1;
			}
		}

		// Convert to serializable results before stopping (stop() clears this.players)
		// PlayerResult only contains data that can be serialized by history.replaceState()
		const results = this.players.map(toPlayerResult);

		// Stop the engine (audio, animation loop, etc.)
		this.stop();

		// Trigger completion callback with serializable results
		this.onComplete?.(results);
	}

	setOnComplete(callback: (results: PlayerResult[]) => void): void {
		this.onComplete = callback;
	}

	pause(): void {
		if (this.isPaused || this.isStopped) return;
		this.isPaused = true;

		// Cancel animation frame
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}

		// Pause audio
		this.audioPlayer?.pause();

		// Pause all player conductors
		for (const player of this.players) {
			player.conductor.pause();
		}
	}

	resume(): void {
		if (!this.isPaused || this.isStopped) return;
		this.isPaused = false;

		// Resume audio
		this.audioPlayer?.resume();

		// Resume all player conductors
		for (const player of this.players) {
			player.conductor.resume();
		}

		// Reset frame time and restart game loop
		this.lastFrameTime = performance.now();
		this.gameLoop();
	}

	isPausedState(): boolean {
		return this.isPaused;
	}

	stop(): void {
		// Prevent double stops
		if (this.isStopped) {
			return;
		}
		this.isStopped = true;

		// Stop animation loop
		if (this.animationFrameId !== null) {
			cancelAnimationFrame(this.animationFrameId);
			this.animationFrameId = null;
		}

		// Cleanup all players
		for (const player of this.players) {
			try {
				player.conductor.stop();
			} catch (error) {
				console.error("Error stopping conductor:", error);
			}
			// Dispose conductor if it has a dispose method (prevents resource leaks)
			// biome-ignore lint/suspicious/noExplicitAny: runtime check for optional dispose method
			if (typeof (player.conductor as any).dispose === "function") {
				try {
					// biome-ignore lint/suspicious/noExplicitAny: runtime check for optional dispose method
					(player.conductor as any).dispose();
				} catch (error) {
					console.error("Error disposing conductor:", error);
				}
			}
			try {
				player.inputManager.destroy();
			} catch (error) {
				console.error("Error destroying input manager:", error);
			}
			try {
				player.renderer.destroy();
			} catch (error) {
				console.error("Error destroying renderer:", error);
			}
		}

		// Cleanup audio - this is critical for stopping the song
		if (this.audioPlayer) {
			try {
				this.audioPlayer.stop();
			} catch (stopError) {
				console.error("Error stopping audio:", stopError);
			}
			try {
				this.audioPlayer.dispose();
			} catch (disposeError) {
				console.error("Error disposing audio:", disposeError);
			}
			this.audioPlayer = null;
		}

		// Cleanup canvases
		for (const canvas of this.canvases) {
			canvas.remove();
		}
		this.canvases = [];

		// Reset frame time tracking
		this.lastFrameTime = null;
		this.players = [];
	}

	destroy(): void {
		this.stop();
		this.onComplete = null;
	}
}
