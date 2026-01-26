import * as v from "valibot";
import { describe, expect, it } from "vitest";
import { SMParseError, parseSM } from "../src/chart/formats/sm";
import { ChartLoadError, detectFormat } from "../src/chart/loader";
import { ChartSchema } from "../src/chart/model";

describe("Security and Edge Cases", () => {
	describe("BPM validation", () => {
		it("should reject BPM values above 10000", () => {
			const highBPM = `
#TITLE:High BPM;
#ARTIST:Test;
#BPMS:0=15000;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
			// Parse will succeed but validation should fail
			const chart = parseSM(highBPM);
			expect(() => v.parse(ChartSchema, chart)).toThrow();
		});

		it("should handle negative BPM values", () => {
			const negativeBPM = `
#TITLE:Negative BPM;
#ARTIST:Test;
#BPMS:0=-120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
			// Parser filters out invalid BPM, falls back to default
			const chart = parseSM(negativeBPM);
			expect(chart.bpmChanges[0]?.bpm).toBe(120); // Default fallback
		});

		it("should handle zero BPM values", () => {
			const zeroBPM = `
#TITLE:Zero BPM;
#ARTIST:Test;
#BPMS:0=0;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
			// Parser filters out BPM <= 0, falls back to default
			const chart = parseSM(zeroBPM);
			expect(chart.bpmChanges[0]?.bpm).toBe(120); // Default fallback
		});
	});

	describe("Hold note validation", () => {
		it("should handle hold tail appearing before head", () => {
			const invalidHold = `
#TITLE:Invalid Hold;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
3000
0000
2000
;
`;
			// This should parse but the hold won't be properly linked
			const chart = parseSM(invalidHold);
			const notes = chart.difficulties[0]?.notes;

			// The head at beat 2 should not have a tail reference to beat 0
			const head = notes?.find((n) => n.noteType === "hold_head");
			expect(head?.holdTailBeat).toBeUndefined(); // Tail came before, so no link
		});

		it("should handle multiple hold heads without tails", () => {
			const multipleHeads = `
#TITLE:Multiple Heads;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
2000
0000
2000
0000
3000
;
`;
			const chart = parseSM(multipleHeads);
			const notes = chart.difficulties[0]?.notes;

			// Should have 2 hold_heads
			const heads = notes?.filter((n) => n.noteType === "hold_head");
			expect(heads).toHaveLength(2);

			// Only the second head should be linked to the tail
			expect(heads?.[0]?.holdTailBeat).toBeUndefined();
			expect(heads?.[1]?.holdTailBeat).toBeCloseTo(3.2); // Linked to beat 3.2 (5 rows in measure = 4/5 = 0.8 beats per row)
		});

		it("should handle hold tail without head", () => {
			const tailNoHead = `
#TITLE:Tail No Head;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
3000
;
`;
			const chart = parseSM(tailNoHead);
			const notes = chart.difficulties[0]?.notes;

			// Tail should be filtered out, resulting in no notes
			expect(notes).toHaveLength(0);
		});
	});

	describe("Stop validation", () => {
		it("should handle negative stop duration", () => {
			const negativeStop = `
#TITLE:Negative Stop;
#ARTIST:Test;
#BPMS:0=120;
#STOPS:4.000=-1.000;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
			const chart = parseSM(negativeStop);
			// Parser filters out invalid stops (duration <= 0)
			expect(chart.stops).toHaveLength(0);
		});

		it("should handle zero stop duration", () => {
			const zeroStop = `
#TITLE:Zero Stop;
#ARTIST:Test;
#BPMS:0=120;
#STOPS:4.000=0;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
			const chart = parseSM(zeroStop);
			// Parser filters out stops with duration <= 0
			expect(chart.stops).toHaveLength(0);
		});
	});

	describe("Filename validation", () => {
		it("should reject empty filename", () => {
			expect(() => detectFormat("")).toThrow(ChartLoadError);
		});

		it("should reject filename without extension", () => {
			expect(() => detectFormat("chart")).toThrow(ChartLoadError);
		});

		it("should handle filename with multiple dots", () => {
			const format = detectFormat("my.chart.sm");
			expect(format).toBe("sm");
		});
	});

	describe("RegEx safety", () => {
		it("should handle very long tag values without hanging", () => {
			// Create a string with many non-semicolon characters
			const longValue = "A".repeat(100000);
			const sm = `
#TITLE:${longValue};
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
			// This should complete in reasonable time
			const startTime = Date.now();
			const chart = parseSM(sm);
			const elapsed = Date.now() - startTime;

			expect(chart.metadata.title).toBe(longValue);
			expect(elapsed).toBeLessThan(1000); // Should be fast
		});

		it("should handle tag values with many characters before semicolon", () => {
			const weirdValue = `test${"x".repeat(10000)}end`;
			const sm = `
#TITLE:${weirdValue};
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
			const chart = parseSM(sm);
			expect(chart.metadata.title).toBe(weirdValue);
		});
	});

	describe("Beat precision edge cases", () => {
		it("should handle very small beat values", () => {
			const sm = `
#TITLE:Small Beats;
#ARTIST:Test;
#BPMS:0.001=120;
#STOPS:0.001=0.001;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
			const chart = parseSM(sm);
			expect(chart.bpmChanges[0]?.beat).toBe(0.001);
			expect(chart.stops[0]?.beat).toBe(0.001);
			expect(chart.stops[0]?.duration).toBe(0.001);
		});

		it("should handle very large beat values", () => {
			const sm = `
#TITLE:Large Beats;
#ARTIST:Test;
#BPMS:0=120,1000000.5=180;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
			const chart = parseSM(sm);
			expect(chart.bpmChanges[1]?.beat).toBe(1000000.5);
		});
	});

	describe("Measure subdivision edge cases", () => {
		it("should handle single-row measures correctly", () => {
			const sm = `
#TITLE:Single Row;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1111
;
`;
			const chart = parseSM(sm);
			const notes = chart.difficulties[0]?.notes;

			// Single row in measure = 4 beats per row
			expect(notes).toHaveLength(4);
			expect(notes?.[0]?.beat).toBe(0);
		});

		it("should handle extremely subdivided measures", () => {
			const rows = Array(192).fill("1000").join("\n");
			const sm = `
#TITLE:Subdivided;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
${rows}
;
`;
			const chart = parseSM(sm);
			const notes = chart.difficulties[0]?.notes;

			expect(notes).toHaveLength(192);
			// 192 rows in 4 beats = 4/192 beats per row
			const beatsPerRow = 4 / 192;
			expect(notes?.[1]?.beat).toBeCloseTo(beatsPerRow);
		});
	});
});
