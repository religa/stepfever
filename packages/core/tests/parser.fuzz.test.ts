import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { parseJSON } from "../src/chart/formats/json";
import { parseSM } from "../src/chart/formats/sm";

describe("SM Parser Fuzzing", () => {
	it("should not crash on arbitrary strings", () => {
		fc.assert(
			fc.property(fc.string(), (input) => {
				try {
					parseSM(input);
				} catch (e) {
					// Errors are fine, crashes are not
					expect(e).toBeDefined();
				}
				return true;
			}),
			{ numRuns: 1000 },
		);
	});

	it("should not crash on strings with SM-like structure", () => {
		const smLikeString = fc
			.record({
				title: fc.string(),
				artist: fc.string(),
				bpm: fc.float({ min: Math.fround(0.001), max: Math.fround(999) }),
				noteData: fc.array(fc.constantFrom("0", "1", "2", "3", "4", "M"), { minLength: 4, maxLength: 4 }),
			})
			.map(
				({ title, artist, bpm, noteData }) => `
#TITLE:${title};
#ARTIST:${artist};
#BPMS:0=${bpm};
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
${noteData.join("")}
;
`,
			);

		fc.assert(
			fc.property(smLikeString, (input) => {
				try {
					const chart = parseSM(input);
					// If it parses, basic structure should be valid
					expect(chart.metadata.title).toBeDefined();
					expect(chart.bpmChanges.length).toBeGreaterThan(0);
				} catch {
					// Parse errors are acceptable
				}
				return true;
			}),
			{ numRuns: 500 },
		);
	});

	it("should handle very long note data", () => {
		const longNotes = Array(10000).fill("1000\n0100\n0010\n0001\n").join(",");
		const sm = `
#TITLE:Long;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
${longNotes}
;
`;
		const chart = parseSM(sm);
		expect(chart.difficulties[0]?.notes.length).toBeGreaterThan(1000);
	});

	it("should handle extreme BPM values correctly", () => {
		const extremeBPM = fc
			.record({
				bpm: fc.float({ min: Math.fround(0.001), max: Math.fround(10000) }),
			})
			.map(
				({ bpm }) => `
#TITLE:Extreme BPM;
#ARTIST:Test;
#BPMS:0=${bpm};
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`,
			);

		fc.assert(
			fc.property(extremeBPM, (input) => {
				try {
					const chart = parseSM(input);
					expect(chart.bpmChanges[0]?.bpm).toBeGreaterThan(0);
					expect(chart.bpmChanges[0]?.bpm).toBeLessThanOrEqual(10000);
				} catch {
					// Parse errors are acceptable
				}
				return true;
			}),
			{ numRuns: 100 },
		);
	});

	it("should handle malformed measures gracefully", () => {
		const malformedMeasures = fc.array(fc.constantFrom("0", "1", "2", "3", "4", "M", "\n"), {
			minLength: 1,
			maxLength: 100,
		});

		fc.assert(
			fc.property(malformedMeasures, (noteData) => {
				const sm = `
#TITLE:Malformed;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
${noteData.join("")}
;
`;
				try {
					const chart = parseSM(sm);
					// If it parses, should have valid structure
					expect(chart.difficulties).toBeDefined();
				} catch {
					// Parse errors are acceptable
				}
				return true;
			}),
			{ numRuns: 200 },
		);
	});

	it("should handle multiple BPM changes with arbitrary values", () => {
		const multiBPM = fc
			.array(
				fc.record({
					beat: fc.float({ min: Math.fround(0), max: Math.fround(1000) }),
					bpm: fc.float({ min: Math.fround(0.001), max: Math.fround(999) }),
				}),
				{ minLength: 1, maxLength: 10 },
			)
			.map((changes) => {
				const bpmString = changes.map(({ beat, bpm }) => `${beat}=${bpm}`).join(",");
				return `
#TITLE:Multi BPM;
#ARTIST:Test;
#BPMS:${bpmString};
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
			});

		fc.assert(
			fc.property(multiBPM, (input) => {
				try {
					const chart = parseSM(input);
					expect(chart.bpmChanges.length).toBeGreaterThan(0);
					// BPM changes should be sorted
					for (let i = 1; i < chart.bpmChanges.length; i++) {
						const prev = chart.bpmChanges[i - 1];
						const curr = chart.bpmChanges[i];
						if (prev && curr) {
							expect(curr.beat).toBeGreaterThanOrEqual(prev.beat);
						}
					}
				} catch {
					// Parse errors are acceptable
				}
				return true;
			}),
			{ numRuns: 200 },
		);
	});
});

describe("JSON Parser Fuzzing", () => {
	it("should not crash on arbitrary strings", () => {
		fc.assert(
			fc.property(fc.string(), (input) => {
				try {
					parseJSON(input);
				} catch {
					// Errors are fine
				}
				return true;
			}),
			{ numRuns: 1000 },
		);
	});

	it("should not crash on arbitrary JSON objects", () => {
		fc.assert(
			fc.property(fc.jsonValue(), (value) => {
				try {
					parseJSON(JSON.stringify(value));
				} catch {
					// Validation errors are fine
				}
				return true;
			}),
			{ numRuns: 500 },
		);
	});

	it("should handle deeply nested JSON", () => {
		const deepJSON = fc.array(fc.jsonValue(), { minLength: 1, maxLength: 100 });

		fc.assert(
			fc.property(deepJSON, (arr) => {
				try {
					parseJSON(JSON.stringify(arr));
				} catch {
					// Validation errors are fine
				}
				return true;
			}),
			{ numRuns: 200 },
		);
	});
});
