import "./styles/screens.css";
import type { PlayerResult } from "./multiplayer/PlayerState";
import { Router, isMultiplayerRoute } from "./router";
import { CalibrationScreen } from "./screens/CalibrationNew";
import { GamepadSettingsScreen } from "./screens/GamepadSettings";
import { GameplayScreen } from "./screens/GameplayNew";
import { MainMenuScreen } from "./screens/MainMenuNew";
import { MultiplayerGameplayScreen } from "./screens/MultiplayerGameplay";
import { MultiplayerResultsScreen } from "./screens/MultiplayerResults";
import { PlayerSetup } from "./screens/PlayerSetup";
import { RecentScoresScreen } from "./screens/RecentScores";
import { ResultsScreen } from "./screens/ResultsNew";
import { ScreenManager } from "./screens/ScreenManager";
import { SettingsScreen } from "./screens/SettingsNew";
import { SongSelectScreen } from "./screens/SongSelectNew";
import { SpeedModSelectScreen } from "./screens/SpeedModSelect";
import { type MultiplayerConfig, useAppStore } from "./stores/appStore";
import { usePreferences } from "./stores/preferencesStore";
import { applyBackground, loadBackgrounds } from "./utils/background";

/**
 * Main application entry point
 * Manages screen navigation and application lifecycle
 */
class App {
	private screenManager: ScreenManager;
	private container: HTMLElement;
	private router: Router;

	constructor(container: HTMLElement) {
		this.container = container;
		this.screenManager = new ScreenManager(container);
		this.router = new Router((screen, data) => this.handleNavigation(screen, data));
		this.router.handleRoute(); // Initial route on startup
	}

	/**
	 * Public navigation API for screens
	 * Updates browser URL and navigates to the screen
	 */
	public navigateTo(screenName: string, data?: unknown, replace = false): void {
		const isMulti = isMultiplayerRoute() || useAppStore.getState().multiplayerConfig !== null;
		const path = this.router.getPath(screenName, isMulti);
		this.router.navigate(path, data, replace);
	}

	/**
	 * Internal navigation handler - called by Router
	 */
	private handleNavigation(screenName: string, data?: unknown): void {
		switch (screenName) {
			case "main-menu":
				// Clear multiplayer config when returning to main menu to prevent mode leakage
				useAppStore.getState().setMultiplayerConfig(null);
				this.screenManager.navigateTo(new MainMenuScreen(this.navigateTo.bind(this)));
				break;

			case "song-select":
				this.screenManager.navigateTo(new SongSelectScreen(this.navigateTo.bind(this)));
				break;

			case "player-setup":
				this.screenManager.navigateTo(
					new PlayerSetup({
						onStart: (controllers, gamepadAssignments) => {
							// Store config in Zustand (in-memory)
							useAppStore.getState().setMultiplayerConfig({
								playerCount: controllers.length,
								controllers: controllers,
								gamepadAssignments: gamepadAssignments,
								gamepadConfig: usePreferences.getState().gamepadConfig,
							});
							this.navigateTo("song-select");
						},
						onBack: () => {
							// Clear config when canceling
							useAppStore.getState().setMultiplayerConfig(null);
							this.navigateTo("main-menu");
						},
					}),
				);
				break;

			case "gameplay":
				this.screenManager.navigateTo(new GameplayScreen(this.navigateTo.bind(this)));
				break;

			case "multiplayer-gameplay": {
				const config = useAppStore.getState().multiplayerConfig;
				if (!config) {
					console.error("Multiplayer gameplay requires config");
					alert("Multiplayer configuration not found. Returning to main menu.");
					this.navigateTo("main-menu");
					return;
				}
				this.screenManager.navigateTo(new MultiplayerGameplayScreen(this.navigateTo.bind(this), config));
				break;
			}

			case "results":
				if (!data) {
					console.error("Results screen requires score data");
					this.navigateTo("main-menu");
					return;
				}
				// biome-ignore lint/suspicious/noExplicitAny: data type validated by caller
				this.screenManager.navigateTo(new ResultsScreen(data as any, this.navigateTo.bind(this)));
				break;

			case "multiplayer-results": {
				if (!data) {
					console.error("Multiplayer results require player data");
					this.navigateTo("main-menu");
					return;
				}

				// Validate data type
				const results = data as PlayerResult[];
				if (!Array.isArray(results) || results.length === 0) {
					console.error("Invalid multiplayer results data");
					this.navigateTo("main-menu");
					return;
				}

				this.screenManager.navigateTo(
					new MultiplayerResultsScreen(results, {
						onContinue: () => {
							// Clear multiplayer config when returning to menu
							useAppStore.getState().setMultiplayerConfig(null);
							this.navigateTo("main-menu");
						},
						onRetry: () => {
							// Preserve config for retry
							this.navigateTo("player-setup");
						},
					}),
				);
				break;
			}

			case "calibration":
				this.screenManager.navigateTo(new CalibrationScreen(this.navigateTo.bind(this)));
				break;

			case "options":
			case "settings":
				this.screenManager.navigateTo(new SettingsScreen(this.navigateTo.bind(this)));
				break;

			case "recent-scores":
				this.screenManager.navigateTo(new RecentScoresScreen(this.navigateTo.bind(this)));
				break;

			case "speed-mod-select":
				this.screenManager.navigateTo(new SpeedModSelectScreen(this.navigateTo.bind(this)));
				break;

			case "gamepad-settings":
				this.screenManager.navigateTo(new GamepadSettingsScreen(this.navigateTo.bind(this)));
				break;

			default:
				console.warn(`Unknown screen: ${screenName}`);
				this.navigateTo("main-menu");
		}
	}
}

// Wait for DOM to be ready
async function init() {
	const container = document.getElementById("app");
	if (!container) {
		console.error("App container not found!");
		return;
	}

	// Load and apply background early (before clearing loading screen)
	try {
		const backgrounds = await loadBackgrounds();
		const selectedBg = usePreferences.getState().background;
		applyBackground(selectedBg, backgrounds);
	} catch (error) {
		console.warn("Failed to load backgrounds:", error);
	}

	// Clear loading screen
	container.innerHTML = "";

	// Start the app
	new App(container);
}

// Initialize when DOM is ready
if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", init);
} else {
	init();
}
