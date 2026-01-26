import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { COMBO_JUDGMENTS, ChartSchema, JUDGMENT_WEIGHTS, JudgmentSchema, NoteSchema, NoteTypeSchema } from "../src";

describe("Note model", () => {
	it("should validate a tap note", () => {
		const note = v.parse(NoteSchema, {
			beat: 4.0,
			column: 0,
			noteType: "tap",
		});
		expect(note.beat).toBe(4.0);
		expect(note.column).toBe(0);
		expect(note.noteType).toBe("tap");
	});

	it("should reject invalid column", () => {
		expect(() =>
			v.parse(NoteSchema, {
				beat: 0,
				column: 5, // Invalid: must be 0-3
				noteType: "tap",
			}),
		).toThrow();
	});

	it("should reject negative beat", () => {
		expect(() =>
			v.parse(NoteSchema, {
				beat: -1,
				column: 0,
				noteType: "tap",
			}),
		).toThrow();
	});
});

describe("NoteType enum", () => {
	it("should have all expected values", () => {
		expect(NoteTypeSchema.options).toContain("tap");
		expect(NoteTypeSchema.options).toContain("hold_head");
		expect(NoteTypeSchema.options).toContain("hold_tail");
		expect(NoteTypeSchema.options).toContain("mine");
	});
});

describe("Judgment constants", () => {
	it("should have correct combo judgments", () => {
		expect(COMBO_JUDGMENTS.has("marvelous")).toBe(true);
		expect(COMBO_JUDGMENTS.has("perfect")).toBe(true);
		expect(COMBO_JUDGMENTS.has("great")).toBe(true);
		expect(COMBO_JUDGMENTS.has("good")).toBe(false);
		expect(COMBO_JUDGMENTS.has("miss")).toBe(false);
	});

	it("should have weights for all judgments", () => {
		for (const j of JudgmentSchema.options) {
			expect(JUDGMENT_WEIGHTS[j]).toBeDefined();
		}
	});

	it("should have marvelous as highest weight", () => {
		expect(JUDGMENT_WEIGHTS.marvelous).toBe(100);
		expect(JUDGMENT_WEIGHTS.perfect).toBeLessThan(JUDGMENT_WEIGHTS.marvelous);
	});
});
