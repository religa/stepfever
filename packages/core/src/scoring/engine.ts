import type { FinalScore, Judgment, JudgmentResult, ScoreState } from "./model";
import { COMBO_JUDGMENTS, JUDGMENT_WEIGHTS } from "./model";

// Grade thresholds
type Grade = "AAA" | "AA" | "A" | "B" | "C" | "D" | "F";
const GRADE_THRESHOLDS: readonly [number, Grade][] = [
	[99.0, "AAA"],
	[95.0, "AA"],
	[90.0, "A"],
	[80.0, "B"],
	[70.0, "C"],
	[60.0, "D"],
];

export class ScoringEngine {
	private state: ScoreState;

	// Streaming timing stats for calibration hint (O(1) memory)
	private timingSum = 0;
	private timingSumSq = 0;
	private timingCount = 0;

	constructor(totalNotes: number) {
		this.state = {
			judgments: {
				marvelous: 0,
				perfect: 0,
				great: 0,
				good: 0,
				boo: 0,
				miss: 0,
			},
			combo: 0,
			maxCombo: 0,
			totalNotes,
		};
	}

	/**
	 * Record a judgment result.
	 */
	recordJudgment(result: JudgmentResult): void {
		const currentCount = this.state.judgments[result.judgment] ?? 0;
		this.state.judgments[result.judgment] = currentCount + 1;

		if (COMBO_JUDGMENTS.has(result.judgment)) {
			this.state.combo = (this.state.combo ?? 0) + 1;
			this.state.maxCombo = Math.max(this.state.maxCombo ?? 0, this.state.combo ?? 0);
		} else {
			this.state.combo = 0;
		}

		// Collect timing data for calibration hint (excludes misses)
		if (result.judgment !== "miss") {
			this.timingSum += result.timingError;
			this.timingSumSq += result.timingError ** 2;
			this.timingCount++;
		}
	}

	/**
	 * Get current combo.
	 */
	getCombo(): number {
		return this.state.combo ?? 0;
	}

	/**
	 * Get max combo so far.
	 */
	getMaxCombo(): number {
		return this.state.maxCombo ?? 0;
	}

	/**
	 * Get current judgments snapshot.
	 */
	getJudgments(): Readonly<Record<Judgment, number>> {
		return { ...this.state.judgments };
	}

	/**
	 * Calculate current accuracy percentage.
	 */
	getAccuracy(): number {
		return this.calculateAccuracy(this.state.judgments);
	}

	/**
	 * Finalize and return the final score.
	 * Treats unplayed notes as misses to prevent score inflation from early quits.
	 */
	finalize(): FinalScore {
		// Count total judged notes
		const judgedCount = Object.values(this.state.judgments).reduce((sum, count) => sum + count, 0);
		const remainingNotes = Math.max(0, this.state.totalNotes - judgedCount);

		// Create final judgment counts with remaining notes as misses
		const finalJudgments = { ...this.state.judgments };
		if (remainingNotes > 0) {
			finalJudgments.miss += remainingNotes;
		}

		const accuracy = this.calculateAccuracy(finalJudgments);
		const grade = this.calculateGrade(accuracy);

		// Calculate calibration hint if we have enough timing data
		let suggestedOffset: number | undefined;
		if (this.timingCount >= 20) {
			const mean = this.timingSum / this.timingCount;
			const variance = this.timingSumSq / this.timingCount - mean * mean;
			const stdDev = Math.sqrt(Math.max(0, variance));

			// Show hint only for consistent bias: |mean| > 30ms and stdDev < 80ms
			if (Math.abs(mean) > 30 && stdDev < 80) {
				suggestedOffset = -Math.round(mean);
			}
		}

		return {
			judgments: finalJudgments,
			combo: this.state.combo ?? 0,
			maxCombo: this.state.maxCombo ?? 0,
			accuracy,
			grade,
			suggestedOffset,
		};
	}

	/**
	 * Calculate accuracy from a judgment record.
	 * @private
	 */
	private calculateAccuracy(judgments: Record<Judgment, number>): number {
		const entries = Object.entries(judgments) as [Judgment, number][];
		const total = entries.reduce((sum, [, count]) => sum + count, 0);
		if (total === 0) return 0;

		let score = 0;
		for (const [judgment, count] of entries) {
			score += JUDGMENT_WEIGHTS[judgment] * count;
		}

		return score / total;
	}

	private calculateGrade(accuracy: number): Grade {
		for (const [threshold, grade] of GRADE_THRESHOLDS) {
			if (accuracy >= threshold) return grade;
		}
		return "F";
	}
}
