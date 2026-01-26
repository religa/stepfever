import { describe, expect, it } from "vitest";
import { calculateVisibilityWindow } from "../src/mods/speed";

/**
 * Tests for visibility window calculation issues found in code review
 *
 * Issue 3 (Medium): calculateVisibilityWindow divides by scrollSpeed without guarding zero/invalid values
 * Location: packages/core/src/mods/speed.ts:26-36
 */
describe("Visibility Window Issues", () => {
	describe("Issue 3: Division by zero/invalid scroll speed", () => {
		it("should handle zero scroll speed gracefully", () => {
			const result = calculateVisibilityWindow(0, 800, 120);

			// Should not produce Infinity or NaN
			expect(Number.isFinite(result)).toBe(true);
			expect(result).toBe(0); // Should return 0 or another safe default
		});

		it("should handle negative scroll speed gracefully", () => {
			const result = calculateVisibilityWindow(-100, 800, 120);

			// Should not produce Infinity or NaN
			expect(Number.isFinite(result)).toBe(true);
			expect(result).toBe(0); // Should return 0 for invalid speeds
		});

		it("should handle NaN scroll speed gracefully", () => {
			const result = calculateVisibilityWindow(Number.NaN, 800, 120);

			// Should not produce Infinity or propagate NaN
			expect(Number.isFinite(result)).toBe(true);
			expect(result).toBe(0);
		});

		it("should handle Infinity scroll speed gracefully", () => {
			const result = calculateVisibilityWindow(Number.POSITIVE_INFINITY, 800, 120);

			// Should not produce NaN
			expect(Number.isFinite(result)).toBe(true);
		});

		it("should produce correct result for valid inputs", () => {
			const scrollSpeed = 200; // pixels per second
			const screenHeight = 800; // pixels
			const bpm = 120;

			const result = calculateVisibilityWindow(scrollSpeed, screenHeight, bpm);

			// visibleSeconds = 800 / 200 = 4 seconds
			// beatsPerSecond = 120 / 60 = 2 beats/sec
			// result = 4 * 2 = 8 beats
			expect(result).toBe(8);
			expect(Number.isFinite(result)).toBe(true);
		});

		it("should handle very small scroll speeds without producing huge values", () => {
			const result = calculateVisibilityWindow(0.001, 800, 120);

			// Should produce a finite number, not Infinity
			expect(Number.isFinite(result)).toBe(true);

			// Very small scroll speed means a LOT of beats visible
			// But it shouldn't be Infinity
			expect(result).toBeLessThan(Number.MAX_SAFE_INTEGER);
		});
	});
});
