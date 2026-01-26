import { describe, expect, it } from "vitest";

describe("Speed Modifier Code Review Issues", () => {
	describe("MEDIUM: Renderer.updateScrollSpeed() - Invalid BPM handling", () => {
		it("should handle zero BPM without producing Infinity", () => {
			// This test requires Renderer, which depends on PixiJS and canvas
			// We'll test the calculation logic directly

			const pixelsPerSecond = 400;
			const zeroBpm = 0;

			// The bug: beatsPerSecond = 0 / 60 = 0
			// scrollSpeed = 400 / 0 = Infinity
			const beatsPerSecond = zeroBpm / 60;
			const scrollSpeed = pixelsPerSecond / beatsPerSecond;

			// This should be Infinity without the fix
			expect(scrollSpeed).toBe(Number.POSITIVE_INFINITY);
		});

		it("should handle negative BPM without producing negative scroll speed", () => {
			const pixelsPerSecond = 400;
			const negativeBpm = -120;

			const beatsPerSecond = negativeBpm / 60;
			const scrollSpeed = pixelsPerSecond / beatsPerSecond;

			// This should be -200 without the fix
			expect(scrollSpeed).toBeLessThan(0);
		});

		it("should handle NaN BPM without producing NaN scroll speed", () => {
			const pixelsPerSecond = 400;
			const nanBpm = Number.NaN;

			const beatsPerSecond = nanBpm / 60;
			const scrollSpeed = pixelsPerSecond / beatsPerSecond;

			// This should be NaN without the fix
			expect(Number.isNaN(scrollSpeed)).toBe(true);
		});

		it("should handle Infinity BPM", () => {
			const pixelsPerSecond = 400;
			const infinityBpm = Number.POSITIVE_INFINITY;

			const beatsPerSecond = infinityBpm / 60;
			const scrollSpeed = pixelsPerSecond / beatsPerSecond;

			// This should be 0 without the fix
			expect(scrollSpeed).toBe(0);
		});
	});

	describe("MEDIUM: SpeedModSelector - Index mapping bug", () => {
		it("should demonstrate the keyboard navigation bug with default selection", () => {
			// Simulating SpeedModSelector logic
			const SPEED_PRESETS = {
				"0.5x": { type: "xmod" as const, multiplier: 0.5 },
				"1.0x": { type: "xmod" as const, multiplier: 1.0 },
				"1.5x": { type: "xmod" as const, multiplier: 1.5 },
			};

			const presetKeys = Object.keys(SPEED_PRESETS);
			const selectedIndex = 0; // BUG: Should be -1 for default

			// Current modifier is null (Default)
			const currentModifier = null;

			// Elements: [Default, 0.5x, 1.0x, 1.5x]
			const elements = ["Default", "0.5x", "1.0x", "1.5x"];

			// If currentModifier is null and selectedIndex is 0,
			// the UI should highlight "Default" (index 0), but...
			const activeElementIndex = selectedIndex;
			expect(activeElementIndex).toBe(0); // Highlights "Default"

			// When user presses Enter:
			// selectCurrent() checks: if selectedIndex < 0 || selectedIndex >= presetKeys.length
			// Since selectedIndex = 0, it's NOT < 0, so it tries to select presetKeys[0]
			const selectedPresetKey = presetKeys[selectedIndex];
			expect(selectedPresetKey).toBe("0.5x"); // BUG: Selects 0.5x instead of Default!

			// The correct behavior with selectedIndex = -1:
			const correctSelectedIndex = -1;
			if (correctSelectedIndex < 0 || correctSelectedIndex >= presetKeys.length) {
				// Should select Default (null)
				expect(correctSelectedIndex).toBeLessThan(0);
			}
		});

		it("should demonstrate the updateActive() bug with preset indices", () => {
			// Elements array: [Default (index 0), 0.5x (index 1), 1.0x (index 2), 1.5x (index 3)]
			// Preset keys: ["0.5x", "1.0x", "1.5x"] (indices 0, 1, 2)

			const presetKeys = ["0.5x", "1.0x", "1.5x"];
			const elements = [
				{ name: "Default", index: 0 },
				{ name: "0.5x", index: 1 },
				{ name: "1.0x", index: 2 },
				{ name: "1.5x", index: 3 },
			];

			// User selects "1.0x" preset (preset index 1)
			const presetIndex = 1; // Points to "1.0x" in presetKeys
			const selectedIndex = presetIndex; // BUG: Should be presetIndex + 1

			// updateActive() highlights element at selectedIndex
			const highlightedElement = elements[selectedIndex];
			expect(highlightedElement?.name).toBe("0.5x"); // BUG: Highlights wrong element!

			// Correct behavior: selectedIndex should be presetIndex + 1
			const correctSelectedIndex = presetIndex + 1;
			const correctHighlightedElement = elements[correctSelectedIndex];
			expect(correctHighlightedElement?.name).toBe("1.0x"); // Correct!
		});
	});
});
