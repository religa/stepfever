import * as v from "valibot";

// Judgment types in order from best to worst
export const JudgmentSchema = v.picklist(["marvelous", "perfect", "great", "good", "boo", "miss"]);
export type Judgment = v.InferOutput<typeof JudgmentSchema>;

// Judgments that maintain combo
export const COMBO_JUDGMENTS: ReadonlySet<Judgment> = new Set(["marvelous", "perfect", "great"]);

// Judgment weights for accuracy calculation
export const JUDGMENT_WEIGHTS: Readonly<Record<Judgment, number>> = {
	marvelous: 100,
	perfect: 98,
	great: 65,
	good: 25,
	boo: 0,
	miss: 0,
} as const;

// Result of judging a single note
export const JudgmentResultSchema = v.object({
	judgment: JudgmentSchema,
	timingError: v.number(), // Signed error in ms (negative = early)
	beat: v.number(),
	column: v.number(),
});
export type JudgmentResult = v.InferOutput<typeof JudgmentResultSchema>;

// Current score state during gameplay
export const ScoreStateSchema = v.object({
	judgments: v.object({
		marvelous: v.pipe(v.number(), v.minValue(0)),
		perfect: v.pipe(v.number(), v.minValue(0)),
		great: v.pipe(v.number(), v.minValue(0)),
		good: v.pipe(v.number(), v.minValue(0)),
		boo: v.pipe(v.number(), v.minValue(0)),
		miss: v.pipe(v.number(), v.minValue(0)),
	}),
	combo: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
	maxCombo: v.optional(v.pipe(v.number(), v.minValue(0)), 0),
	totalNotes: v.pipe(v.number(), v.minValue(0)),
});
export type ScoreState = v.InferOutput<typeof ScoreStateSchema>;

// Grade type for scoring
export const GradeSchema = v.picklist(["AAA", "AA", "A", "B", "C", "D", "F"]);
export type Grade = v.InferOutput<typeof GradeSchema>;

// Final score after gameplay
export const FinalScoreSchema = v.object({
	judgments: v.object({
		marvelous: v.pipe(v.number(), v.minValue(0)),
		perfect: v.pipe(v.number(), v.minValue(0)),
		great: v.pipe(v.number(), v.minValue(0)),
		good: v.pipe(v.number(), v.minValue(0)),
		boo: v.pipe(v.number(), v.minValue(0)),
		miss: v.pipe(v.number(), v.minValue(0)),
	}),
	combo: v.pipe(v.number(), v.minValue(0)),
	maxCombo: v.pipe(v.number(), v.minValue(0)),
	accuracy: v.pipe(v.number(), v.minValue(0), v.maxValue(100)), // 0-100 percentage
	grade: GradeSchema,
	suggestedOffset: v.optional(v.number()), // Calibration hint: negate of mean timing error
});
export type FinalScore = v.InferOutput<typeof FinalScoreSchema>;
