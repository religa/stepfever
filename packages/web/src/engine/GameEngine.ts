import type { Chart, ChartDifficulty, FinalScore, SpeedModifier } from "@stepfever/core";
import { CONTROLLER_PRESETS } from "@stepfever/core";
import type { GamepadConfig } from "../stores/preferencesStore";
import { FpsCounter } from "../utils/FpsCounter";
import { type PerformanceMetrics, PerformanceMonitor } from "../utils/PerformanceMonitor";
import { AudioPlayer } from "./AudioPlayer";
import { BrowserConductor } from "./Conductor";
import { InputManager } from "./InputManager";
import { Renderer, type RendererOptions } from "./Renderer";
import { calculateBeatsAhead } from "./visibility";

export interface GameEngineOptions {
	showFps?: boolean;
	showTimingDisplay?: boolean;
	showAudioLatency?: boolean;
	rendererOptions?: RendererOptions;
	speedModifier?: SpeedModifier | null;
	songOffset?: number;
	gamepadConfig?: GamepadConfig | null;
}

export class GameEngine {
	private conductor: BrowserConductor;
	private renderer: Renderer;
	private audioPlayer: AudioPlayer;
	private inputManager: InputManager;
	private performanceMonitor: PerformanceMonitor;
	private fpsCounter: FpsCounter | null = null;

	private isRunning = false;
	private isStopped = false;
	private isPaused = false;
	private lastFrameTime = 0;
	private rafId: number | null = null;
	private onComplete?: (score: FinalScore) => void;

	constructor(
		canvas: HTMLCanvasElement,
		chart: Chart,
		difficulty: ChartDifficulty,
		audioUrl: string,
		globalOffset = 0,
		options: GameEngineOptions = {},
	) {
		this.conductor = new BrowserConductor(
			chart,
			difficulty,
			globalOffset,
			options.speedModifier ?? null,
			options.songOffset ?? 0,
		);
		this.renderer = new Renderer(canvas, options.rendererOptions);
		this.audioPlayer = new AudioPlayer(audioUrl);

		// Validate that the arrows preset exists
		const arrowsPreset = CONTROLLER_PRESETS.arrows;
		if (!arrowsPreset) {
			throw new Error("Failed to load 'arrows' controller preset");
		}
		this.inputManager = new InputManager(arrowsPreset, options.gamepadConfig);

		// Setup performance monitoring
		this.performanceMonitor = new PerformanceMonitor();

		if (options.showFps) {
			this.fpsCounter = new FpsCounter(
				this.performanceMonitor,
				options.showTimingDisplay ?? false,
				options.showAudioLatency ?? false,
			);
		}

		// Wire up input (keyboard + gamepad)
		this.inputManager.onPress = (column) => {
			this.conductor.handleInput(column);
			this.renderer.setColumnPressed(column, true);
		};

		// Wire up release for lift notes
		this.inputManager.onRelease = (column) => {
			this.conductor.handleRelease(column);
			this.renderer.setColumnPressed(column, false);
		};

		// Wire up callbacks for UI updates
		this.conductor.onJudgment = (result) => {
			this.renderer.showJudgment(result);
			// Update FPS counter with timing error if available
			if (this.fpsCounter && result.timingError !== undefined) {
				this.fpsCounter.setTimingError(result.timingError);
			}
		};

		this.conductor.onComboChange = (combo) => {
			this.renderer.updateCombo(combo);
		};
	}

	async start(): Promise<void> {
		try {
			await this.audioPlayer.load();
			if (this.isStopped) return; // Check if stopped during load
			await this.renderer.init();
			// Check if stopped during init - destroy renderer to prevent resource leak
			if (this.isStopped) {
				try {
					this.renderer.destroy();
				} catch (error) {
					console.error("Error destroying renderer after stop during init:", error);
				}
				return;
			}
		} catch (e) {
			console.error("Failed to start game engine:", e);
			this.stop();
			throw e;
		}

		this.isRunning = true;
		this.lastFrameTime = performance.now();

		// Set audio latency once (doesn't change during playback)
		if (this.fpsCounter) {
			this.fpsCounter.setAudioLatency(this.audioPlayer.getOutputLatency());
		}

		// Start audio and conductor simultaneously
		this.audioPlayer.play();
		this.conductor.start();

		this.rafId = requestAnimationFrame(this.gameLoop);
	}

	stop(): void {
		if (this.isStopped) {
			return;
		}

		this.isStopped = true;
		this.isRunning = false;

		// Cancel any pending animation frame to prevent zombie loops
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}

		try {
			this.conductor.stop();
		} catch (error) {
			console.error("Error stopping conductor:", error);
		}

		try {
			this.audioPlayer.stop();
		} catch (error) {
			console.error("Error stopping audio:", error);
		}

		try {
			this.audioPlayer.dispose();
		} catch (error) {
			console.error("Error disposing audio:", error);
		}

		try {
			this.renderer.destroy();
		} catch (error) {
			console.error("Error destroying renderer:", error);
		}

		try {
			this.inputManager.destroy();
		} catch (error) {
			console.error("Error destroying input manager:", error);
		}

		if (this.fpsCounter) {
			try {
				this.fpsCounter.destroy();
			} catch (error) {
				console.error("Error destroying FPS counter:", error);
			}
			this.fpsCounter = null;
		}

		try {
			this.performanceMonitor.reset();
		} catch (error) {
			console.error("Error resetting performance monitor:", error);
		}
	}

	pause(): void {
		if (this.isPaused || !this.isRunning) return;
		this.isPaused = true;
		// Cancel pending rAF to prevent race condition on rapid pause/resume
		if (this.rafId !== null) {
			cancelAnimationFrame(this.rafId);
			this.rafId = null;
		}
		this.audioPlayer.pause();
		this.conductor.pause();
	}

	resume(): void {
		if (!this.isPaused || !this.isRunning) return;
		this.isPaused = false;
		this.audioPlayer.resume();
		this.conductor.resume();
		this.lastFrameTime = performance.now();
		this.rafId = requestAnimationFrame(this.gameLoop);
	}

	isPausedState(): boolean {
		return this.isPaused;
	}

	setOnComplete(callback: (score: FinalScore) => void): void {
		this.onComplete = callback;
	}

	setViewport(viewport: { x: number; y: number; width: number; height: number }): void {
		this.renderer.setViewport(viewport.x, viewport.y, viewport.width, viewport.height);
	}

	private gameLoop = (): void => {
		if (!this.isRunning || this.isPaused) return;

		this.performanceMonitor.startFrame();

		const now = performance.now();
		const visualDelta = (now - this.lastFrameTime) / 1000;
		this.lastFrameTime = now;

		// Update conductor (checks for misses)
		this.conductor.update(visualDelta);

		// Update renderer scroll speed based on current BPM and speed modifier
		const scrollSpeed = this.conductor.getScrollSpeed();
		const bpm = this.conductor.getCurrentBpm();
		this.renderer.updateScrollSpeed(scrollSpeed, bpm);

		// Calculate dynamic look-ahead based on viewport height and scroll speed
		const beatsAhead = calculateBeatsAhead({
			viewportHeight: this.renderer.getViewportHeight(),
			scrollSpeed,
			bpm,
		});

		// Update progress bar
		this.renderer.updateProgress(this.conductor.getProgress());

		// Render
		const visibleNotes = this.conductor.getVisibleNotes(beatsAhead, 1);
		this.renderer.render(
			visibleNotes,
			this.conductor.getCurrentBeat(),
			this.conductor.getCombo(),
			this.conductor.getAccuracy(),
		);

		this.performanceMonitor.endFrame();

		if (this.fpsCounter) {
			this.fpsCounter.update();
		}

		// Check completion
		if (this.conductor.isComplete()) {
			this.complete();
		} else {
			this.rafId = requestAnimationFrame(this.gameLoop);
		}
	};

	private complete(): void {
		this.stop();
		const score = this.conductor.finalize();
		this.onComplete?.(score);
	}

	getPerformanceMetrics(): PerformanceMetrics {
		return this.performanceMonitor.getMetrics();
	}
}
