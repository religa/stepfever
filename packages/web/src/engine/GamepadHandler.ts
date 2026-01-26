import type { GamepadConfig, InputMapping } from "../stores/preferencesStore";
import { EventRegistry } from "../utils/EventRegistry";

// Default preset (D-pad buttons - most common)
export const DEFAULT_GAMEPAD_CONFIG: GamepadConfig = {
	name: "D-Pad",
	left: { type: "button", index: 14 },
	down: { type: "button", index: 13 },
	up: { type: "button", index: 12 },
	right: { type: "button", index: 15 },
	menu: { type: "button", index: 9 }, // Start button
	select: { type: "button", index: 8 }, // Back/Select button
};

// Alternative: Axis-based (for some dance pads)
export const AXIS_GAMEPAD_CONFIG: GamepadConfig = {
	name: "Axis",
	left: { type: "axis", index: 0, direction: -1 },
	down: { type: "axis", index: 1, direction: 1 },
	up: { type: "axis", index: 1, direction: -1 },
	right: { type: "axis", index: 0, direction: 1 },
	menu: { type: "button", index: 9 }, // Start button
	select: { type: "button", index: 8 }, // Back/Select button
};

export class GamepadHandler {
	private config: GamepadConfig;
	private gamepadIndex: number | null = null;
	private pressedInputs = new Set<string>();
	private pollInterval: ReturnType<typeof setInterval> | null = null;
	private readonly events = new EventRegistry();
	private readonly targetIndex: number | undefined;
	private menuPressed = false;
	private selectPressed = false;

	onButtonPress?: (column: number) => void;
	onButtonRelease?: (column: number) => void;

	constructor(config: GamepadConfig = DEFAULT_GAMEPAD_CONFIG, targetIndex?: number) {
		this.config = config;
		this.targetIndex = targetIndex;
		this.events.on(window, "gamepadconnected", this.onConnect);
		this.events.on(window, "gamepaddisconnected", this.onDisconnect);

		if (targetIndex !== undefined) {
			// Multiplayer: Lock to specific device (only start polling if connected)
			const gamepads = navigator.getGamepads();
			if (gamepads[targetIndex]) {
				this.gamepadIndex = targetIndex;
				this.startPolling();
			} else {
				// Not connected yet - will connect via onConnect event
				this.gamepadIndex = null;
			}
		} else {
			// Single player: Auto-scan for first available gamepad
			this.autoScan();
		}
	}

	private autoScan(): void {
		const gamepads = navigator.getGamepads();
		for (let i = 0; i < gamepads.length; i++) {
			if (gamepads[i]) {
				this.gamepadIndex = i;
				this.startPolling();
				break;
			}
		}
	}

	private onConnect = (e: GamepadEvent): void => {
		if (this.targetIndex !== undefined) {
			// Multiplayer: Only connect if this is our target
			if (e.gamepad.index === this.targetIndex) {
				this.gamepadIndex = e.gamepad.index;
				this.startPolling();
			}
		} else {
			// Single player: Auto-connect to any gamepad
			if (this.gamepadIndex === null) {
				this.gamepadIndex = e.gamepad.index;
				this.startPolling();
			}
		}
	};

	private onDisconnect = (e: GamepadEvent): void => {
		// Only handle if this was the connected gamepad
		if (e.gamepad.index !== this.gamepadIndex) return;

		this.stopPolling();
		this.pressedInputs.clear();
		this.menuPressed = false;
		this.selectPressed = false;

		if (this.targetIndex !== undefined) {
			// Multiplayer: Keep target index but mark as disconnected
			// Do NOT auto-switch (would hijack another player's pad)
			this.gamepadIndex = null;
		} else {
			// Single player: Try to find another connected gamepad
			this.gamepadIndex = null;
			const gamepads = navigator.getGamepads();
			for (let i = 0; i < gamepads.length; i++) {
				if (gamepads[i] && i !== e.gamepad.index) {
					this.gamepadIndex = i;
					this.startPolling();
					break;
				}
			}
		}
	};

	private startPolling(): void {
		if (this.pollInterval) return;
		// Poll at ~250Hz (4ms) for higher precision rhythm game input
		// This reduces input latency jitter within the ±22.5ms Marvelous window
		this.pollInterval = setInterval(() => this.poll(), 4);
	}

	private stopPolling(): void {
		if (this.pollInterval) {
			clearInterval(this.pollInterval);
			this.pollInterval = null;
		}
	}

	private poll(): void {
		if (this.gamepadIndex === null) return;

		const gamepads = navigator.getGamepads();
		const gamepad = gamepads[this.gamepadIndex];
		if (!gamepad) return;

		// Determine if we're in gameplay mode (callbacks registered) or menu mode
		const inGameplay = !!this.onButtonPress || !!this.onButtonRelease;

		if (inGameplay) {
			// Gameplay mode: fire column callbacks for rhythm input
			if (this.config.left) this.checkInput(gamepad, this.config.left, 0);
			if (this.config.down) this.checkInput(gamepad, this.config.down, 1);
			if (this.config.up) this.checkInput(gamepad, this.config.up, 2);
			if (this.config.right) this.checkInput(gamepad, this.config.right, 3);
		} else {
			// Menu mode: dispatch synthetic Arrow key events
			this.dispatchNavigationEvents(gamepad);
		}

		// Menu/Select buttons work in both modes
		this.handleMenuButton(gamepad);
		this.handleSelectButton(gamepad);
	}

	private dispatchNavigationEvents(gamepad: Gamepad): void {
		const directions = [
			{ config: this.config.left, key: "ArrowLeft", navKey: "nav-left" },
			{ config: this.config.down, key: "ArrowDown", navKey: "nav-down" },
			{ config: this.config.up, key: "ArrowUp", navKey: "nav-up" },
			{ config: this.config.right, key: "ArrowRight", navKey: "nav-right" },
		];

		for (const { config, key, navKey } of directions) {
			if (!config) continue;

			const pressed = this.isPressed(gamepad, config);
			const wasPressed = this.pressedInputs.has(navKey);

			if (pressed && !wasPressed) {
				this.pressedInputs.add(navKey);
				window.dispatchEvent(
					new KeyboardEvent("keydown", {
						key,
						bubbles: true,
						composed: true,
					}),
				);
			} else if (!pressed && wasPressed) {
				this.pressedInputs.delete(navKey);
			}
		}
	}

	private handleMenuButton(gamepad: Gamepad): void {
		if (!this.config.menu) return;

		const isPressed = this.isPressed(gamepad, this.config.menu);
		if (isPressed && !this.menuPressed) {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Escape",
					bubbles: true,
					composed: true,
				}),
			);
		}
		this.menuPressed = isPressed;
	}

	private handleSelectButton(gamepad: Gamepad): void {
		if (!this.config.select) return;

		const isPressed = this.isPressed(gamepad, this.config.select);
		if (isPressed && !this.selectPressed) {
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: "Enter",
					bubbles: true,
					composed: true,
				}),
			);
		}
		this.selectPressed = isPressed;
	}

	private checkInput(gamepad: Gamepad, mapping: InputMapping, column: number): void {
		const key = mapping.type === "button" ? `button-${mapping.index}` : `axis-${mapping.index}-${mapping.direction}`;
		const pressed = this.isPressed(gamepad, mapping);
		const wasPressed = this.pressedInputs.has(key);

		if (pressed && !wasPressed) {
			this.pressedInputs.add(key);
			this.onButtonPress?.(column);
		} else if (!pressed && wasPressed) {
			this.pressedInputs.delete(key);
			this.onButtonRelease?.(column);
		}
	}

	private isPressed(gamepad: Gamepad, mapping: InputMapping): boolean {
		// Guard against malformed mappings
		if (!mapping || typeof mapping !== "object") return false;

		if (mapping.type === "button") {
			const index = mapping.index;
			if (typeof index !== "number" || index < 0) return false;
			return gamepad.buttons[index]?.pressed ?? false;
		}
		if (mapping.type === "axis") {
			const index = mapping.index;
			const direction = mapping.direction;
			if (typeof index !== "number" || index < 0) return false;
			if (direction !== 1 && direction !== -1) return false;
			// Axis: threshold of 0.5
			const value = gamepad.axes[index] ?? 0;
			return value * direction > 0.5;
		}
		return false;
	}

	setConfig(config: GamepadConfig): void {
		this.config = config;
		this.pressedInputs.clear();
		this.menuPressed = false;
		this.selectPressed = false;
	}

	getConfig(): GamepadConfig {
		return this.config;
	}

	isConnected(): boolean {
		return this.gamepadIndex !== null;
	}

	getGamepadIndex(): number | null {
		return this.gamepadIndex;
	}

	destroy(): void {
		this.stopPolling();
		this.events.dispose();
		this.pressedInputs.clear();
	}
}
