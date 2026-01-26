import type { SpeedModifier } from "@stepfever/core";
import { menuAudio } from "../audio/MenuAudio";
import { useAppStore } from "../stores/appStore";
import { usePreferences } from "../stores/preferencesStore";
import { type BackgroundOption, applyBackground, loadBackgrounds } from "../utils/background";
import { escapeHtml } from "../utils/html";
import { getMenuAction } from "../utils/input";
import type { Screen } from "./ScreenManager";

export class SettingsScreen implements Screen {
	private container: HTMLElement | null = null;
	private onNavigate: (screen: string) => void;
	private handleKeydown: ((e: KeyboardEvent) => void) | null = null;
	private backgrounds: BackgroundOption[] = [];
	private isMounted = false;
	private selectedIndex = 0;
	private readonly settingsCount = 7; // FPS, Timing, Menu Sounds, Speed, Offset, Gamepad, Background

	constructor(onNavigate: (screen: string) => void) {
		this.onNavigate = onNavigate;
	}

	async mount(container: HTMLElement): Promise<void> {
		this.isMounted = true;
		this.container = container;

		// Load backgrounds first
		this.backgrounds = await loadBackgrounds();

		// Guard against unmount during async load
		if (!this.isMounted) return;

		this.render();
		this.attachEventListeners();

		// Setup keyboard handler once on mount
		this.handleKeydown = (e: KeyboardEvent) => {
			const action = getMenuAction(e.key);
			if (!action) return;

			e.preventDefault();
			switch (action) {
				case "UP":
					this.selectedIndex = (this.selectedIndex - 1 + this.settingsCount) % this.settingsCount;
					menuAudio.playNavigate();
					this.render();
					this.attachEventListeners();
					this.scrollSelectedIntoView();
					break;
				case "DOWN":
					this.selectedIndex = (this.selectedIndex + 1) % this.settingsCount;
					menuAudio.playNavigate();
					this.render();
					this.attachEventListeners();
					this.scrollSelectedIntoView();
					break;
				case "LEFT":
				case "RIGHT":
					this.handleHorizontalAction(action);
					break;
				case "CONFIRM":
					this.activateSelectedItem();
					break;
				case "BACK":
					menuAudio.playCancel();
					this.onNavigate("main-menu");
					break;
			}
		};
		window.addEventListener("keydown", this.handleKeydown);
	}

	unmount(): void {
		this.isMounted = false;

		// Cleanup keyboard handler
		if (this.handleKeydown) {
			window.removeEventListener("keydown", this.handleKeydown);
			this.handleKeydown = null;
		}

		if (this.container) {
			this.container.innerHTML = "";
		}
	}

	private render(): void {
		if (!this.container) return;

		const showFps = useAppStore.getState().showFps;
		const fpsStatus = showFps ? "ON" : "OFF";
		const fpsClass = showFps ? "toggle-on" : "toggle-off";

		const showTimingDisplay = useAppStore.getState().showTimingDisplay;
		const timingStatus = showTimingDisplay ? "ON" : "OFF";
		const timingClass = showTimingDisplay ? "toggle-on" : "toggle-off";

		const menuSounds = usePreferences.getState().menuSounds;
		const menuSoundsStatus = menuSounds ? "ON" : "OFF";
		const menuSoundsClass = menuSounds ? "toggle-on" : "toggle-off";

		const speedModifier = useAppStore.getState().speedModifier;
		const speedModText = this.getSpeedModText(speedModifier);

		const currentBackground = usePreferences.getState().background;
		const currentBgOption = this.backgrounds.find((bg) => bg.id === currentBackground);
		const currentBgName = currentBgOption?.name ?? "Default";

		this.container.innerHTML = `
      <div class="settings-screen">
        <div class="header">
          <h1>Settings</h1>
        </div>

        <div class="settings-list">
          <div class="setting-item ${this.selectedIndex === 0 ? "selected" : ""}">
            <div class="setting-label">
              <h3>FPS Counter</h3>
              <p>Display frames per second during gameplay</p>
            </div>
            <button id="btn-toggle-fps" class="toggle-button ${fpsClass}">
              ${fpsStatus}
            </button>
          </div>

          <div class="setting-item ${this.selectedIndex === 1 ? "selected" : ""}">
            <div class="setting-label">
              <h3>Timing Display</h3>
              <p>Show ms error on judgments (in FPS overlay)</p>
            </div>
            <button id="btn-toggle-timing" class="toggle-button ${timingClass}">
              ${timingStatus}
            </button>
          </div>

          <div class="setting-item ${this.selectedIndex === 2 ? "selected" : ""}">
            <div class="setting-label">
              <h3>Menu Sounds</h3>
              <p>Audio feedback for menu navigation</p>
            </div>
            <button id="btn-toggle-menu-sounds" class="toggle-button ${menuSoundsClass}">
              ${menuSoundsStatus}
            </button>
          </div>

          <div class="setting-item ${this.selectedIndex === 3 ? "selected" : ""}">
            <div class="setting-label">
              <h3>Speed Modifier</h3>
              <p>Current: ${escapeHtml(speedModText)}</p>
            </div>
            <button id="btn-speed-mod" class="menu-button">
              Change
            </button>
          </div>

          <div class="setting-item ${this.selectedIndex === 4 ? "selected" : ""}">
            <div class="setting-label">
              <h3>Global Offset</h3>
              <p>Current: ${(useAppStore.getState().globalOffset * 1000).toFixed(1)}ms</p>
            </div>
            <button id="btn-calibrate" class="menu-button">
              Calibrate
            </button>
          </div>

          <div class="setting-item ${this.selectedIndex === 5 ? "selected" : ""}">
            <div class="setting-label">
              <h3>Gamepad / Dance Pad</h3>
              <p>Configure button mappings for gamepads</p>
            </div>
            <button id="btn-gamepad" class="menu-button">
              Configure
            </button>
          </div>

          <div class="setting-item ${this.selectedIndex === 6 ? "selected" : ""}">
            <div class="setting-label">
              <h3>Background</h3>
              <p>Choose your visual backdrop</p>
            </div>
            <div class="setting-control cycler">
              <button class="arrow-btn" id="bg-prev">◄</button>
              <span class="value" id="bg-value">${escapeHtml(currentBgName)}</span>
              <button class="arrow-btn" id="bg-next">►</button>
            </div>
          </div>
        </div>

        <div class="footer">
          <button id="btn-back" class="menu-button">Back to Menu</button>
        </div>

        <div class="footer-info">
          <p>↑↓: Navigate • ←→: Adjust Background • ENTER: Activate • ESC: Back</p>
        </div>
      </div>
    `;
	}

	private getSpeedModText(speedModifier: SpeedModifier | null | undefined): string {
		if (!speedModifier) return "Default (1.00x)";

		if (speedModifier.type === "xmod") {
			return `${speedModifier.multiplier.toFixed(2)}x`;
		}

		if (speedModifier.type === "cmod") {
			return `C${speedModifier.pixelsPerSecond}`;
		}

		return "Default (1.00x)";
	}

	private attachEventListeners(): void {
		document.getElementById("btn-toggle-fps")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.toggleFps();
		});

		document.getElementById("btn-toggle-timing")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.toggleTimingDisplay();
		});

		document.getElementById("btn-toggle-menu-sounds")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.toggleMenuSounds();
		});

		document.getElementById("btn-speed-mod")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.onNavigate("speed-mod-select");
		});

		document.getElementById("btn-calibrate")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.onNavigate("calibration");
		});

		document.getElementById("btn-gamepad")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.onNavigate("gamepad-settings");
		});

		document.getElementById("bg-prev")?.addEventListener("click", () => {
			menuAudio.playNavigate();
			this.cycleBackground(-1);
		});

		document.getElementById("bg-next")?.addEventListener("click", () => {
			menuAudio.playNavigate();
			this.cycleBackground(1);
		});

		document.getElementById("btn-back")?.addEventListener("click", () => {
			menuAudio.playCancel();
			this.onNavigate("main-menu");
		});

		// Note: Keyboard handler is set up in mount() and cleaned up in unmount()
	}

	private handleHorizontalAction(action: "LEFT" | "RIGHT"): void {
		// Only background cycler supports left/right
		if (this.selectedIndex === 6) {
			const delta = action === "LEFT" ? -1 : 1;
			menuAudio.playNavigate();
			this.cycleBackground(delta);
		}
	}

	private activateSelectedItem(): void {
		menuAudio.playSelect();
		switch (this.selectedIndex) {
			case 0:
				this.toggleFps();
				break;
			case 1:
				this.toggleTimingDisplay();
				break;
			case 2:
				this.toggleMenuSounds();
				break;
			case 3:
				this.onNavigate("speed-mod-select");
				break;
			case 4:
				this.onNavigate("calibration");
				break;
			case 5:
				this.onNavigate("gamepad-settings");
				break;
			case 6:
				// Background - use left/right to cycle
				break;
		}
	}

	private cycleBackground(delta: number): void {
		const currentBackground = usePreferences.getState().background;
		const currentIndex = this.backgrounds.findIndex((bg) => bg.id === currentBackground);
		const newIndex = (currentIndex + delta + this.backgrounds.length) % this.backgrounds.length;
		const newBackground = this.backgrounds[newIndex];
		if (newBackground) {
			usePreferences.getState().setBackground(newBackground.id);
			applyBackground(newBackground.id, this.backgrounds);
			this.render();
			this.attachEventListeners();
		}
	}

	private toggleFps(): void {
		const currentValue = useAppStore.getState().showFps;
		useAppStore.getState().setShowFps(!currentValue);
		this.render();
		this.attachEventListeners();
	}

	private toggleTimingDisplay(): void {
		const currentValue = useAppStore.getState().showTimingDisplay;
		useAppStore.getState().setShowTimingDisplay(!currentValue);
		this.render();
		this.attachEventListeners();
	}

	private toggleMenuSounds(): void {
		const currentValue = usePreferences.getState().menuSounds;
		usePreferences.getState().setMenuSounds(!currentValue);
		this.render();
		this.attachEventListeners();
	}

	private scrollSelectedIntoView(): void {
		// Use setTimeout to ensure DOM has updated after render
		setTimeout(() => {
			if (!this.isMounted) return;
			const selected = this.container?.querySelector(".setting-item.selected");
			if (selected) {
				selected.scrollIntoView({ behavior: "smooth", block: "nearest" });
			}
		}, 0);
	}
}
