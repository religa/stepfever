import { describe, expect, it } from "vitest";
import { ScoringEngine } from "../src/scoring/engine";
import type { Judgment, JudgmentResult } from "../src/scoring/model";

const makeResult = (judgment: Judgment, timingError = 0): JudgmentResult => ({
	judgment,
	timingError,
	beat: 0,
	column: 0,
});

describe("ScoringEngine", () => {
	it("should track combo on good judgments", () => {
		const engine = new ScoringEngine(10);

		engine.recordJudgment(makeResult("marvelous"));
		engine.recordJudgment(makeResult("perfect"));
		engine.recordJudgment(makeResult("great"));

		expect(engine.getCombo()).toBe(3);
		expect(engine.getMaxCombo()).toBe(3);
	});

	it("should reset combo on bad judgments", () => {
		const engine = new ScoringEngine(10);

		for (let i = 0; i < 5; i++) {
			engine.recordJudgment(makeResult("marvelous"));
		}
		expect(engine.getCombo()).toBe(5);

		engine.recordJudgment(makeResult("good"));
		expect(engine.getCombo()).toBe(0);
		expect(engine.getMaxCombo()).toBe(5); // Max preserved
	});

	it.each(["good", "boo", "miss"] as const)("should break combo on %s", (judgment) => {
		const engine = new ScoringEngine(10);
		engine.recordJudgment(makeResult("marvelous"));
		engine.recordJudgment(makeResult(judgment));
		expect(engine.getCombo()).toBe(0);
	});

	it("should calculate 100% accuracy for all marvelous", () => {
		const engine = new ScoringEngine(10);
		for (let i = 0; i < 10; i++) {
			engine.recordJudgment(makeResult("marvelous"));
		}
		expect(engine.getAccuracy()).toBe(100);
	});

	it("should calculate mixed accuracy", () => {
		const engine = new ScoringEngine(10);
		for (let i = 0; i < 5; i++) {
			engine.recordJudgment(makeResult("marvelous")); // 100 * 5 = 500
		}
		for (let i = 0; i < 5; i++) {
			engine.recordJudgment(makeResult("perfect")); // 98 * 5 = 490
		}
		// Total: 990 / 10 = 99%
		expect(engine.getAccuracy()).toBeCloseTo(99);
	});

	it.each([
		[100, "AAA"],
		[99.5, "AAA"],
		[99, "AAA"],
		[98.9, "AA"],
		[95, "AA"],
		[94.9, "A"],
		[90, "A"],
		[89.9, "B"],
		[80, "B"],
		[79.9, "C"],
		[70, "C"],
		[69.9, "D"],
		[60, "D"],
		[59.9, "F"],
		[0, "F"],
	] as const)("should assign grade %s for accuracy %.1f%%", (targetAccuracy, expectedGrade) => {
		const engine = new ScoringEngine(100);

		// Calculate how many marvelous vs miss to achieve target accuracy
		// marvelous = 100 points, miss = 0 points
		const marvelousCount = Math.floor(targetAccuracy);
		const missCount = 100 - marvelousCount;

		for (let i = 0; i < marvelousCount; i++) {
			engine.recordJudgment(makeResult("marvelous"));
		}
		for (let i = 0; i < missCount; i++) {
			engine.recordJudgment(makeResult("miss"));
		}

		const result = engine.finalize();
		expect(result.grade).toBe(expectedGrade);
	});

	describe("calibration hint", () => {
		it("suggests offset for consistent late hits", () => {
			const engine = new ScoringEngine(30);
			// Simulate 30 hits at ~+60ms average (late hits)
			for (let i = 0; i < 30; i++) {
				engine.recordJudgment(makeResult("perfect", 55 + (i % 10))); // 55-64ms range
			}
			const result = engine.finalize();
			// Mean ~60ms, stdDev < 80ms, should suggest -60 offset
			expect(result.suggestedOffset).toBe(-60);
		});

		it("suggests offset for consistent early hits", () => {
			const engine = new ScoringEngine(25);
			// Simulate 25 hits at exactly -50ms (early hits)
			for (let i = 0; i < 25; i++) {
				engine.recordJudgment(makeResult("perfect", -50));
			}
			const result = engine.finalize();
			// Mean -50ms, should suggest +50 offset
			expect(result.suggestedOffset).toBe(50);
		});

		it("returns undefined for small bias (< 30ms)", () => {
			const engine = new ScoringEngine(30);
			// 30 hits at +15ms average - below 30ms threshold
			for (let i = 0; i < 30; i++) {
				engine.recordJudgment(makeResult("marvelous", 10 + (i % 10))); // 10-19ms range
			}
			const result = engine.finalize();
			expect(result.suggestedOffset).toBeUndefined();
		});

		it("returns undefined for inconsistent timing (stdDev > 80ms)", () => {
			const engine = new ScoringEngine(40);
			// Alternate between very early and very late hits
			for (let i = 0; i < 40; i++) {
				const error = i % 2 === 0 ? 100 : -100; // Huge variance
				engine.recordJudgment(makeResult("good", error));
			}
			const result = engine.finalize();
			expect(result.suggestedOffset).toBeUndefined();
		});

		it("returns undefined for insufficient data (< 20 hits)", () => {
			const engine = new ScoringEngine(10);
			// Only 10 hits - below 20 sample threshold
			for (let i = 0; i < 10; i++) {
				engine.recordJudgment(makeResult("perfect", 60));
			}
			const result = engine.finalize();
			expect(result.suggestedOffset).toBeUndefined();
		});

		it("excludes misses from timing statistics", () => {
			const engine = new ScoringEngine(50);
			// 25 consistent hits + 25 misses
			for (let i = 0; i < 25; i++) {
				engine.recordJudgment(makeResult("perfect", 60));
			}
			for (let i = 0; i < 25; i++) {
				engine.recordJudgment(makeResult("miss", 0)); // Misses have timingError=0
			}
			const result = engine.finalize();
			// Only 25 samples (misses excluded), should still suggest offset
			expect(result.suggestedOffset).toBe(-60);
		});
	});
});
