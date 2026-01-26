import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GamepadConfig } from "../src/stores/preferencesStore";

// Helper to create mock gamepad
function createMockGamepad(pressedButtons: number[] = [], index = 0): Gamepad {
	return {
		buttons: Array.from({ length: 16 }, (_, i) => ({
			pressed: pressedButtons.includes(i),
			touched: false,
			value: pressedButtons.includes(i) ? 1 : 0,
		})),
		axes: [0, 0, 0, 0],
		connected: true,
		id: "Test Gamepad",
		index,
		mapping: "standard" as GamepadMappingType,
		timestamp: performance.now(),
		vibrationActuator: null,
	} as unknown as Gamepad;
}

describe("Gamepad Handler Issues", () => {
	let originalGetGamepads: typeof navigator.getGamepads;

	beforeEach(() => {
		originalGetGamepads = navigator.getGamepads;
	});

	afterEach(() => {
		Object.defineProperty(navigator, "getGamepads", {
			value: originalGetGamepads,
			writable: true,
			configurable: true,
		});
	});

	describe("MEDIUM: GamepadHandler should handle malformed configs gracefully", () => {
		it("should handle corrupted gamepadConfig with missing required fields", async () => {
			// Simulate corrupted localStorage data
			const corruptedConfig = {
				name: "Corrupted",
				left: { type: "button", index: 14 },
				// Missing: down, up, right
			};

			const mockGamepad = createMockGamepad();
			Object.defineProperty(navigator, "getGamepads", {
				value: () => [mockGamepad],
				writable: true,
				configurable: true,
			});

			const { GamepadHandler } = await import("../src/engine/GamepadHandler");

			// The handler should not crash with corrupted config
			let didCrash = false;
			let handler: InstanceType<typeof GamepadHandler> | null = null;
			try {
				handler = new GamepadHandler(corruptedConfig as GamepadConfig);
				// Give it time to poll
				await new Promise((resolve) => setTimeout(resolve, 10));
			} catch {
				didCrash = true;
			} finally {
				handler?.destroy();
			}

			// Should NOT crash with missing mappings (they are now guarded)
			expect(didCrash).toBe(false);
		});

		it("should handle malformed InputMapping types", async () => {
			const malformedConfig: GamepadConfig = {
				name: "Malformed",
				// biome-ignore lint/suspicious/noExplicitAny: intentionally malformed for testing
				left: { type: "invalid" as any, index: 0 },
				down: { type: "button", index: -1 }, // Negative index
				// biome-ignore lint/suspicious/noExplicitAny: intentionally malformed for testing
				up: { type: "axis", index: 0, direction: 5 as any }, // Invalid direction
				// biome-ignore lint/suspicious/noExplicitAny: intentionally malformed for testing
				right: null as any, // Null mapping
			};

			const mockGamepad = createMockGamepad();
			Object.defineProperty(navigator, "getGamepads", {
				value: () => [mockGamepad],
				writable: true,
				configurable: true,
			});

			const { GamepadHandler } = await import("../src/engine/GamepadHandler");

			// Should not crash with malformed mappings
			let didCrash = false;
			let handler: InstanceType<typeof GamepadHandler> | null = null;
			try {
				handler = new GamepadHandler(malformedConfig);
				await new Promise((resolve) => setTimeout(resolve, 10));
			} catch {
				didCrash = true;
			} finally {
				handler?.destroy();
			}

			expect(didCrash).toBe(false);
		});
	});

	describe("MEDIUM: Synthetic KeyboardEvents should be properly formed", () => {
		it("should dispatch KeyboardEvent with bubbles and composed properties", async () => {
			const config: GamepadConfig = {
				name: "Test",
				left: { type: "button", index: 14 },
				down: { type: "button", index: 13 },
				up: { type: "button", index: 12 },
				right: { type: "button", index: 15 },
				menu: { type: "button", index: 9 },
				select: { type: "button", index: 8 },
			};

			// Track dispatched events
			const events: KeyboardEvent[] = [];
			const listener = (e: KeyboardEvent) => events.push(e);
			window.addEventListener("keydown", listener);

			// Create mock gamepad with menu button pressed
			const mockGamepad = createMockGamepad([9]); // Menu button pressed
			Object.defineProperty(navigator, "getGamepads", {
				value: () => [mockGamepad],
				writable: true,
				configurable: true,
			});

			const { GamepadHandler } = await import("../src/engine/GamepadHandler");
			const handler = new GamepadHandler(config);

			// Wait for polling to detect the button
			await new Promise((resolve) => setTimeout(resolve, 20));

			handler.destroy();
			window.removeEventListener("keydown", listener);

			// Verify events were dispatched with correct properties
			const escapeEvent = events.find((e) => e.key === "Escape");
			expect(escapeEvent).toBeDefined();
			expect(escapeEvent?.bubbles).toBe(true);
			expect(escapeEvent?.composed).toBe(true);
		});

		it("should dispatch Enter key for select button", async () => {
			const config: GamepadConfig = {
				name: "Test",
				left: { type: "button", index: 14 },
				down: { type: "button", index: 13 },
				up: { type: "button", index: 12 },
				right: { type: "button", index: 15 },
				select: { type: "button", index: 8 },
			};

			const events: KeyboardEvent[] = [];
			const listener = (e: KeyboardEvent) => events.push(e);
			window.addEventListener("keydown", listener);

			// Create mock gamepad with select button pressed
			const mockGamepad = createMockGamepad([8]); // Select button pressed
			Object.defineProperty(navigator, "getGamepads", {
				value: () => [mockGamepad],
				writable: true,
				configurable: true,
			});

			const { GamepadHandler } = await import("../src/engine/GamepadHandler");
			const handler = new GamepadHandler(config);

			await new Promise((resolve) => setTimeout(resolve, 20));

			handler.destroy();
			window.removeEventListener("keydown", listener);

			const enterEvent = events.find((e) => e.key === "Enter");
			expect(enterEvent).toBeDefined();
			expect(enterEvent?.bubbles).toBe(true);
			expect(enterEvent?.composed).toBe(true);
		});
	});

	describe("MEDIUM: Edge detection prevents event flooding", () => {
		it("should only dispatch one event per button press (not flood at 250Hz)", async () => {
			const config: GamepadConfig = {
				name: "Test",
				left: { type: "button", index: 14 },
				down: { type: "button", index: 13 },
				up: { type: "button", index: 12 },
				right: { type: "button", index: 15 },
				menu: { type: "button", index: 9 },
			};

			const events: KeyboardEvent[] = [];
			const listener = (e: KeyboardEvent) => events.push(e);
			window.addEventListener("keydown", listener);

			// Menu button held down
			const mockGamepad = createMockGamepad([9]);
			Object.defineProperty(navigator, "getGamepads", {
				value: () => [mockGamepad],
				writable: true,
				configurable: true,
			});

			const { GamepadHandler } = await import("../src/engine/GamepadHandler");
			const handler = new GamepadHandler(config);

			// Wait for multiple poll cycles (250Hz = 4ms interval)
			await new Promise((resolve) => setTimeout(resolve, 50));

			handler.destroy();
			window.removeEventListener("keydown", listener);

			// Should only dispatch ONE event despite multiple poll cycles
			const escapeEvents = events.filter((e) => e.key === "Escape");
			expect(escapeEvents.length).toBe(1);
		});
	});

	describe("MEDIUM: Menu/select state reset on disconnect", () => {
		it("should reset pressed state on disconnect to avoid missed input", async () => {
			const config: GamepadConfig = {
				name: "Test",
				left: { type: "button", index: 14 },
				down: { type: "button", index: 13 },
				up: { type: "button", index: 12 },
				right: { type: "button", index: 15 },
				menu: { type: "button", index: 9 },
			};

			const { GamepadHandler } = await import("../src/engine/GamepadHandler");

			// Menu button pressed
			const mockGamepad = createMockGamepad([9]);
			Object.defineProperty(navigator, "getGamepads", {
				value: () => [mockGamepad],
				writable: true,
				configurable: true,
			});

			const handler = new GamepadHandler(config);

			// Wait for button to be detected as pressed
			await new Promise((resolve) => setTimeout(resolve, 10));

			// Verify menuPressed is true
			// biome-ignore lint/suspicious/noExplicitAny: accessing private state for test
			expect((handler as any).menuPressed).toBe(true);

			// Simulate disconnect
			Object.defineProperty(navigator, "getGamepads", {
				value: () => [null],
				writable: true,
				configurable: true,
			});

			// Trigger disconnect event with proper gamepad object
			const disconnectGamepad = createMockGamepad([], 0);
			const event = new Event("gamepaddisconnected") as GamepadEvent;
			Object.defineProperty(event, "gamepad", {
				value: disconnectGamepad,
				writable: false,
			});
			window.dispatchEvent(event);

			// After disconnect, pressed state should be reset
			// biome-ignore lint/suspicious/noExplicitAny: accessing private state for test
			expect((handler as any).menuPressed).toBe(false);
			// biome-ignore lint/suspicious/noExplicitAny: accessing private state for test
			expect((handler as any).selectPressed).toBe(false);

			handler.destroy();
		});
	});

	describe("MEDIUM: Learn Mode columns array consistency", () => {
		it("should display correct column names for all learn steps", async () => {
			Object.defineProperty(navigator, "getGamepads", {
				value: () => [],
				writable: true,
				configurable: true,
			});

			const { GamepadSettingsScreen } = await import("../src/screens/GamepadSettings");

			const expectedColumns = ["LEFT", "DOWN", "UP", "RIGHT", "MENU", "SELECT"];
			const mockNavigate = vi.fn();
			const screen = new GamepadSettingsScreen(mockNavigate);

			const container = document.createElement("div");
			document.body.appendChild(container);

			screen.mount(container);

			// biome-ignore lint/suspicious/noExplicitAny: accessing private state for test
			const state = (screen as any).state;
			state.mode = "learn";

			// Verify for each learn step
			for (let step = 0; step < expectedColumns.length; step++) {
				state.learnStep = step;
				// biome-ignore lint/suspicious/noExplicitAny: calling private method for test
				(screen as any).render();

				const overlay = container.querySelector(".learn-overlay");
				expect(overlay).toBeDefined();

				const promptText = overlay?.textContent ?? "";
				const expectedColumn = expectedColumns[step]!;
				expect(promptText).toContain(expectedColumn);
			}

			screen.unmount();
			document.body.removeChild(container);
		});

		it("should show skip button only for optional columns (menu, select)", async () => {
			Object.defineProperty(navigator, "getGamepads", {
				value: () => [],
				writable: true,
				configurable: true,
			});

			const { GamepadSettingsScreen } = await import("../src/screens/GamepadSettings");

			const mockNavigate = vi.fn();
			const screen = new GamepadSettingsScreen(mockNavigate);

			const container = document.createElement("div");
			document.body.appendChild(container);

			screen.mount(container);

			// biome-ignore lint/suspicious/noExplicitAny: accessing private state for test
			const state = (screen as any).state;
			state.mode = "learn";

			// Steps 0-3 (directions) should NOT have skip button
			for (let step = 0; step < 4; step++) {
				state.learnStep = step;
				// biome-ignore lint/suspicious/noExplicitAny: calling private method for test
				(screen as any).render();

				const skipBtn = container.querySelector("#btn-skip-learn");
				expect(skipBtn).toBeNull();
			}

			// Steps 4-5 (menu, select) SHOULD have skip button
			for (let step = 4; step < 6; step++) {
				state.learnStep = step;
				// biome-ignore lint/suspicious/noExplicitAny: calling private method for test
				(screen as any).render();

				const skipBtn = container.querySelector("#btn-skip-learn");
				expect(skipBtn).not.toBeNull();
			}

			screen.unmount();
			document.body.removeChild(container);
		});
	});
});
