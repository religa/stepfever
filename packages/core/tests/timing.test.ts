import { describe, expect, it } from "vitest";
import { TimingEngine } from "../src/timing/engine";

describe("TimingEngine", () => {
	describe("constant BPM", () => {
		it("should convert beat to time at 60 BPM", () => {
			const engine = new TimingEngine([{ beat: 0, bpm: 60 }], [], 0);

			expect(engine.beatToTime(0)).toBe(0);
			expect(engine.beatToTime(1)).toBe(1);
			expect(engine.beatToTime(60)).toBe(60);
		});

		it("should convert time to beat at 60 BPM", () => {
			const engine = new TimingEngine([{ beat: 0, bpm: 60 }], [], 0);

			expect(engine.timeToBeat(0)).toBe(0);
			expect(engine.timeToBeat(1)).toBe(1);
			expect(engine.timeToBeat(60)).toBe(60);
		});

		it("should handle 120 BPM", () => {
			const engine = new TimingEngine([{ beat: 0, bpm: 120 }], [], 0);

			expect(engine.beatToTime(0)).toBe(0);
			expect(engine.beatToTime(1)).toBe(0.5);
			expect(engine.beatToTime(4)).toBe(2);
		});

		it("should handle offset", () => {
			const engine = new TimingEngine([{ beat: 0, bpm: 60 }], [], -0.5);

			expect(engine.beatToTime(0)).toBe(-0.5);
			expect(engine.beatToTime(1)).toBe(0.5);
		});
	});

	describe("BPM changes", () => {
		it("should handle BPM change at beat 10 (60 → 120)", () => {
			const engine = new TimingEngine(
				[
					{ beat: 0, bpm: 60 },
					{ beat: 10, bpm: 120 },
				],
				[],
				0,
			);

			// Before change: 60 BPM = 1 beat/second
			expect(engine.beatToTime(9)).toBe(9);
			expect(engine.beatToTime(10)).toBe(10);

			// After change: 120 BPM = 0.5 seconds/beat
			expect(engine.beatToTime(11)).toBe(10.5);
			expect(engine.beatToTime(12)).toBe(11);
		});

		it("should convert time to beat with BPM change", () => {
			const engine = new TimingEngine(
				[
					{ beat: 0, bpm: 60 },
					{ beat: 10, bpm: 120 },
				],
				[],
				0,
			);

			expect(engine.timeToBeat(9)).toBe(9);
			expect(engine.timeToBeat(10)).toBe(10);
			expect(engine.timeToBeat(10.5)).toBe(11);
			expect(engine.timeToBeat(11)).toBe(12);
		});
	});

	describe("stops", () => {
		it("should freeze beat during stop", () => {
			const engine = new TimingEngine([{ beat: 0, bpm: 60 }], [{ beat: 10, duration: 5 }], 0);

			// At stop start
			expect(engine.timeToBeat(10)).toBe(10);

			// During stop (beat should stay at 10)
			expect(engine.timeToBeat(11)).toBe(10);
			expect(engine.timeToBeat(12)).toBe(10);
			expect(engine.timeToBeat(14)).toBe(10);

			// After stop (5 seconds later)
			expect(engine.timeToBeat(15)).toBe(10);
			expect(engine.timeToBeat(16)).toBe(11);
		});

		it("should handle stop with BPM change", () => {
			const engine = new TimingEngine(
				[
					{ beat: 0, bpm: 60 },
					{ beat: 10, bpm: 120 },
				],
				[{ beat: 10, duration: 5 }],
				0,
			);

			// During stop
			expect(engine.timeToBeat(12)).toBe(10);

			// After stop, at new BPM
			expect(engine.timeToBeat(15.5)).toBe(11);
		});

		it("should detect if time is during stop", () => {
			const engine = new TimingEngine([{ beat: 0, bpm: 60 }], [{ beat: 10, duration: 5 }], 0);

			expect(engine.isDuringStop(9)).toBe(false);
			expect(engine.isDuringStop(10)).toBe(true);
			expect(engine.isDuringStop(12)).toBe(true);
			expect(engine.isDuringStop(15)).toBe(false);
		});
	});

	describe("getBpmAtBeat", () => {
		it("should return correct BPM at various beats", () => {
			const engine = new TimingEngine(
				[
					{ beat: 0, bpm: 60 },
					{ beat: 10, bpm: 120 },
					{ beat: 20, bpm: 180 },
				],
				[],
				0,
			);

			expect(engine.getBpmAtBeat(0)).toBe(60);
			expect(engine.getBpmAtBeat(5)).toBe(60);
			expect(engine.getBpmAtBeat(10)).toBe(120);
			expect(engine.getBpmAtBeat(15)).toBe(120);
			expect(engine.getBpmAtBeat(20)).toBe(180);
			expect(engine.getBpmAtBeat(100)).toBe(180);
		});
	});

	describe("edge cases", () => {
		it("should handle empty BPM changes array", () => {
			const engine = new TimingEngine([], [], 0);

			// Should default to 120 BPM
			expect(engine.getBpmAtBeat(0)).toBe(120);
			expect(engine.beatToTime(1)).toBe(0.5);
			expect(engine.timeToBeat(1)).toBe(2);
		});

		it("should handle unsorted BPM changes", () => {
			const engine = new TimingEngine(
				[
					{ beat: 10, bpm: 120 },
					{ beat: 0, bpm: 60 },
					{ beat: 20, bpm: 180 },
				],
				[],
				0,
			);

			// Should be sorted internally
			expect(engine.getBpmAtBeat(5)).toBe(60);
			expect(engine.getBpmAtBeat(15)).toBe(120);
			expect(engine.getBpmAtBeat(25)).toBe(180);
		});

		it("should handle unsorted stops", () => {
			const engine = new TimingEngine(
				[{ beat: 0, bpm: 60 }],
				[
					{ beat: 20, duration: 2 },
					{ beat: 10, duration: 1 },
				],
				0,
			);

			// Stops should be sorted internally
			// First stop: beat 10, time 10-11
			expect(engine.isDuringStop(10.5)).toBe(true);
			// Second stop: beat 20 occurs at time 10 + 10 + 1 (first stop) = 21
			// So stop is at time 21-23
			expect(engine.isDuringStop(21.5)).toBe(true);
			expect(engine.isDuringStop(20.5)).toBe(false); // Between stops
		});

		it("should handle fractional beats", () => {
			const engine = new TimingEngine([{ beat: 0, bpm: 120 }], [], 0);

			expect(engine.beatToTime(0.25)).toBe(0.125);
			expect(engine.beatToTime(0.5)).toBe(0.25);
			expect(engine.beatToTime(1.5)).toBe(0.75);
		});

		it("should handle extreme BPM values", () => {
			const engine = new TimingEngine(
				[
					{ beat: 0, bpm: 0.001 }, // Very slow
					{ beat: 10, bpm: 10000 }, // Very fast
				],
				[],
				0,
			);

			// At 0.001 BPM, 1 beat = 60000 seconds
			expect(engine.beatToTime(1)).toBe(60000);

			// At 10000 BPM, 1 beat = 0.006 seconds
			// Beat 0-10: 10 * 60000 = 600000 seconds
			// Beat 10-11: 1 * 0.006 = 0.006 seconds
			const beat11Time = engine.beatToTime(11);
			expect(beat11Time).toBeCloseTo(600000.006, 3);
		});

		it("should handle very long songs (precision test)", () => {
			const engine = new TimingEngine([{ beat: 0, bpm: 120 }], [], 0);

			// 10000 beats at 120 BPM = 5000 seconds
			const time = engine.beatToTime(10000);
			expect(time).toBeCloseTo(5000, 5);

			// Round-trip conversion
			const beat = engine.timeToBeat(time);
			expect(beat).toBeCloseTo(10000, 5);
		});

		it("should handle multiple consecutive stops", () => {
			const engine = new TimingEngine(
				[{ beat: 0, bpm: 60 }],
				[
					{ beat: 10, duration: 2 },
					{ beat: 20, duration: 3 },
					{ beat: 30, duration: 1 },
				],
				0,
			);

			// First stop at beat 10
			expect(engine.timeToBeat(11)).toBe(10);

			// After first stop, at beat 20 (time 10 + 2 + 10 = 22)
			expect(engine.timeToBeat(22)).toBe(20);

			// During second stop (time 22 + 1 = 23)
			expect(engine.timeToBeat(23)).toBe(20);

			// After all stops
			const elapsedStopTime = engine.getElapsedStopTime(50);
			expect(elapsedStopTime).toBe(6); // 2 + 3 + 1
		});

		it("should handle negative offset", () => {
			const engine = new TimingEngine([{ beat: 0, bpm: 60 }], [], -2);

			expect(engine.beatToTime(0)).toBe(-2);
			expect(engine.beatToTime(1)).toBe(-1);
			expect(engine.beatToTime(2)).toBe(0);

			expect(engine.timeToBeat(0)).toBe(2);
			expect(engine.timeToBeat(-1)).toBe(1);
		});

		it("should handle positive offset", () => {
			const engine = new TimingEngine([{ beat: 0, bpm: 60 }], [], 2);

			expect(engine.beatToTime(0)).toBe(2);
			expect(engine.beatToTime(1)).toBe(3);

			expect(engine.timeToBeat(2)).toBe(0);
			expect(engine.timeToBeat(3)).toBe(1);
		});
	});
});
