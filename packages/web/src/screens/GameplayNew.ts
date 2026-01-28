import { loadChart } from "@stepfever/core";
import type { FinalScore } from "@stepfever/core";
import { GameEngine } from "../engine/GameEngine";
import { PauseMenuController } from "../engine/PauseMenuController";
import { LayoutManager } from "../multiplayer/LayoutManager";
import { useAppStore } from "../stores/appStore";
import { EventRegistry } from "../utils/EventRegistry";
import type { Screen } from "./ScreenManager";

export class GameplayScreen implements Screen {
	private container: HTMLElement | null = null;
	private canvas: HTMLCanvasElement | null = null;
	private gameEngine: GameEngine | null = null;
	private layoutManager: LayoutManager | null = null;
	private onNavigate: (screen: string, data?: unknown, replace?: boolean) => void;
	private isMounted = false;
	private mountId = 0;
	private events = new EventRegistry();
	private pauseMenu: PauseMenuController | null = null;

	constructor(onNavigate: (screen: string, data?: unknown, replace?: boolean) => void) {
		this.onNavigate = onNavigate;
	}

	async mount(container: HTMLElement): Promise<void> {
		this.isMounted = true;
		const currentMountId = ++this.mountId;
		this.container = container;

		const { selectedSong, selectedDifficulty, globalOffset, showFps, speedModifier } = useAppStore.getState();

		if (!selectedSong || !selectedDifficulty) {
			alert("No song selected!");
			this.onNavigate("song-select");
			return;
		}

		// Create pause menu controller
		this.pauseMenu = new PauseMenuController(container, {
			onRestart: () => this.restartGame(),
			onQuit: () => this.quitGame(),
		});

		// Setup keyboard handler for Escape key and pause menu
		// Use capture phase to ensure it fires before InputHandler listeners
		this.events.on(
			window,
			"keydown",
			(e: KeyboardEvent) => {
				// Let pause menu handle its keys first
				if (this.pauseMenu?.handleKeydown(e)) {
					e.preventDefault();
					e.stopImmediatePropagation();
					return;
				}

				// Handle Escape when not paused - toggle pause menu
				if (e.key === "Escape") {
					e.preventDefault();
					e.stopImmediatePropagation();
					this.pauseMenu?.toggle();
				}
			},
			true,
		); // true = capture phase

		// Create canvas with window dimensions
		this.canvas = document.createElement("canvas");
		this.canvas.id = "game-canvas";
		this.canvas.width = window.innerWidth;
		this.canvas.height = window.innerHeight;
		container.appendChild(this.canvas);

		// Create layout manager for single player
		this.layoutManager = new LayoutManager(this.canvas.width, this.canvas.height);
		const viewports = this.layoutManager.calculateViewports(1);
		const viewport = viewports[0];

		if (!viewport) {
			throw new Error("Failed to calculate viewport for single player");
		}

		// Setup resize handler
		this.events.on(window, "resize", () => {
			if (!this.canvas || !this.gameEngine || !this.layoutManager) return;

			// Update canvas dimensions
			this.canvas.width = window.innerWidth;
			this.canvas.height = window.innerHeight;

			// Update layout
			this.layoutManager.setCanvasSize(this.canvas.width, this.canvas.height);
			const newViewport = this.layoutManager.calculateViewports(1)[0];

			// Update engine viewport
			if (newViewport) {
				this.gameEngine.setViewport(newViewport);
			}
		});

		try {
			// Load chart from the difficulty's chart path
			const chartPath = selectedDifficulty.chartPath;
			const chartData = await fetch(chartPath).then((r) => r.text());
			if (!this.isMounted || this.mountId !== currentMountId) return;

			const chart = await loadChart(chartData, chartPath);
			if (!this.isMounted || this.mountId !== currentMountId) return;

			// Find the selected difficulty in the chart
			const chartDifficulty = chart.difficulties.find((d) => d.name === selectedDifficulty.name);

			if (!chartDifficulty) {
				throw new Error("Difficulty not found in chart");
			}

			// Derive audio file path from chart path (same directory)
			const chartDir = chartPath.substring(0, chartPath.lastIndexOf("/"));
			// Decode URL to avoid double-encoding issues in Safari's WebAudio
			const audioFile = decodeURIComponent(selectedSong.audioFile ?? `${chartDir}/${chart.metadata.music}`);

			// Format speed modifier text (only show if not 1.0x)
			let speedModifierText: string | undefined;
			if (speedModifier) {
				if (speedModifier.type === "xmod" && speedModifier.multiplier !== 1.0) {
					speedModifierText = `${speedModifier.multiplier.toFixed(2)}x`;
				} else if (speedModifier.type === "cmod") {
					speedModifierText = `C${speedModifier.pixelsPerSecond}`;
				}
			}

			// Create game engine
			this.gameEngine = new GameEngine(this.canvas, chart, chartDifficulty, audioFile, globalOffset, {
				showFps,
				speedModifier,
				rendererOptions: {
					viewport,
					songName: selectedSong.title,
					...(speedModifierText ? { speedModifierText } : {}),
				},
			});

			// Connect pause menu to engine
			this.pauseMenu.setEngine(this.gameEngine);

			this.gameEngine.setOnComplete((score: FinalScore) => {
				// Use replace=true so back button goes to song-select, not back to gameplay
				this.onNavigate("results", score, true);
			});

			// Start game
			await this.gameEngine.start();
		} catch (error) {
			if (!this.isMounted || this.mountId !== currentMountId) return;
			console.error("Failed to start game:", error);
			alert("Failed to start game. See console for details.");
			this.onNavigate("song-select");
		}
	}

	private async restartGame(): Promise<void> {
		const container = this.container;
		if (!container) return;

		// Use unmount to ensure full cleanup (listeners, engine, etc.)
		this.unmount();

		// Re-mount to restart
		await this.mount(container);
	}

	private quitGame(): void {
		// Stop game engine
		if (this.gameEngine) {
			this.gameEngine.stop();
			this.gameEngine = null;
		}

		// Reset pause menu state
		this.pauseMenu?.reset();

		// Navigate to song select
		this.onNavigate("song-select");
	}

	unmount(): void {
		this.isMounted = false;

		// Cleanup all event listeners
		this.events.dispose();

		// Cleanup pause menu
		this.pauseMenu?.dispose();
		this.pauseMenu = null;

		if (this.gameEngine) {
			this.gameEngine.stop();
			this.gameEngine = null;
		}

		this.layoutManager = null;

		if (this.container) {
			this.container.innerHTML = "";
		}
	}
}
