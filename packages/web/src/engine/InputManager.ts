import type { ControllerConfig } from "@stepfever/core";
import type { GamepadConfig } from "../stores/preferencesStore";
import { GamepadHandler } from "./GamepadHandler";
import { InputHandler } from "./InputHandler";

/**
 * InputManager aggregates keyboard and gamepad input into a unified interface.
 * Tracks active sources per column to prevent release events from one device
 * killing hold notes while the other is still held.
 */
export class InputManager {
	private keyboard: InputHandler;
	private gamepad: GamepadHandler;
	private columnStates = new Map<number, Set<string>>();

	onPress?: (column: number) => void;
	onRelease?: (column: number) => void;

	constructor(keyboardConfig: ControllerConfig, gamepadConfig?: GamepadConfig | null, gamepadIndex?: number) {
		this.keyboard = new InputHandler(keyboardConfig);
		this.gamepad = new GamepadHandler(gamepadConfig ?? undefined, gamepadIndex);

		// Unified dispatch with state tracking
		this.keyboard.onKeyPress = (col) => this.handlePress(col, "keyboard");
		this.keyboard.onKeyRelease = (col) => this.handleRelease(col, "keyboard");
		this.gamepad.onButtonPress = (col) => this.handlePress(col, "gamepad");
		this.gamepad.onButtonRelease = (col) => this.handleRelease(col, "gamepad");
	}

	private handlePress(column: number, source: string): void {
		let states = this.columnStates.get(column);
		if (!states) {
			states = new Set();
			this.columnStates.set(column, states);
		}
		states.add(source);
		// Always fire press to allow re-triggering/jackhammers
		this.onPress?.(column);
	}

	private handleRelease(column: number, source: string): void {
		const states = this.columnStates.get(column);
		if (states) {
			states.delete(source);
			// Only fire release if NO sources are holding the column
			if (states.size === 0) {
				this.onRelease?.(column);
			}
		}
	}

	isGamepadConnected(): boolean {
		return this.gamepad.isConnected();
	}

	getGamepadHandler(): GamepadHandler {
		return this.gamepad;
	}

	getKeyboardHandler(): InputHandler {
		return this.keyboard;
	}

	setGamepadConfig(config: GamepadConfig): void {
		this.gamepad.setConfig(config);
	}

	destroy(): void {
		this.keyboard.destroy();
		this.gamepad.destroy();
	}
}
