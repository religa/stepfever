import { describe, expect, it } from "vitest";
import { JudgmentEngine } from "../src/judgment/engine";

describe("JudgmentEngine", () => {
	it("should return marvelous for exact hit", () => {
		const engine = new JudgmentEngine();
		expect(engine.judgeHit(1.0, 1.0)).toBe("marvelous");
	});

	it.each([
		[0, "marvelous"],
		[22, "marvelous"], // Just inside marvelous
		[23, "perfect"], // Just outside marvelous
		[44, "perfect"],
		[46, "great"],
		[89, "great"],
		[91, "good"],
		[134, "good"],
		[136, "boo"],
		[179, "boo"],
		[181, "miss"],
	] as const)("should return %s judgment for %dms error", (errorMs, expectedJudgment) => {
		const engine = new JudgmentEngine();
		const errorSec = errorMs / 1000;
		expect(engine.judgeHit(1.0, 1.0 + errorSec)).toBe(expectedJudgment);
	});

	it("should detect early vs late", () => {
		const engine = new JudgmentEngine();

		// Early hit
		expect(engine.getTimingError(1.0, 0.98)).toBeCloseTo(-20);

		// Late hit
		expect(engine.getTimingError(1.0, 1.02)).toBeCloseTo(20);
	});

	it("should check miss correctly", () => {
		const engine = new JudgmentEngine();

		expect(engine.checkMiss(1.0, 1.18)).toBe(false); // Still in boo window
		expect(engine.checkMiss(1.0, 1.181)).toBe(true); // Past boo window
	});

	it("should check hit window correctly", () => {
		const engine = new JudgmentEngine();

		expect(engine.isInHitWindow(1.0, 0.9)).toBe(true); // 100ms early
		expect(engine.isInHitWindow(1.0, 1.1)).toBe(true); // 100ms late
		expect(engine.isInHitWindow(1.0, 1.2)).toBe(false); // Too late
		expect(engine.isInHitWindow(1.0, 0.8)).toBe(false); // Too early
	});

	it("should apply global offset", () => {
		const engine = new JudgmentEngine({ globalOffset: 0.05 });

		// Without offset, this would be 50ms late (perfect)
		// With 50ms offset compensation, it becomes exact (marvelous)
		expect(engine.judgeHit(1.0, 1.05)).toBe("marvelous");
	});
});
