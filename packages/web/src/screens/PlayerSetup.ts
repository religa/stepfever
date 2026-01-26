import { type ControllerConfig, getAllPresets } from "@stepfever/core";
import { menuAudio } from "../audio/MenuAudio";
import { detectControllerConflicts } from "../multiplayer/validator";
import { useAppStore } from "../stores/appStore";
import { escapeHtml } from "../utils/html";
import { getMenuAction } from "../utils/input";
import type { Screen } from "./ScreenManager";

export interface PlayerSetupCallbacks {
	onStart: (controllers: ControllerConfig[], gamepadAssignments: (number | null)[]) => void;
	onBack: () => void;
}

/**
 * PlayerSetup screen - configure controllers for multiplayer
 */
export class PlayerSetup implements Screen {
	private container: HTMLElement | null = null;
	private playerCount = 2;
	private selectedPlayerIndex = 0;
	private selectedControllerIndices: number[] = [0, 1, 2, 3]; // Default to first 4 presets
	private gamepadAssignments: (number | null)[] = [null, null, null, null]; // Gamepad index per player (null = keyboard-only)
	private presets: ControllerConfig[];
	private mode: "player-count" | "controller-selection" = "player-count";
	private connectedGamepads: number[] = []; // Track connected gamepad indices

	constructor(
		private callbacks: PlayerSetupCallbacks,
		private store = useAppStore,
	) {
		this.presets = getAllPresets();
	}

	mount(container: HTMLElement): void {
		this.container = container;

		// Detect connected gamepads
		this.updateConnectedGamepads();

		// Restore previous config if it exists
		const existingConfig = this.store.getState().multiplayerConfig;
		if (existingConfig) {
			this.playerCount = existingConfig.playerCount;

			// Restore controller selections by finding preset indices
			for (let i = 0; i < existingConfig.playerCount; i++) {
				const controller = existingConfig.controllers[i];
				if (controller) {
					const presetIndex = this.presets.findIndex((p) => p.name === controller.name);
					if (presetIndex >= 0) {
						this.selectedControllerIndices[i] = presetIndex;
					}
				}
			}

			// Restore gamepad assignments if they exist
			if (existingConfig.gamepadAssignments) {
				for (let i = 0; i < existingConfig.gamepadAssignments.length; i++) {
					this.gamepadAssignments[i] = existingConfig.gamepadAssignments[i] ?? null;
				}
			}
		}

		this.render();
		window.addEventListener("keydown", this.handleKey);
		window.addEventListener("gamepadconnected", this.handleGamepadChange);
		window.addEventListener("gamepaddisconnected", this.handleGamepadChange);
	}

	private updateConnectedGamepads(): void {
		this.connectedGamepads = [];
		const gamepads = navigator.getGamepads();
		for (let i = 0; i < gamepads.length; i++) {
			if (gamepads[i]) {
				this.connectedGamepads.push(i);
			}
		}
	}

	private handleGamepadChange = (): void => {
		this.updateConnectedGamepads();
		this.render();
	};

	unmount(): void {
		window.removeEventListener("keydown", this.handleKey);
		window.removeEventListener("gamepadconnected", this.handleGamepadChange);
		window.removeEventListener("gamepaddisconnected", this.handleGamepadChange);
		if (this.container) {
			this.container.innerHTML = "";
		}
	}

	private handleKey = (e: KeyboardEvent): void => {
		if (this.mode === "player-count") {
			this.handlePlayerCountKey(e);
		} else {
			this.handleControllerSelectionKey(e);
		}
	};

	private handlePlayerCountKey(e: KeyboardEvent): void {
		const action = getMenuAction(e.key);
		if (!action) return;

		e.preventDefault();
		switch (action) {
			case "UP":
				menuAudio.playNavigate();
				this.playerCount = Math.max(2, this.playerCount - 1);
				this.render();
				break;
			case "DOWN":
				menuAudio.playNavigate();
				this.playerCount = Math.min(4, this.playerCount + 1);
				this.render();
				break;
			case "CONFIRM":
				menuAudio.playSelect();
				this.mode = "controller-selection";
				this.render();
				break;
			case "BACK":
				menuAudio.playCancel();
				this.callbacks.onBack();
				break;
		}
	}

	private handleControllerSelectionKey(e: KeyboardEvent): void {
		// Handle 'G' key for gamepad cycling (not part of standard menu actions)
		if (e.key === "g" || e.key === "G") {
			e.preventDefault();
			menuAudio.playNavigate();
			this.cycleGamepadAssignment();
			this.render();
			return;
		}

		const action = getMenuAction(e.key);
		if (!action) return;

		e.preventDefault();
		switch (action) {
			case "UP":
				menuAudio.playNavigate();
				this.selectedPlayerIndex = (this.selectedPlayerIndex - 1 + this.playerCount) % this.playerCount;
				this.render();
				break;
			case "DOWN":
				menuAudio.playNavigate();
				this.selectedPlayerIndex = (this.selectedPlayerIndex + 1) % this.playerCount;
				this.render();
				break;
			case "LEFT":
				menuAudio.playNavigate();
				this.selectedControllerIndices[this.selectedPlayerIndex] =
					(this.selectedControllerIndices[this.selectedPlayerIndex]! - 1 + this.presets.length) % this.presets.length;
				this.render();
				break;
			case "RIGHT":
				menuAudio.playNavigate();
				this.selectedControllerIndices[this.selectedPlayerIndex] =
					(this.selectedControllerIndices[this.selectedPlayerIndex]! + 1) % this.presets.length;
				this.render();
				break;
			case "CONFIRM":
				menuAudio.playSelect();
				this.startGame();
				break;
			case "BACK":
				menuAudio.playCancel();
				this.mode = "player-count";
				this.render();
				break;
		}
	}

	private cycleGamepadAssignment(): void {
		// Cycle through: None → Pad 0 → Pad 1 → ... → None
		const current = this.gamepadAssignments[this.selectedPlayerIndex] ?? null;
		const availablePads = this.connectedGamepads;

		if (availablePads.length === 0) {
			// No gamepads connected, stay at null
			this.gamepadAssignments[this.selectedPlayerIndex] = null;
			return;
		}

		if (current === null) {
			// None → first available pad
			this.gamepadAssignments[this.selectedPlayerIndex] = availablePads[0] ?? null;
		} else {
			// Find current index in available pads
			const currentIdx = availablePads.indexOf(current);
			if (currentIdx === -1 || currentIdx === availablePads.length - 1) {
				// Not found or last pad → None
				this.gamepadAssignments[this.selectedPlayerIndex] = null;
			} else {
				// Next pad
				this.gamepadAssignments[this.selectedPlayerIndex] = availablePads[currentIdx + 1] ?? null;
			}
		}
	}

	private hasGamepadConflict(): boolean {
		// Check for duplicate gamepad assignments
		const assignments = this.gamepadAssignments.slice(0, this.playerCount).filter((a) => a !== null);
		return new Set(assignments).size !== assignments.length;
	}

	private startGame(): void {
		const controllers: ControllerConfig[] = [];
		for (let i = 0; i < this.playerCount; i++) {
			const presetIndex = this.selectedControllerIndices[i];
			const controller = this.presets[presetIndex ?? 0];
			if (controller) {
				controllers.push(controller);
			}
		}

		const conflicts = detectControllerConflicts(controllers);
		if (conflicts.length > 0) {
			alert("Controller conflicts detected! Please ensure each player has unique keys.");
			return;
		}

		// Check for gamepad conflicts
		if (this.hasGamepadConflict()) {
			alert("Gamepad conflicts detected! Each player must use a different gamepad.");
			return;
		}

		// Validate controllers array length matches playerCount
		if (controllers.length !== this.playerCount) {
			alert("Error: Invalid controller configuration.");
			return;
		}

		// Prepare gamepad assignments for the current player count
		const gamepadAssignments = this.gamepadAssignments.slice(0, this.playerCount);

		this.callbacks.onStart(controllers, gamepadAssignments);
	}

	private render(): void {
		if (!this.container) return;

		if (this.mode === "player-count") {
			this.renderPlayerCountMode();
		} else {
			this.renderControllerSelectionMode();
		}
	}

	private renderPlayerCountMode(): void {
		if (!this.container) return;

		this.container.innerHTML = `
			<div class="player-setup">
				<h1 class="title">Multiplayer Setup</h1>
				<div class="subtitle">Select Number of Players</div>

				<div class="player-count-selector">
					<button id="btn-count-up" class="menu-button">▲</button>
					<div class="player-count-value">${this.playerCount} Players</div>
					<button id="btn-count-down" class="menu-button">▼</button>
				</div>

				<div class="player-setup-actions">
					<button id="btn-continue" class="menu-button">Continue</button>
					<button id="btn-back" class="menu-button">Back</button>
				</div>

				<div class="controls">↑↓ to change • ENTER to continue • ESC to go back</div>
			</div>
		`;

		this.attachPlayerCountClickHandlers();
	}

	private attachPlayerCountClickHandlers(): void {
		document.getElementById("btn-count-up")?.addEventListener("click", () => {
			menuAudio.playNavigate();
			this.playerCount = Math.min(4, this.playerCount + 1);
			this.render();
		});

		document.getElementById("btn-count-down")?.addEventListener("click", () => {
			menuAudio.playNavigate();
			this.playerCount = Math.max(2, this.playerCount - 1);
			this.render();
		});

		document.getElementById("btn-continue")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.mode = "controller-selection";
			this.render();
		});

		document.getElementById("btn-back")?.addEventListener("click", () => {
			menuAudio.playCancel();
			this.callbacks.onBack();
		});
	}

	private renderControllerSelectionMode(): void {
		if (!this.container) return;

		const controllers: ControllerConfig[] = [];
		for (let i = 0; i < this.playerCount; i++) {
			const presetIndex = this.selectedControllerIndices[i];
			const controller = this.presets[presetIndex ?? 0];
			if (controller) {
				controllers.push(controller);
			}
		}

		const conflicts = detectControllerConflicts(controllers);
		const hasConflicts = conflicts.length > 0;
		const hasGamepadConflict = this.hasGamepadConflict();

		let conflictHtml = "";
		if (hasConflicts) {
			conflictHtml = `<div class="warning">⚠ Keyboard conflicts detected!</div>`;
		}
		if (hasGamepadConflict) {
			conflictHtml += `<div class="warning">⚠ Gamepad conflicts detected!</div>`;
		}

		const gamepadCountHtml =
			this.connectedGamepads.length > 0
				? `<div class="gamepad-info">${this.connectedGamepads.length} gamepad(s) connected</div>`
				: `<div class="gamepad-info no-gamepads">No gamepads connected</div>`;

		const playersHtml = Array.from({ length: this.playerCount })
			.map((_, i) => {
				const presetIndex = this.selectedControllerIndices[i];
				const controller = this.presets[presetIndex ?? 0];
				const isSelected = i === this.selectedPlayerIndex;
				const gamepadIndex = this.gamepadAssignments[i];
				const gamepadText = gamepadIndex !== null ? `Pad ${gamepadIndex}` : "None";

				return `
					<div class="player-config ${isSelected ? "selected" : ""}" data-player-index="${i}">
						<div class="player-label">${isSelected ? "► " : "  "}Player ${i + 1}</div>
						<button class="controller-prev" data-player="${i}">◄</button>
						<div class="controller-name">${escapeHtml(controller?.name || "Unknown")}</div>
						<button class="controller-next" data-player="${i}">►</button>
						<div class="controller-keys">
							${escapeHtml(controller?.left || "")}
							${escapeHtml(controller?.down || "")}
							${escapeHtml(controller?.up || "")}
							${escapeHtml(controller?.right || "")}
						</div>
						<button class="gamepad-btn" data-player="${i}">Gamepad: ${gamepadText}</button>
					</div>
				`;
			})
			.join("");

		this.container.innerHTML = `
			<div class="player-setup">
				<h1 class="title">Controller Setup</h1>
				<div class="subtitle">${this.playerCount} Players</div>

				${gamepadCountHtml}
				${conflictHtml}

				<div class="players-list">
					${playersHtml}
				</div>

				<div class="player-setup-actions">
					<button id="btn-start-game" class="menu-button">Start Game</button>
					<button id="btn-back-to-count" class="menu-button">Back</button>
				</div>

				<div class="controls">
					<p>↑↓ to select player • ←→ to change keyboard</p>
					<p>G to cycle gamepad • ENTER to start • ESC to go back</p>
				</div>
			</div>
		`;

		this.attachControllerSelectionClickHandlers();
	}

	private attachControllerSelectionClickHandlers(): void {
		// Player row click to select
		this.container?.querySelectorAll(".player-config").forEach((el) => {
			el.addEventListener("click", (e) => {
				// Don't trigger on button clicks
				if ((e.target as HTMLElement).tagName === "BUTTON") return;
				const index = Number.parseInt((el as HTMLElement).dataset.playerIndex ?? "0", 10);
				if (!Number.isNaN(index)) {
					menuAudio.playNavigate();
					this.selectedPlayerIndex = index;
					this.render();
				}
			});
		});

		// Controller prev/next buttons
		this.container?.querySelectorAll(".controller-prev").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const playerIndex = Number.parseInt((btn as HTMLElement).dataset.player ?? "0", 10);
				if (!Number.isNaN(playerIndex)) {
					menuAudio.playNavigate();
					this.selectedControllerIndices[playerIndex] =
						(this.selectedControllerIndices[playerIndex]! - 1 + this.presets.length) % this.presets.length;
					this.render();
				}
			});
		});

		this.container?.querySelectorAll(".controller-next").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const playerIndex = Number.parseInt((btn as HTMLElement).dataset.player ?? "0", 10);
				if (!Number.isNaN(playerIndex)) {
					menuAudio.playNavigate();
					this.selectedControllerIndices[playerIndex] =
						(this.selectedControllerIndices[playerIndex]! + 1) % this.presets.length;
					this.render();
				}
			});
		});

		// Gamepad assignment buttons
		this.container?.querySelectorAll(".gamepad-btn").forEach((btn) => {
			btn.addEventListener("click", (e) => {
				e.stopPropagation();
				const playerIndex = Number.parseInt((btn as HTMLElement).dataset.player ?? "0", 10);
				if (!Number.isNaN(playerIndex)) {
					menuAudio.playNavigate();
					this.selectedPlayerIndex = playerIndex;
					this.cycleGamepadAssignment();
					this.render();
				}
			});
		});

		// Start game button
		document.getElementById("btn-start-game")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.startGame();
		});

		// Back button
		document.getElementById("btn-back-to-count")?.addEventListener("click", () => {
			menuAudio.playCancel();
			this.mode = "player-count";
			this.render();
		});
	}
}
