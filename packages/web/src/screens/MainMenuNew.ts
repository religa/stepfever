import { menuAudio } from "../audio/MenuAudio";
import { useAppStore } from "../stores/appStore";
import { escapeHtml } from "../utils/html";
import { getMenuAction } from "../utils/input";
import type { Screen } from "./ScreenManager";

export class MainMenuScreen implements Screen {
	private container: HTMLElement | null = null;
	private onNavigate: (screen: string) => void;
	private keyHandler: ((e: KeyboardEvent) => void) | null = null;
	private selectedIndex = 0;
	private readonly menuItems = ["play", "multiplayer", "recent-scores", "options"];

	constructor(onNavigate: (screen: string) => void) {
		this.onNavigate = onNavigate;
	}

	mount(container: HTMLElement): void {
		this.container = container;
		this.render();
		this.attachEventListeners();
		this.attachKeyboardListeners();
		// Initialize menu audio on first user interaction (browser autoplay policy)
		menuAudio.init().catch(() => {});
	}

	unmount(): void {
		if (this.keyHandler) {
			window.removeEventListener("keydown", this.keyHandler);
			this.keyHandler = null;
		}
		if (this.container) {
			this.container.innerHTML = "";
		}
	}

	private render(): void {
		if (!this.container) return;

		const playerName = useAppStore.getState().playerName;

		this.container.innerHTML = `
      <div class="main-menu">
        <div class="logo">
          <h1>StepFever</h1>
          <p class="version">v0.1.0</p>
        </div>

        <div class="menu-items">
          <button id="btn-play" class="menu-button ${this.selectedIndex === 0 ? "selected" : ""}">Play</button>
          <button id="btn-multiplayer" class="menu-button ${this.selectedIndex === 1 ? "selected" : ""}">Multiplayer</button>
          <button id="btn-recent-scores" class="menu-button ${this.selectedIndex === 2 ? "selected" : ""}">Recent Scores</button>
          <button id="btn-options" class="menu-button ${this.selectedIndex === 3 ? "selected" : ""}">Options</button>
        </div>

        <div class="player-info">
          ${
						playerName
							? `
            <p>Player: <strong>${escapeHtml(playerName)}</strong></p>
            <button id="btn-change-name" class="text-button">Change Name</button>
          `
							: `
            <button id="btn-set-name" class="menu-button">Set Player Name</button>
          `
					}
        </div>

        <div class="footer">
          <p>Arrow Keys or DFJK to play • ESC to return</p>
        </div>
      </div>
    `;
	}

	private attachEventListeners(): void {
		document.getElementById("btn-play")?.addEventListener("click", () => {
			menuAudio.playSelect();
			// CRITICAL: Clear multiplayer config to prevent mode leakage
			useAppStore.getState().setMultiplayerConfig(null);
			this.onNavigate("song-select");
		});

		document.getElementById("btn-multiplayer")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.onNavigate("player-setup");
		});

		document.getElementById("btn-recent-scores")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.onNavigate("recent-scores");
		});

		document.getElementById("btn-options")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.onNavigate("options");
		});

		document.getElementById("btn-set-name")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.promptForName();
		});

		document.getElementById("btn-change-name")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.promptForName();
		});
	}

	private promptForName(): void {
		const name = prompt("Enter your player name:");
		if (name?.trim()) {
			const trimmed = name.trim();
			// Validate length: 1-50 characters
			if (trimmed.length > 50) {
				alert("Player name must be 50 characters or less.");
				return;
			}
			useAppStore.getState().setPlayerName(trimmed);
			this.render();
			this.attachEventListeners();
		}
	}

	private attachKeyboardListeners(): void {
		this.keyHandler = (e: KeyboardEvent) => {
			const action = getMenuAction(e.key);
			if (!action) return;

			e.preventDefault();
			switch (action) {
				case "UP":
					this.selectedIndex = (this.selectedIndex - 1 + this.menuItems.length) % this.menuItems.length;
					menuAudio.playNavigate();
					this.render();
					this.attachEventListeners();
					break;
				case "DOWN":
					this.selectedIndex = (this.selectedIndex + 1) % this.menuItems.length;
					menuAudio.playNavigate();
					this.render();
					this.attachEventListeners();
					break;
				case "CONFIRM":
					menuAudio.playSelect();
					this.selectCurrentItem();
					break;
				// No BACK case needed for MainMenu (it's the root)
			}
		};
		window.addEventListener("keydown", this.keyHandler);
	}

	private selectCurrentItem(): void {
		const item = this.menuItems[this.selectedIndex];
		switch (item) {
			case "play":
				useAppStore.getState().setMultiplayerConfig(null);
				this.onNavigate("song-select");
				break;
			case "multiplayer":
				this.onNavigate("player-setup");
				break;
			case "recent-scores":
				this.onNavigate("recent-scores");
				break;
			case "options":
				this.onNavigate("options");
				break;
		}
	}
}
