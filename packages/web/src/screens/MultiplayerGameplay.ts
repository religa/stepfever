import { loadChart } from "@stepfever/core";
import { PauseMenuController } from "../engine/PauseMenuController";
import { MultiplayerEngine } from "../multiplayer/MultiplayerEngine";
import type { PlayerResult } from "../multiplayer/PlayerState";
import { type MultiplayerConfig, useAppStore } from "../stores/appStore";
import type { Screen } from "./ScreenManager";

export class MultiplayerGameplayScreen implements Screen {
	private container: HTMLElement | null = null;
	private gameContainer: HTMLElement | null = null;
	private engine: MultiplayerEngine | null = null;
	private onNavigate: (screen: string, data?: unknown, replace?: boolean) => void;
	private isMounted = false;
	private config: MultiplayerConfig;
	private handleResize: (() => void) | null = null;
	private handleKeydown: ((e: KeyboardEvent) => void) | null = null;
	private pauseMenu: PauseMenuController | null = null;

	constructor(onNavigate: (screen: string, data?: unknown, replace?: boolean) => void, config: MultiplayerConfig) {
		this.onNavigate = onNavigate;
		this.config = config;
	}

	async mount(container: HTMLElement): Promise<void> {
		this.isMounted = true;
		this.container = container;

		const { selectedSong, selectedDifficulty, globalOffset, speedModifier } = useAppStore.getState();

		if (!selectedSong || !selectedDifficulty) {
			alert("No song selected!");
			this.onNavigate("song-select");
			return;
		}

		// Create game container for multiplayer canvases (fullscreen)
		this.gameContainer = document.createElement("div");
		this.gameContainer.id = "game-container";
		this.gameContainer.style.position = "absolute";
		this.gameContainer.style.top = "0";
		this.gameContainer.style.left = "0";
		this.gameContainer.style.width = "100%";
		this.gameContainer.style.height = "100%";
		this.gameContainer.style.backgroundColor = "transparent";
		container.appendChild(this.gameContainer);

		// Create pause menu controller
		this.pauseMenu = new PauseMenuController(container, {
			onRestart: () => this.restartGame(),
			onQuit: () => this.quitGame(),
		});

		// Setup resize handler
		this.handleResize = () => {
			if (!this.engine) return;
			this.engine.resize(window.innerWidth, window.innerHeight);
		};
		window.addEventListener("resize", this.handleResize);

		// Setup keyboard handler for Escape key and pause menu
		// Use capture phase to ensure it fires before InputHandler listeners
		this.handleKeydown = (e: KeyboardEvent) => {
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
		};
		window.addEventListener("keydown", this.handleKeydown, true); // true = capture phase

		try {
			// Load chart from the difficulty's chart path
			const chartPath = selectedDifficulty.chartPath;
			const response = await fetch(chartPath);
			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${response.statusText}`);
			}
			const chartData = await response.text();
			if (!this.isMounted) return;

			const chart = await loadChart(chartData, chartPath);
			if (!this.isMounted) return;

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

			// Create multiplayer engine with window dimensions
			this.engine = new MultiplayerEngine(
				this.gameContainer,
				{
					playerCount: this.config.playerCount,
					controllers: this.config.controllers,
					gamepadAssignments: this.config.gamepadAssignments,
					gamepadConfig: this.config.gamepadConfig ?? null,
					chart,
					difficulty: chartDifficulty,
					audioFile,
					globalOffset,
					speedModifier,
					songName: selectedSong.title,
					...(speedModifierText ? { speedModifierText } : {}),
				},
				window.innerWidth,
				window.innerHeight,
			);

			// Connect pause menu to engine
			this.pauseMenu.setEngine(this.engine);

			this.engine.setOnComplete((results: PlayerResult[]) => {
				// Use replace=true so back button goes to song-select, not back to gameplay
				this.onNavigate("multiplayer-results", results, true);
			});

			// Start game
			await this.engine.start();
		} catch (error) {
			if (!this.isMounted) return; // Critical: Don't navigate if already unmounted
			console.error("Failed to start multiplayer game:", error);

			// Differentiate error types for better UX
			let alertMessage = "Failed to start multiplayer game";

			if (error instanceof TypeError && error.message.includes("fetch")) {
				// Network/fetch errors
				alertMessage = "Network error: Could not fetch chart file";
			} else if (error instanceof Error) {
				// Check for chart parsing errors (from loadChart)
				if (error.message.includes("parse") || error.message.includes("format") || error.message.includes("invalid")) {
					alertMessage = `Invalid chart format: ${error.message}`;
				} else if (error.message.includes("Difficulty not found")) {
					alertMessage = "Selected difficulty not found in chart";
				} else if (error.message.includes("HTTP")) {
					// HTTP errors from fetch
					alertMessage = `Network error: ${error.message}`;
				} else {
					// Generic error with message
					alertMessage = `Failed to start multiplayer game: ${error.message}`;
				}
			}

			alert(alertMessage);
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
		if (this.engine) {
			this.engine.stop();
			this.engine = null;
		}

		// Reset pause menu state
		this.pauseMenu?.reset();

		// Navigate to song select
		this.onNavigate("song-select");
	}

	unmount(): void {
		this.isMounted = false;

		// Cleanup resize handler
		if (this.handleResize) {
			window.removeEventListener("resize", this.handleResize);
			this.handleResize = null;
		}

		// Cleanup keyboard handler
		if (this.handleKeydown) {
			window.removeEventListener("keydown", this.handleKeydown, true); // true = capture phase
			this.handleKeydown = null;
		}

		// Cleanup pause menu
		this.pauseMenu?.dispose();
		this.pauseMenu = null;

		// Always try to stop the engine if it exists (even if escape handler already ran)
		if (this.engine) {
			try {
				this.engine.stop();
			} catch (error) {
				console.error("Error stopping engine in unmount:", error);
			}
			this.engine = null;
			// NOTE: Do NOT clear multiplayer config here - it breaks retry/back
			// Config is cleared when navigating to main-menu instead
		}

		if (this.container) {
			this.container.innerHTML = "";
		}
	}
}
