import * as v from "valibot";
import { describe, expect, it } from "vitest";
import {
	BPMChangeSchema,
	ChartSchema,
	FinalScoreSchema,
	NoteTypeSchema,
	ScoreStateSchema,
	TimingWindowSchema,
} from "../src";

describe("High/Medium Severity Issues - Validation Tests", () => {
	describe("Issue 1: ChartSchema allows empty bpmChanges array", () => {
		it("should reject charts with empty bpmChanges", () => {
			expect(() =>
				v.parse(ChartSchema, {
					metadata: {
						title: "Test",
						artist: "Test",
					},
					bpmChanges: [], // Empty array should be rejected
					difficulties: [],
				}),
			).toThrow();
		});
	});

	describe("Issue 2: Timing windows accept zero/negative durations", () => {
		it("should reject timing windows with zero marvelous window", () => {
			expect(() =>
				v.parse(TimingWindowSchema, {
					marvelous: 0, // Zero should be rejected
				}),
			).toThrow();
		});

		it("should reject timing windows with negative perfect window", () => {
			expect(() =>
				v.parse(TimingWindowSchema, {
					perfect: -0.01, // Negative should be rejected
				}),
			).toThrow();
		});
	});

	describe("Issue 3: ScoreStateSchema allows negative values", () => {
		it("should reject negative combo", () => {
			expect(() =>
				v.parse(ScoreStateSchema, {
					judgments: {
						marvelous: 0,
						perfect: 0,
						great: 0,
						good: 0,
						boo: 0,
						miss: 0,
					},
					combo: -1, // Negative should be rejected
					totalNotes: 10,
				}),
			).toThrow();
		});

		it("should reject negative maxCombo", () => {
			expect(() =>
				v.parse(ScoreStateSchema, {
					judgments: {
						marvelous: 0,
						perfect: 0,
						great: 0,
						good: 0,
						boo: 0,
						miss: 0,
					},
					maxCombo: -1, // Negative should be rejected
					totalNotes: 10,
				}),
			).toThrow();
		});

		it("should reject negative totalNotes", () => {
			expect(() =>
				v.parse(ScoreStateSchema, {
					judgments: {
						marvelous: 0,
						perfect: 0,
						great: 0,
						good: 0,
						boo: 0,
						miss: 0,
					},
					totalNotes: -1, // Negative should be rejected
				}),
			).toThrow();
		});

		it("should reject negative judgment counts", () => {
			expect(() =>
				v.parse(ScoreStateSchema, {
					judgments: {
						marvelous: -1, // Negative should be rejected
						perfect: 0,
						great: 0,
						good: 0,
						boo: 0,
						miss: 0,
					},
					totalNotes: 10,
				}),
			).toThrow();
		});
	});

	describe("Issue 4: FinalScoreSchema permits negative combos and >100 accuracy", () => {
		it("should reject negative combo", () => {
			expect(() =>
				v.parse(FinalScoreSchema, {
					judgments: {
						marvelous: 0,
						perfect: 0,
						great: 0,
						good: 0,
						boo: 0,
						miss: 0,
					},
					combo: -1, // Negative should be rejected
					maxCombo: 0,
					accuracy: 100,
					grade: "AAA",
				}),
			).toThrow();
		});

		it("should reject accuracy > 100", () => {
			expect(() =>
				v.parse(FinalScoreSchema, {
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
					accuracy: 150, // >100 should be rejected
					grade: "AAA",
				}),
			).toThrow();
		});

		it("should reject invalid grade strings", () => {
			expect(() =>
				v.parse(FinalScoreSchema, {
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
					accuracy: 100,
					grade: "SSS", // Invalid grade should be rejected
				}),
			).toThrow();
		});
	});

	describe("Issue 5: Type safety - v.record does not enforce exhaustive keys", () => {
		it("should reject ScoreState with missing judgment keys", () => {
			expect(() =>
				v.parse(ScoreStateSchema, {
					judgments: {
						marvelous: 0,
						// Missing other judgment keys
					},
					totalNotes: 10,
				}),
			).toThrow();
		});
	});

	describe("Issue 6: Missing StepMania note types", () => {
		it("should accept 'lift' note type", () => {
			const result = v.safeParse(NoteTypeSchema, "lift");
			expect(result.success).toBe(true);
		});

		it("should accept 'fake' note type", () => {
			const result = v.safeParse(NoteTypeSchema, "fake");
			expect(result.success).toBe(true);
		});
	});

	describe("Issue 7: Unbounded BPM", () => {
		it("should reject extremely high BPM", () => {
			expect(() =>
				v.parse(BPMChangeSchema, {
					beat: 0,
					bpm: 999999, // Extremely high BPM should be rejected
				}),
			).toThrow();
		});
	});
});
