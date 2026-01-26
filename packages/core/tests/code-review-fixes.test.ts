import { describe, expect, it } from "vitest";
import { JudgmentEngine } from "../src/judgment/engine";
import { ScoringEngine } from "../src/scoring/engine";
import type { Judgment, JudgmentResult } from "../src/scoring/model";

const makeResult = (judgment: Judgment): JudgmentResult => ({
	judgment,
	timingError: 0,
	beat: 0,
	column: 0,
});

describe("Code Review Fixes", () => {
	describe("HIGH: Scoring integrity exploit", () => {
		it("should treat unplayed notes as misses in finalize()", () => {
			const engine = new ScoringEngine(100);

			// Play only 1 note perfectly
			engine.recordJudgment(makeResult("marvelous"));

			const result = engine.finalize();

			// Should have 1 marvelous and 99 misses
			expect(result.judgments.marvelous).toBe(1);
			expect(result.judgments.miss).toBe(99);

			// Accuracy should be 1% (1 * 100 / 100), not 100%
			expect(result.accuracy).toBeCloseTo(1);
			expect(result.grade).toBe("F");
		});

		it("should not inflate score when quitting early", () => {
			const engine = new ScoringEngine(50);

			// Play 10 notes, all marvelous
			for (let i = 0; i < 10; i++) {
				engine.recordJudgment(makeResult("marvelous"));
			}

			const result = engine.finalize();

			// Should have 10 marvelous and 40 misses
			expect(result.judgments.marvelous).toBe(10);
			expect(result.judgments.miss).toBe(40);

			// Accuracy: (10 * 100 + 40 * 0) / 50 = 20%
			expect(result.accuracy).toBeCloseTo(20);
			expect(result.grade).toBe("F");
		});

		it("should work correctly when all notes are played", () => {
			const engine = new ScoringEngine(10);

			// Play all 10 notes
			for (let i = 0; i < 10; i++) {
				engine.recordJudgment(makeResult("marvelous"));
			}

			const result = engine.finalize();

			// Should have 10 marvelous and 0 misses
			expect(result.judgments.marvelous).toBe(10);
			expect(result.judgments.miss).toBe(0);

			// Accuracy should be 100%
			expect(result.accuracy).toBe(100);
			expect(result.grade).toBe("AAA");
		});
	});

	describe("HIGH: Floating-point precision at boundaries", () => {
		it("should handle floating-point noise at marvelous boundary", () => {
			const engine = new JudgmentEngine();

			// Test with a value that might have floating-point noise
			// 0.0225 + epsilon should still be marvelous (or at worst perfect, not worse)
			const expectedTime = 1.0;
			const marvelousWindow = 0.0225;
			const actualTime = expectedTime + marvelousWindow + 0.0000001; // Tiny noise

			const judgment = engine.judgeHit(expectedTime, actualTime);

			// Should be perfect (just outside marvelous), not great or worse
			expect(judgment).toMatch(/marvelous|perfect/);
		});

		it("should handle floating-point noise at perfect boundary", () => {
			const engine = new JudgmentEngine();

			const expectedTime = 1.0;
			const perfectWindow = 0.045;
			const actualTime = expectedTime + perfectWindow + 0.0000001;

			const judgment = engine.judgeHit(expectedTime, actualTime);

			// Should be perfect or great, not good or worse
			expect(judgment).toMatch(/perfect|great/);
		});

		it("should handle exact boundary values correctly", () => {
			const engine = new JudgmentEngine();

			// Test exact boundary value
			const expectedTime = 1.0;
			const marvelousWindow = 0.0225;

			// Exactly at the boundary should still be marvelous
			const judgment = engine.judgeHit(expectedTime, expectedTime + marvelousWindow);
			expect(judgment).toBe("marvelous");
		});

		it("should handle accumulated floating-point errors", () => {
			const engine = new JudgmentEngine();

			// Simulate accumulated error from repeated calculations
			let time = 1.0;
			for (let i = 0; i < 100; i++) {
				time += 0.0225; // Add marvelous window 100 times
			}

			// The accumulated error shouldn't cause wildly incorrect judgments
			const judgment = engine.judgeHit(1.0, time);

			// Should be miss (we're 2.25 seconds late), not something random
			expect(judgment).toBe("miss");
		});
	});
});
