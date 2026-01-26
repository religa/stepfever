import type { ControllerConfig } from "@stepfever/core";
import { EventRegistry } from "../utils/EventRegistry";

export class InputHandler {
	onKeyPress?: (column: number) => void;
	onKeyRelease?: (column: number) => void;

	private config: ControllerConfig;
	private readonly keyMap: Map<string, number>;
	private readonly pressedKeys = new Set<string>();
	private readonly events = new EventRegistry();

	constructor(config: ControllerConfig) {
		this.config = config;
		this.keyMap = new Map([
			[config.left, 0],
			[config.down, 1],
			[config.up, 2],
			[config.right, 3],
		]);

		this.events.on(window, "keydown", this.handleKeyDown);
		this.events.on(window, "keyup", this.handleKeyUp);
		this.events.on(window, "blur", this.handleBlur);
	}

	private handleKeyDown = (e: KeyboardEvent): void => {
		// Prevent key repeat
		if (this.pressedKeys.has(e.key)) return;

		const column = this.keyMap.get(e.key);
		if (column !== undefined) {
			e.preventDefault();
			this.pressedKeys.add(e.key);
			this.onKeyPress?.(column);
		}
	};

	private handleKeyUp = (e: KeyboardEvent): void => {
		const column = this.keyMap.get(e.key);
		if (column !== undefined) {
			e.preventDefault();
			this.pressedKeys.delete(e.key);
			this.onKeyRelease?.(column);
		}
	};

	isPressed(column: number): boolean {
		for (const [key, col] of this.keyMap.entries()) {
			if (col === column && this.pressedKeys.has(key)) {
				return true;
			}
		}
		return false;
	}

	private handleBlur = (): void => {
		// Clear all pressed keys and trigger release events
		for (const key of this.pressedKeys) {
			const column = this.keyMap.get(key);
			if (column !== undefined) {
				this.onKeyRelease?.(column);
			}
		}
		this.pressedKeys.clear();
	};

	getConfig(): ControllerConfig {
		return this.config;
	}

	destroy(): void {
		this.events.dispose();
		this.pressedKeys.clear();
	}
}
