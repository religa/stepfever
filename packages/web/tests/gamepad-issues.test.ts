/**
 * @vitest-environment happy-dom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock navigator.getGamepads
const mockGetGamepads = vi.fn(() => [null, null, null, null]);
Object.defineProperty(navigator, "getGamepads", {
	value: mockGetGamepads,
	configurable: true,
});

/**
 * Tests for Gamepad Code Review Issues
 *
 * HIGH: Keyboard-only players auto-binding to gamepad
 * HIGH: Mixed input sources dropping hold notes
 * MEDIUM: Gamepad polling rate
 */
describe("Gamepad Code Review Issues", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("HIGH: Keyboard-only players should NOT auto-bind to gamepads", () => {
		it("should not poll or scan for gamepads when gamepadIndex is null", async () => {
			const { GamepadHandler } = await import("../src/engine/GamepadHandler");

			// Pass null explicitly to indicate keyboard-only mode
			const handler = new GamepadHandler(undefined, null);

			// Should not be connected (no auto-scan when null)
			expect(handler.isConnected()).toBe(false);
			expect(handler.getGamepadIndex()).toBeNull();

			handler.destroy();
		});

		it("should not respond to gamepad connect events when targetIndex is null", async () => {
			const { GamepadHandler } = await import("../src/engine/GamepadHandler");

			const handler = new GamepadHandler(undefined, null);
			const onPress = vi.fn();
			handler.onButtonPress = onPress;

			// Simulate gamepad connect event
			const event = new Event("gamepadconnected") as GamepadEvent;
			Object.defineProperty(event, "gamepad", { value: { index: 0 } });
			window.dispatchEvent(event);

			// Should still not be connected
			expect(handler.isConnected()).toBe(false);

			handler.destroy();
		});
	});

	describe("HIGH: Mixed input sources should not drop hold notes", () => {
		it("should only fire release when all sources release the same column", async () => {
			const { InputManager } = await import("../src/engine/InputManager");

			const keyboardConfig = {
				name: "test",
				left: "a",
				down: "s",
				up: "w",
				right: "d",
			};

			const manager = new InputManager(keyboardConfig, null, null);
			const onPress = vi.fn();
			const onRelease = vi.fn();
			manager.onPress = onPress;
			manager.onRelease = onRelease;

			// Get underlying handlers
			const keyboard = manager.getKeyboardHandler();
			const gamepad = manager.getGamepadHandler();

			// Simulate both keyboard and gamepad pressing column 0
			keyboard.onKeyPress?.(0);
			gamepad.onButtonPress?.(0);

			// Both should have triggered press events
			expect(onPress).toHaveBeenCalledTimes(2);

			// Release keyboard only
			keyboard.onKeyRelease?.(0);

			// Release should NOT be called yet (gamepad still holding)
			expect(onRelease).toHaveBeenCalledTimes(0);

			// Release gamepad
			gamepad.onButtonRelease?.(0);

			// NOW release should be called (all sources released)
			expect(onRelease).toHaveBeenCalledTimes(1);

			manager.destroy();
		});
	});

	describe("MEDIUM: Gamepad polling rate should be high for rhythm games", () => {
		it("should poll at high frequency (less than 10ms interval)", async () => {
			const { GamepadHandler } = await import("../src/engine/GamepadHandler");

			// Mock a connected gamepad
			mockGetGamepads.mockReturnValue([{ index: 0, buttons: [], axes: [] }, null, null, null]);

			const setIntervalSpy = vi.spyOn(global, "setInterval");

			// Create handler with explicit target
			const handler = new GamepadHandler(undefined, 0);

			// Verify setInterval was called with a small interval
			const intervalCall = setIntervalSpy.mock.calls.find((call) => typeof call[1] === "number" && call[1] <= 10);
			expect(intervalCall).toBeDefined();

			handler.destroy();
			setIntervalSpy.mockRestore();
		});
	});
});
