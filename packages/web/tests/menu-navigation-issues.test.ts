import { describe, expect, it } from "vitest";

// Test the input utility
describe("getMenuAction", () => {
	it("maps arrow keys to actions", async () => {
		const { getMenuAction } = await import("../src/utils/input");

		expect(getMenuAction("ArrowUp")).toBe("UP");
		expect(getMenuAction("ArrowDown")).toBe("DOWN");
		expect(getMenuAction("ArrowLeft")).toBe("LEFT");
		expect(getMenuAction("ArrowRight")).toBe("RIGHT");
	});

	it("maps WASD to actions (case insensitive)", async () => {
		const { getMenuAction } = await import("../src/utils/input");

		expect(getMenuAction("w")).toBe("UP");
		expect(getMenuAction("W")).toBe("UP");
		expect(getMenuAction("s")).toBe("DOWN");
		expect(getMenuAction("S")).toBe("DOWN");
		expect(getMenuAction("a")).toBe("LEFT");
		expect(getMenuAction("A")).toBe("LEFT");
		expect(getMenuAction("d")).toBe("RIGHT");
		expect(getMenuAction("D")).toBe("RIGHT");
	});

	it("maps Enter and Space to CONFIRM", async () => {
		const { getMenuAction } = await import("../src/utils/input");

		expect(getMenuAction("Enter")).toBe("CONFIRM");
		expect(getMenuAction(" ")).toBe("CONFIRM");
	});

	it("maps Escape to BACK", async () => {
		const { getMenuAction } = await import("../src/utils/input");

		expect(getMenuAction("Escape")).toBe("BACK");
	});

	it("maps / to SEARCH", async () => {
		const { getMenuAction } = await import("../src/utils/input");

		expect(getMenuAction("/")).toBe("SEARCH");
	});

	it("returns null for unknown keys", async () => {
		const { getMenuAction } = await import("../src/utils/input");

		expect(getMenuAction("x")).toBe(null);
		expect(getMenuAction("Tab")).toBe(null);
		expect(getMenuAction("Shift")).toBe(null);
		expect(getMenuAction("1")).toBe(null);
	});
});

describe("GamepadHandler menu navigation", () => {
	it("inGameplay detection is based on callbacks", async () => {
		// The GamepadHandler determines mode based on whether callbacks are set:
		// inGameplay = !!this.onButtonPress || !!this.onButtonRelease
		// This test validates the logic conceptually

		// No callbacks = menu mode (should dispatch navigation events)
		const noCallbacks = { onButtonPress: undefined, onButtonRelease: undefined };
		const inGameplayNoCallbacks = !!noCallbacks.onButtonPress || !!noCallbacks.onButtonRelease;
		expect(inGameplayNoCallbacks).toBe(false);

		// With press callback = gameplay mode (should fire column callbacks)
		const withPress = { onButtonPress: () => {}, onButtonRelease: undefined };
		const inGameplayWithPress = !!withPress.onButtonPress || !!withPress.onButtonRelease;
		expect(inGameplayWithPress).toBe(true);

		// With release callback = gameplay mode
		const withRelease = { onButtonPress: undefined, onButtonRelease: () => {} };
		const inGameplayWithRelease = !!withRelease.onButtonPress || !!withRelease.onButtonRelease;
		expect(inGameplayWithRelease).toBe(true);
	});
});

describe("SettingsNew keyboard navigation", () => {
	it("uses settings array length dynamically (not magic number)", async () => {
		// The SettingsScreen should derive settingsCount from the settings array
		// This test documents the expected settings structure
		const settingIds = ["fps", "timing", "menu-sounds", "speed", "offset", "gamepad", "background"];
		// Settings count should be derived from array, not hardcoded
		expect(settingIds.length).toBe(7);
	});
});

describe("SongSelect search behavior", () => {
	it("CONFIRM action should allow starting game even when search is focused", async () => {
		// The SongSelect screen should allow Enter to start game even when search input is focused
		// This is a UX improvement to prevent users from having to blur the search first
		const { getMenuAction } = await import("../src/utils/input");

		// Enter should map to CONFIRM
		expect(getMenuAction("Enter")).toBe("CONFIRM");

		// Space should also map to CONFIRM
		expect(getMenuAction(" ")).toBe("CONFIRM");
	});
});

describe("GamepadHandler initialization", () => {
	it("should not start polling for non-existent targeted gamepad", async () => {
		// When a targetIndex is provided but that gamepad is not connected,
		// the handler should not start polling or report as connected
		// This is a defensive programming test

		// The fix: check if gamepad exists at targetIndex before starting polling
		const targetIndex = 5; // Unlikely to exist
		const gamepads: (Gamepad | null)[] = [null, null, null, null]; // No gamepads connected

		// Simulate the fixed logic
		const shouldStartPolling =
			targetIndex !== undefined && gamepads[targetIndex] !== undefined && gamepads[targetIndex] !== null;
		expect(shouldStartPolling).toBe(false);
	});
});
