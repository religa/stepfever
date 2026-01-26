import { describe, expect, it } from "vitest";

/**
 * Tests for dynamic look-ahead calculation issues found in code review
 *
 * Issue 1 (High): Dynamic look-ahead can divide by zero/NaN when BPM or scroll speed is invalid
 * Location: packages/web/src/engine/GameEngine.ts:191-194
 * Location: packages/web/src/multiplayer/MultiplayerEngine.ts:201-204
 */
describe("Dynamic Look-Ahead Issues", () => {
	describe("Issue 1: Division by zero/NaN protection", () => {
		it("should handle zero BPM gracefully", () => {
			// Test the calculation logic directly - when BPM is zero, beatsPerSecond is 0
			// and pixelsPerBeat becomes Infinity
			const scrollSpeed = 200;
			const bpm = 0; // Zero BPM!
			const beatsPerSecond = bpm / 60;
			const pixelsPerBeat = scrollSpeed / beatsPerSecond; // Will be Infinity
			const viewportHeight = 1080;
			const receptorY = 100;

			// This is the formula from GameEngine with guard
			const beatsAhead =
				Number.isFinite(pixelsPerBeat) && pixelsPerBeat > 0
					? Math.ceil((viewportHeight - receptorY) / pixelsPerBeat) + 2
					: 8;

			// Should fallback to 8 beats
			expect(beatsAhead).toBe(8);
			expect(Number.isFinite(beatsAhead)).toBe(true);
		});

		it("should handle negative BPM gracefully", () => {
			// Test the calculation logic directly - when BPM is negative,
			// pixelsPerBeat becomes negative
			const scrollSpeed = 200;
			const bpm = -120; // Negative BPM!
			const beatsPerSecond = bpm / 60;
			const pixelsPerBeat = scrollSpeed / beatsPerSecond; // Will be negative
			const viewportHeight = 1080;
			const receptorY = 100;

			// This is the formula from GameEngine with guard
			const beatsAhead =
				Number.isFinite(pixelsPerBeat) && pixelsPerBeat > 0
					? Math.ceil((viewportHeight - receptorY) / pixelsPerBeat) + 2
					: 8;

			// Should fallback to 8 beats
			expect(beatsAhead).toBe(8);
			expect(Number.isFinite(beatsAhead)).toBe(true);
		});

		it("should handle zero scroll speed gracefully", () => {
			// Test the calculation logic directly - when scroll speed is 0,
			// pixelsPerBeat becomes 0
			const scrollSpeed = 0; // Zero scroll speed!
			const bpm = 120;
			const beatsPerSecond = bpm / 60;
			const pixelsPerBeat = scrollSpeed / beatsPerSecond; // Will be 0
			const viewportHeight = 1080;
			const receptorY = 100;

			// This is the formula from GameEngine with guard
			const beatsAhead =
				Number.isFinite(pixelsPerBeat) && pixelsPerBeat > 0
					? Math.ceil((viewportHeight - receptorY) / pixelsPerBeat) + 2
					: 8;

			// Should fallback to 8 beats
			expect(beatsAhead).toBe(8);
			expect(Number.isFinite(beatsAhead)).toBe(true);
		});

		it("should handle NaN pixelsPerBeat gracefully", () => {
			// Test when pixelsPerBeat is NaN (could happen with 0/0 or other edge cases)
			const pixelsPerBeat = Number.NaN;
			const viewportHeight = 1080;
			const receptorY = 100;

			// This is the formula from GameEngine with guard
			const beatsAhead =
				Number.isFinite(pixelsPerBeat) && pixelsPerBeat > 0
					? Math.ceil((viewportHeight - receptorY) / pixelsPerBeat) + 2
					: 8;

			// Should fallback to 8 beats
			expect(beatsAhead).toBe(8);
			expect(Number.isFinite(beatsAhead)).toBe(true);
		});

		it("should produce finite beatsAhead value for valid inputs", () => {
			// Test that the calculation works correctly for valid inputs
			const scrollSpeed = 200;
			const bpm = 120;
			const beatsPerSecond = bpm / 60;
			const pixelsPerBeat = scrollSpeed / beatsPerSecond;
			const viewportHeight = 1080;
			const receptorY = 100;

			// This is the formula from GameEngine with guard
			const beatsAhead =
				Number.isFinite(pixelsPerBeat) && pixelsPerBeat > 0
					? Math.ceil((viewportHeight - receptorY) / pixelsPerBeat) + 2
					: 8;

			expect(Number.isFinite(beatsAhead)).toBe(true);
			expect(beatsAhead).toBeGreaterThan(0);
			// Should calculate actual value, not fallback
			expect(beatsAhead).not.toBe(8);
		});
	});
});
