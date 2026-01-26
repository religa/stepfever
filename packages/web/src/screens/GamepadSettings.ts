import { menuAudio } from "../audio/MenuAudio";
import { AXIS_GAMEPAD_CONFIG, DEFAULT_GAMEPAD_CONFIG, GamepadHandler } from "../engine/GamepadHandler";
import type { GamepadConfig, InputMapping } from "../stores/preferencesStore";
import { usePreferences } from "../stores/preferencesStore";
import { escapeHtml } from "../utils/html";
import type { Screen } from "./ScreenManager";

type GamepadSettingsMode = "view" | "learn" | "edit";
type DirectionColumn = "left" | "down" | "up" | "right";
type MenuColumn = "menu" | "select";
type AnyColumn = DirectionColumn | MenuColumn;

interface GamepadSettingsState {
	mode: GamepadSettingsMode;
	editingColumn: AnyColumn | null;
	currentConfig: GamepadConfig;
	learnStep: number; // 0-5 for left, down, up, right, menu, select
}

export class GamepadSettingsScreen implements Screen {
	private container: HTMLElement | null = null;
	private onNavigate: (screen: string) => void;
	private handleKeydown: ((e: KeyboardEvent) => void) | null = null;
	private gamepadHandler: GamepadHandler | null = null;
	private visualizationInterval: ReturnType<typeof setInterval> | null = null;
	private learnPromiseResolve: ((mapping: InputMapping) => void) | null = null;
	private _learnReject: ((error: Error) => void) | null = null;

	private state: GamepadSettingsState = {
		mode: "view",
		editingColumn: null,
		currentConfig: usePreferences.getState().gamepadConfig ?? DEFAULT_GAMEPAD_CONFIG,
		learnStep: 0,
	};

	constructor(onNavigate: (screen: string) => void) {
		this.onNavigate = onNavigate;
	}

	mount(container: HTMLElement): void {
		this.container = container;

		// Clean up any existing handler before creating new one
		if (this.gamepadHandler) {
			this.gamepadHandler.destroy();
			this.gamepadHandler = null;
		}

		// Initialize gamepad handler for visualization
		this.gamepadHandler = new GamepadHandler(this.state.currentConfig);

		this.render();
		this.attachEventListeners();
		this.startVisualization();

		// Setup keyboard handler
		this.handleKeydown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				menuAudio.playCancel();
				if (this.state.mode !== "view") {
					this.cancelCurrentOperation();
				} else {
					this.onNavigate("settings");
				}
			}
		};
		window.addEventListener("keydown", this.handleKeydown);
	}

	unmount(): void {
		if (this.handleKeydown) {
			window.removeEventListener("keydown", this.handleKeydown);
			this.handleKeydown = null;
		}

		this.stopVisualization();

		if (this.gamepadHandler) {
			this.gamepadHandler.destroy();
			this.gamepadHandler = null;
		}

		if (this.container) {
			this.container.innerHTML = "";
		}
	}

	private render(): void {
		if (!this.container) return;

		const isConnected = this.gamepadHandler?.isConnected() ?? false;
		const connectionStatus = isConnected
			? '<span class="status-connected">Gamepad Connected</span>'
			: '<span class="status-disconnected">No Gamepad Detected</span>';

		let modeContent = "";
		if (this.state.mode === "learn") {
			const columns = ["LEFT", "DOWN", "UP", "RIGHT", "MENU", "SELECT"];
			const currentColumn = columns[this.state.learnStep] ?? "DONE";
			const isOptional = this.state.learnStep >= 4; // menu and select are optional
			modeContent = `
				<div class="learn-overlay">
					<div class="learn-prompt">
						<h2>Learn Mode</h2>
						<p>Press <strong>${currentColumn}</strong> on your dance pad...</p>
						${isOptional ? '<p class="learn-hint">(Optional - many dance pads don\'t have this button)</p>' : ""}
						<div class="learn-buttons">
							${isOptional ? '<button id="btn-skip-learn" class="menu-button">Skip</button>' : ""}
							<button id="btn-cancel-learn" class="menu-button">Cancel</button>
						</div>
					</div>
				</div>
			`;
		} else if (this.state.mode === "edit") {
			const columnName = this.state.editingColumn?.toUpperCase() ?? "";
			modeContent = `
				<div class="learn-overlay">
					<div class="learn-prompt">
						<h2>Edit Mapping</h2>
						<p>Press button/axis for <strong>${columnName}</strong>...</p>
						<button id="btn-cancel-edit" class="menu-button">Cancel</button>
					</div>
				</div>
			`;
		}

		this.container.innerHTML = `
			<div class="gamepad-settings-screen">
				<div class="header">
					<h1>Gamepad Configuration</h1>
				</div>

				<div class="gamepad-status">
					${connectionStatus}
				</div>

				<div class="mapping-display">
					<h3>Current Mapping: ${escapeHtml(this.state.currentConfig.name)}</h3>
					${this.renderMappingRow("left", 0)}
					${this.renderMappingRow("down", 1)}
					${this.renderMappingRow("up", 2)}
					${this.renderMappingRow("right", 3)}
					<div class="mapping-separator"></div>
					${this.renderOptionalMappingRow("menu", "MENU (Esc)")}
					${this.renderOptionalMappingRow("select", "SELECT (Enter)")}
				</div>

				<div class="gamepad-actions">
					<button id="btn-learn" class="menu-button" ${!isConnected ? "disabled" : ""}>
						Learn Mode
					</button>
					<button id="btn-preset-dpad" class="menu-button">
						D-Pad Preset
					</button>
					<button id="btn-preset-axis" class="menu-button">
						Axis Preset
					</button>
				</div>

				<div class="live-input">
					<h3>Live Input</h3>
					<div id="input-visualizer" class="input-visualizer">
						${isConnected ? "Waiting for input..." : "Connect a gamepad to see live input"}
					</div>
				</div>

				<div class="footer">
					<button id="btn-back" class="menu-button">Back to Settings</button>
				</div>

				<div class="footer-info">
					<p>ESC to return</p>
				</div>

				${modeContent}
			</div>

			<style>
				.gamepad-settings-screen {
					display: flex;
					flex-direction: column;
					align-items: center;
					padding: 2rem;
					min-height: 100vh;
				}
				.gamepad-status {
					margin: 1rem 0;
				}
				.status-connected {
					color: #4caf50;
					font-weight: bold;
				}
				.status-disconnected {
					color: #f44336;
					font-weight: bold;
				}
				.mapping-display {
					background: rgba(0, 0, 0, 0.3);
					padding: 1rem 2rem;
					border-radius: 8px;
					margin: 1rem 0;
					width: 100%;
					max-width: 500px;
				}
				.mapping-row {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 0.5rem 0;
					border-bottom: 1px solid rgba(255, 255, 255, 0.1);
				}
				.mapping-row:last-child {
					border-bottom: none;
				}
				.column-name {
					font-weight: bold;
					width: 60px;
				}
				.mapping-value {
					flex: 1;
					text-align: center;
					color: #aaa;
				}
				.edit-btn {
					padding: 0.25rem 0.5rem;
					font-size: 0.8rem;
				}
				.gamepad-actions {
					display: flex;
					gap: 1rem;
					margin: 1rem 0;
					flex-wrap: wrap;
					justify-content: center;
				}
				.live-input {
					background: rgba(0, 0, 0, 0.3);
					padding: 1rem 2rem;
					border-radius: 8px;
					margin: 1rem 0;
					width: 100%;
					max-width: 500px;
					text-align: center;
				}
				.input-visualizer {
					font-family: monospace;
					color: #0f0;
					min-height: 2rem;
					margin-top: 0.5rem;
				}
				.learn-overlay {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					bottom: 0;
					background: rgba(0, 0, 0, 0.9);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: 1000;
				}
				.learn-prompt {
					text-align: center;
					padding: 2rem;
				}
				.learn-prompt h2 {
					margin-bottom: 1rem;
				}
				.learn-prompt p {
					margin-bottom: 2rem;
					font-size: 1.5rem;
				}
			</style>
		`;
	}

	private renderMappingRow(column: DirectionColumn, _index: number): string {
		const mapping = this.state.currentConfig[column];
		const mappingStr = this.formatMapping(mapping);
		const isConnected = this.gamepadHandler?.isConnected() ?? false;

		return `
			<div class="mapping-row" data-column="${column}">
				<span class="column-name">${column.toUpperCase()}</span>
				<span class="mapping-value">${escapeHtml(mappingStr)}</span>
				<button class="edit-btn menu-button" data-column="${column}" ${!isConnected ? "disabled" : ""}>Edit</button>
			</div>
		`;
	}

	private renderOptionalMappingRow(column: MenuColumn, label: string): string {
		const mapping = this.state.currentConfig[column];
		const mappingStr = mapping ? this.formatMapping(mapping) : "Not configured";
		const isConnected = this.gamepadHandler?.isConnected() ?? false;

		return `
			<div class="mapping-row" data-column="${column}">
				<span class="column-name">${label}</span>
				<span class="mapping-value ${!mapping ? "mapping-none" : ""}">${escapeHtml(mappingStr)}</span>
				<button class="edit-btn menu-button" data-column="${column}" ${!isConnected ? "disabled" : ""}>Edit</button>
			</div>
		`;
	}

	private formatMapping(mapping: InputMapping): string {
		if (mapping.type === "button") {
			return `Button ${mapping.index}`;
		}
		const dir = mapping.direction > 0 ? "+" : "-";
		return `Axis ${mapping.index} ${dir}`;
	}

	private attachEventListeners(): void {
		document.getElementById("btn-learn")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.startLearnMode();
		});

		document.getElementById("btn-preset-dpad")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.applyPreset(DEFAULT_GAMEPAD_CONFIG);
		});

		document.getElementById("btn-preset-axis")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.applyPreset(AXIS_GAMEPAD_CONFIG);
		});

		document.getElementById("btn-back")?.addEventListener("click", () => {
			menuAudio.playCancel();
			this.onNavigate("settings");
		});

		document.getElementById("btn-cancel-learn")?.addEventListener("click", () => {
			menuAudio.playCancel();
			this.cancelCurrentOperation();
		});

		document.getElementById("btn-cancel-edit")?.addEventListener("click", () => {
			menuAudio.playCancel();
			this.cancelCurrentOperation();
		});

		document.getElementById("btn-skip-learn")?.addEventListener("click", () => {
			menuAudio.playSelect();
			// Resolve with null to indicate "skipped"
			if (this.learnPromiseResolve) {
				const resolve = this.learnPromiseResolve;
				this.learnPromiseResolve = null;
				this._learnReject = null;
				resolve(null as unknown as InputMapping); // null signals "skip"
			}
		});

		// Individual edit buttons (including menu/select)
		this.container?.querySelectorAll(".edit-btn[data-column]").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				menuAudio.playSelect();
				const column = (e.target as HTMLElement).dataset.column as AnyColumn;
				this.editSingleMapping(column);
			});
		});
	}

	private startVisualization(): void {
		this.visualizationInterval = setInterval(() => {
			this.updateVisualization();
		}, 100);
	}

	private stopVisualization(): void {
		if (this.visualizationInterval) {
			clearInterval(this.visualizationInterval);
			this.visualizationInterval = null;
		}
	}

	private updateVisualization(): void {
		const viz = document.getElementById("input-visualizer");
		if (!viz) return;

		const gamepadIndex = this.gamepadHandler?.getGamepadIndex();
		if (gamepadIndex === null) {
			viz.textContent = "Connect a gamepad to see live input";
			return;
		}

		const gamepads = navigator.getGamepads();
		const gamepad = gamepads[gamepadIndex ?? 0];
		if (!gamepad) {
			viz.textContent = "No gamepad data";
			return;
		}

		const pressed: string[] = [];

		// Show pressed buttons
		for (let i = 0; i < gamepad.buttons.length; i++) {
			if (gamepad.buttons[i]?.pressed) {
				pressed.push(`B${i}`);
			}
		}

		// Show active axes
		for (let i = 0; i < gamepad.axes.length; i++) {
			const val = gamepad.axes[i];
			if (val !== undefined && Math.abs(val) > 0.3) {
				pressed.push(`A${i}: ${val.toFixed(2)}`);
			}
		}

		viz.textContent = pressed.length > 0 ? pressed.join(", ") : "No input";

		// If in learn or edit mode, check for input
		if ((this.state.mode === "learn" || this.state.mode === "edit") && this.learnPromiseResolve) {
			const mapping = this.detectInput(gamepad);
			if (mapping) {
				const resolve = this.learnPromiseResolve;
				this.learnPromiseResolve = null;
				resolve(mapping);
			}
		}
	}

	private detectInput(gamepad: Gamepad): InputMapping | null {
		// Check buttons
		for (let i = 0; i < gamepad.buttons.length; i++) {
			if (gamepad.buttons[i]?.pressed) {
				return { type: "button", index: i };
			}
		}

		// Check axes
		for (let i = 0; i < gamepad.axes.length; i++) {
			const value = gamepad.axes[i];
			if (value !== undefined && Math.abs(value) > 0.7) {
				return { type: "axis", index: i, direction: value > 0 ? 1 : -1 };
			}
		}

		return null;
	}

	private async startLearnMode(): Promise<void> {
		this.state.mode = "learn";
		this.state.learnStep = 0;
		this.render();
		this.attachEventListeners();

		const columns: AnyColumn[] = ["left", "down", "up", "right", "menu", "select"];
		const newConfig: Partial<GamepadConfig> = { name: "Learned" };

		for (let i = 0; i < columns.length; i++) {
			this.state.learnStep = i;
			this.render();
			this.attachEventListeners();

			try {
				const mapping = await this.waitForInput();
				if (mapping !== null) {
					newConfig[columns[i]!] = mapping;
				}
				// null means "skipped" - don't set the mapping
			} catch {
				// Cancelled
				this.state.mode = "view";
				this.render();
				this.attachEventListeners();
				return;
			}
		}

		this.state.currentConfig = newConfig as GamepadConfig;
		this.state.mode = "view";
		this.saveConfig();
		this.render();
		this.attachEventListeners();
	}

	private async editSingleMapping(column: AnyColumn): Promise<void> {
		this.state.mode = "edit";
		this.state.editingColumn = column;
		this.render();
		this.attachEventListeners();

		try {
			const mapping = await this.waitForInput();

			if (mapping !== null) {
				this.state.currentConfig = {
					...this.state.currentConfig,
					name: "Custom",
					[column]: mapping,
				};

				this.saveConfig();
			}
		} catch {
			// Cancelled
		}

		this.state.mode = "view";
		this.state.editingColumn = null;
		this.render();
		this.attachEventListeners();
	}

	private waitForInput(): Promise<InputMapping | null> {
		// Cancel any existing operation first (prevents race condition)
		if (this.learnPromiseResolve || this._learnReject) {
			const reject = this._learnReject;
			this.learnPromiseResolve = null;
			this._learnReject = null;
			if (reject) {
				reject(new Error("Superseded"));
			}
		}

		return new Promise((resolve, reject) => {
			this.learnPromiseResolve = resolve as (mapping: InputMapping) => void;

			// Store reject for cancellation
			this._learnReject = reject;
		});
	}

	private cancelCurrentOperation(): void {
		this.learnPromiseResolve = null;
		const reject = this._learnReject;
		if (reject) {
			this._learnReject = null;
			reject(new Error("Cancelled"));
		}
		this.state.mode = "view";
		this.state.editingColumn = null;
		this.render();
		this.attachEventListeners();
	}

	private applyPreset(config: GamepadConfig): void {
		this.state.currentConfig = { ...config };
		this.saveConfig();
		this.render();
		this.attachEventListeners();
	}

	private saveConfig(): void {
		usePreferences.getState().setGamepadConfig(this.state.currentConfig);
		if (this.gamepadHandler) {
			this.gamepadHandler.setConfig(this.state.currentConfig);
		}
	}
}
