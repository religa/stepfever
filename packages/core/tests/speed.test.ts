import { describe, expect, it } from "vitest";
import type { CMod, SpeedModifier, XMod } from "../src/mods/model";
import { SPEED_PRESETS, calculateScrollSpeed, calculateVisibilityWindow } from "../src/mods/speed";

describe("Speed Calculation", () => {
	describe("calculateScrollSpeed", () => {
		it("should return base speed for null modifier at 120 BPM", () => {
			const speed = calculateScrollSpeed(null, 120);
			expect(speed).toBe(200); // BASE_SCROLL_SPEED
		});

		it("should scale with BPM for null modifier", () => {
			const speed60 = calculateScrollSpeed(null, 60);
			const speed120 = calculateScrollSpeed(null, 120);
			const speed240 = calculateScrollSpeed(null, 240);

			expect(speed60).toBe(100); // 200 * 60 / 120
			expect(speed120).toBe(200); // 200 * 120 / 120
			expect(speed240).toBe(400); // 200 * 240 / 120
		});

		it("should apply X-Mod multiplier correctly", () => {
			const xmod2: XMod = { type: "xmod", multiplier: 2.0 };
			const speed = calculateScrollSpeed(xmod2, 120);
			expect(speed).toBe(400); // 200 * 2.0 * 120 / 120
		});

		it("should scale X-Mod with BPM", () => {
			const xmod2: XMod = { type: "xmod", multiplier: 2.0 };
			const speed60 = calculateScrollSpeed(xmod2, 60);
			const speed120 = calculateScrollSpeed(xmod2, 120);
			const speed240 = calculateScrollSpeed(xmod2, 240);

			expect(speed60).toBe(200); // 200 * 2.0 * 60 / 120
			expect(speed120).toBe(400); // 200 * 2.0 * 120 / 120
			expect(speed240).toBe(800); // 200 * 2.0 * 240 / 120
		});

		it("should use constant speed for C-Mod regardless of BPM", () => {
			const cmod500: CMod = { type: "cmod", pixelsPerSecond: 500 };
			const speed60 = calculateScrollSpeed(cmod500, 60);
			const speed120 = calculateScrollSpeed(cmod500, 120);
			const speed240 = calculateScrollSpeed(cmod500, 240);

			expect(speed60).toBe(500);
			expect(speed120).toBe(500);
			expect(speed240).toBe(500);
		});

		it("should handle fractional X-Mod multipliers", () => {
			const xmod0_5: XMod = { type: "xmod", multiplier: 0.5 };
			const speed = calculateScrollSpeed(xmod0_5, 120);
			expect(speed).toBe(100); // 200 * 0.5 * 120 / 120
		});

		it("should handle extreme X-Mod multipliers", () => {
			const xmodMin: XMod = { type: "xmod", multiplier: 0.1 };
			const xmodMax: XMod = { type: "xmod", multiplier: 20.0 };

			const speedMin = calculateScrollSpeed(xmodMin, 120);
			const speedMax = calculateScrollSpeed(xmodMax, 120);

			expect(speedMin).toBe(20); // 200 * 0.1 * 120 / 120
			expect(speedMax).toBe(4000); // 200 * 20.0 * 120 / 120
		});

		it("should handle extreme C-Mod values", () => {
			const cmodMin: CMod = { type: "cmod", pixelsPerSecond: 100 };
			const cmodMax: CMod = { type: "cmod", pixelsPerSecond: 1000 };

			const speedMin = calculateScrollSpeed(cmodMin, 120);
			const speedMax = calculateScrollSpeed(cmodMax, 120);

			expect(speedMin).toBe(100);
			expect(speedMax).toBe(1000);
		});
	});

	describe("calculateVisibilityWindow", () => {
		it("should calculate correct beats visible at 120 BPM", () => {
			const scrollSpeed = 200; // pixels per second (base speed)
			const screenHeight = 800; // pixels
			const beats = calculateVisibilityWindow(scrollSpeed, screenHeight, 120);

			// visibleSeconds = 800 / 200 = 4 seconds
			// beatsPerSecond = 120 / 60 = 2 beats/sec
			// beats = 4 * 2 = 8 beats
			expect(beats).toBe(8);
		});

		it("should scale with BPM", () => {
			const scrollSpeed = 400;
			const screenHeight = 800;

			const beats60 = calculateVisibilityWindow(scrollSpeed, screenHeight, 60);
			const beats120 = calculateVisibilityWindow(scrollSpeed, screenHeight, 120);
			const beats240 = calculateVisibilityWindow(scrollSpeed, screenHeight, 240);

			// At 60 BPM: 2 seconds * 1 beat/sec = 2 beats
			expect(beats60).toBe(2);
			// At 120 BPM: 2 seconds * 2 beats/sec = 4 beats
			expect(beats120).toBe(4);
			// At 240 BPM: 2 seconds * 4 beats/sec = 8 beats
			expect(beats240).toBe(8);
		});

		it("should scale with screen height", () => {
			const scrollSpeed = 400;
			const bpm = 120;

			const beats400 = calculateVisibilityWindow(scrollSpeed, 400, bpm);
			const beats800 = calculateVisibilityWindow(scrollSpeed, 800, bpm);
			const beats1600 = calculateVisibilityWindow(scrollSpeed, 1600, bpm);

			// 400px: 1 second * 2 beats/sec = 2 beats
			expect(beats400).toBe(2);
			// 800px: 2 seconds * 2 beats/sec = 4 beats
			expect(beats800).toBe(4);
			// 1600px: 4 seconds * 2 beats/sec = 8 beats
			expect(beats1600).toBe(8);
		});

		it("should scale with scroll speed", () => {
			const screenHeight = 800;
			const bpm = 120;

			const beats200 = calculateVisibilityWindow(200, screenHeight, bpm);
			const beats400 = calculateVisibilityWindow(400, screenHeight, bpm);
			const beats800 = calculateVisibilityWindow(800, screenHeight, bpm);

			// 200px/s: 4 seconds * 2 beats/sec = 8 beats
			expect(beats200).toBe(8);
			// 400px/s: 2 seconds * 2 beats/sec = 4 beats
			expect(beats400).toBe(4);
			// 800px/s: 1 second * 2 beats/sec = 2 beats
			expect(beats800).toBe(2);
		});

		it("should handle fractional results", () => {
			const scrollSpeed = 300;
			const screenHeight = 500;
			const bpm = 100;

			const beats = calculateVisibilityWindow(scrollSpeed, screenHeight, bpm);

			// visibleSeconds = 500 / 300 = 1.666...
			// beatsPerSecond = 100 / 60 = 1.666...
			// beats = 1.666... * 1.666... = 2.777...
			expect(beats).toBeCloseTo(2.778, 2);
		});
	});

	describe("SPEED_PRESETS", () => {
		it("should contain all expected X-Mod presets", () => {
			expect(SPEED_PRESETS["0.5x"]).toEqual({ type: "xmod", multiplier: 0.5 });
			expect(SPEED_PRESETS["0.75x"]).toEqual({ type: "xmod", multiplier: 0.75 });
			expect(SPEED_PRESETS["1.0x"]).toEqual({ type: "xmod", multiplier: 1.0 });
			expect(SPEED_PRESETS["1.25x"]).toEqual({ type: "xmod", multiplier: 1.25 });
			expect(SPEED_PRESETS["1.5x"]).toEqual({ type: "xmod", multiplier: 1.5 });
			expect(SPEED_PRESETS["2.0x"]).toEqual({ type: "xmod", multiplier: 2.0 });
			expect(SPEED_PRESETS["2.5x"]).toEqual({ type: "xmod", multiplier: 2.5 });
			expect(SPEED_PRESETS["3.0x"]).toEqual({ type: "xmod", multiplier: 3.0 });
		});

		it("should contain all expected C-Mod presets", () => {
			expect(SPEED_PRESETS.C300).toEqual({ type: "cmod", pixelsPerSecond: 300 });
			expect(SPEED_PRESETS.C400).toEqual({ type: "cmod", pixelsPerSecond: 400 });
			expect(SPEED_PRESETS.C500).toEqual({ type: "cmod", pixelsPerSecond: 500 });
			expect(SPEED_PRESETS.C600).toEqual({ type: "cmod", pixelsPerSecond: 600 });
		});

		it("should have exactly 12 presets", () => {
			expect(Object.keys(SPEED_PRESETS).length).toBe(12);
		});
	});

	describe("Integration: X-Mod vs C-Mod behavior", () => {
		it("should show X-Mod speed changes with BPM", () => {
			const xmod1_5: XMod = { type: "xmod", multiplier: 1.5 };

			const speedAt120 = calculateScrollSpeed(xmod1_5, 120);
			const speedAt180 = calculateScrollSpeed(xmod1_5, 180);

			// X-Mod should scale with BPM
			expect(speedAt180).toBeGreaterThan(speedAt120);
			expect(speedAt180 / speedAt120).toBe(1.5); // 180/120 ratio
		});

		it("should show C-Mod speed stays constant with BPM", () => {
			const cmod400: CMod = { type: "cmod", pixelsPerSecond: 400 };

			const speedAt120 = calculateScrollSpeed(cmod400, 120);
			const speedAt180 = calculateScrollSpeed(cmod400, 180);

			// C-Mod should stay constant
			expect(speedAt120).toBe(speedAt180);
			expect(speedAt120).toBe(400);
		});

		it("should show visibility window changes inversely with speed modifier", () => {
			const screenHeight = 800;
			const bpm = 120;

			const xmod1: XMod = { type: "xmod", multiplier: 1.0 };
			const xmod2: XMod = { type: "xmod", multiplier: 2.0 };

			const speed1 = calculateScrollSpeed(xmod1, bpm);
			const speed2 = calculateScrollSpeed(xmod2, bpm);

			const beats1 = calculateVisibilityWindow(speed1, screenHeight, bpm);
			const beats2 = calculateVisibilityWindow(speed2, screenHeight, bpm);

			// Higher speed = fewer beats visible
			expect(beats2).toBeLessThan(beats1);
			expect(beats1 / beats2).toBe(2); // 2x speed = half the beats
		});
	});
});
