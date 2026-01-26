import { describe, expect, it } from "vitest";
import { JSONParseError, exportJSON, parseJSON } from "../src/chart/formats/json";
import { SMParseError, parseSM } from "../src/chart/formats/sm";
import { ChartLoadError, loadChart } from "../src/chart/loader";

const MINIMAL_SM = `
#TITLE:Test Song;
#ARTIST:Test Artist;
#BPMS:0.000=120.000;
#OFFSET:0.000;
#NOTES:
     dance-single:
     :
     Medium:
     5:
     0.000,0.000,0.000,0.000,0.000:
1000
0100
0010
0001
;
`;

describe("SM Parser", () => {
	it("should parse minimal SM file", () => {
		const chart = parseSM(MINIMAL_SM);

		expect(chart.metadata.title).toBe("Test Song");
		expect(chart.metadata.artist).toBe("Test Artist");
		expect(chart.bpmChanges).toHaveLength(1);
		expect(chart.bpmChanges[0]).toEqual({ beat: 0, bpm: 120 });
		expect(chart.difficulties).toHaveLength(1);
		expect(chart.difficulties[0]?.notes).toHaveLength(4);
	});

	it("should parse note positions correctly", () => {
		const chart = parseSM(MINIMAL_SM);
		const notes = chart.difficulties[0]?.notes;

		expect(notes?.[0]).toMatchObject({ beat: 0, column: 0, noteType: "tap" });
		expect(notes?.[1]).toMatchObject({ beat: 1, column: 1, noteType: "tap" });
		expect(notes?.[2]).toMatchObject({ beat: 2, column: 2, noteType: "tap" });
		expect(notes?.[3]).toMatchObject({ beat: 3, column: 3, noteType: "tap" });
	});

	it("should throw SMParseError for files with no charts", () => {
		const noCharts = `
#TITLE:Empty;
#ARTIST:Test;
#BPMS:0=120;
`;
		expect(() => parseSM(noCharts)).toThrow(SMParseError);
	});

	it("should handle malformed BPM gracefully", () => {
		const badBPM = `
#TITLE:Test;
#ARTIST:Test;
#BPMS:invalid;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
		const chart = parseSM(badBPM);
		expect(chart.bpmChanges).toEqual([{ beat: 0, bpm: 120 }]); // Default fallback
	});

	it("should parse hold notes correctly", () => {
		const holdSM = `
#TITLE:Hold Test;
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
0000
3000
;
`;
		const chart = parseSM(holdSM);
		const notes = chart.difficulties[0]?.notes;

		expect(notes).toHaveLength(1); // Only head, tail is filtered out
		expect(notes?.[0]?.noteType).toBe("hold_head");
		expect(notes?.[0]?.holdTailBeat).toBe(3);
	});

	it("should parse multiple BPM changes", () => {
		const multiBPM = `
#TITLE:Multi BPM;
#ARTIST:Test;
#BPMS:0.000=120.000,4.000=180.000,8.000=90.000;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
		const chart = parseSM(multiBPM);
		expect(chart.bpmChanges).toHaveLength(3);
		expect(chart.bpmChanges[0]).toEqual({ beat: 0, bpm: 120 });
		expect(chart.bpmChanges[1]).toEqual({ beat: 4, bpm: 180 });
		expect(chart.bpmChanges[2]).toEqual({ beat: 8, bpm: 90 });
	});

	it("should parse stops", () => {
		const stopSM = `
#TITLE:Stop Test;
#ARTIST:Test;
#BPMS:0=120;
#STOPS:4.000=1.000,8.000=2.000;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
		const chart = parseSM(stopSM);
		expect(chart.stops).toHaveLength(2);
		expect(chart.stops[0]).toEqual({ beat: 4, duration: 1 });
		expect(chart.stops[1]).toEqual({ beat: 8, duration: 2 });
	});

	it("should parse multiple difficulties", () => {
		const multiDiff = `
#TITLE:Multi Difficulty;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Easy:
     3:
     :
1000
;
#NOTES:
     dance-single:
     :
     Hard:
     8:
     :
1111
;
`;
		const chart = parseSM(multiDiff);
		expect(chart.difficulties).toHaveLength(2);
		expect(chart.difficulties[0]?.name).toBe("Easy");
		expect(chart.difficulties[0]?.meter).toBe(3);
		expect(chart.difficulties[1]?.name).toBe("Hard");
		expect(chart.difficulties[1]?.meter).toBe(8);
	});

	it("should normalize difficulty names", () => {
		const diffNames = `
#TITLE:Difficulty Names;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Beginner:
     1:
     :
1000
;
#NOTES:
     dance-single:
     :
     Light:
     3:
     :
1000
;
#NOTES:
     dance-single:
     :
     Heavy:
     7:
     :
1000
;
#NOTES:
     dance-single:
     :
     Expert:
     9:
     :
1000
;
`;
		const chart = parseSM(diffNames);
		expect(chart.difficulties[0]?.name).toBe("Beginner");
		expect(chart.difficulties[1]?.name).toBe("Easy"); // Light → Easy
		expect(chart.difficulties[2]?.name).toBe("Hard"); // Heavy → Hard
		expect(chart.difficulties[3]?.name).toBe("Challenge"); // Expert → Challenge
	});

	it("should skip non-dance-single charts", () => {
		const pumpChart = `
#TITLE:Pump Chart;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     pump-single:
     :
     Medium:
     5:
     :
10000
;
`;
		// Should throw because no valid dance-single charts found
		expect(() => parseSM(pumpChart)).toThrow(SMParseError);
		expect(() => parseSM(pumpChart)).toThrow("No valid dance-single charts found");
	});

	it("should parse mines correctly", () => {
		const mineSM = `
#TITLE:Mine Test;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
M000
;
`;
		const chart = parseSM(mineSM);
		const notes = chart.difficulties[0]?.notes;

		expect(notes).toHaveLength(1);
		expect(notes?.[0]?.noteType).toBe("mine");
	});

	it("should parse lift notes correctly", () => {
		const liftSM = `
#TITLE:Lift Test;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
L000
;
`;
		const chart = parseSM(liftSM);
		const notes = chart.difficulties[0]?.notes;

		expect(notes).toHaveLength(1);
		expect(notes?.[0]?.noteType).toBe("lift");
	});

	it("should parse fake notes correctly", () => {
		const fakeSM = `
#TITLE:Fake Test;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
F000
;
`;
		const chart = parseSM(fakeSM);
		const notes = chart.difficulties[0]?.notes;

		expect(notes).toHaveLength(1);
		expect(notes?.[0]?.noteType).toBe("fake");
	});

	it("should parse offset correctly", () => {
		const offsetSM = `
#TITLE:Offset Test;
#ARTIST:Test;
#BPMS:0=120;
#OFFSET:-0.5;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
;
`;
		const chart = parseSM(offsetSM);
		expect(chart.offset).toBe(-0.5);
	});

	it("should handle subdivided measures correctly", () => {
		const subdivided = `
#TITLE:Subdivided;
#ARTIST:Test;
#BPMS:0=120;
#NOTES:
     dance-single:
     :
     Medium:
     1:
     :
1000
0100
0010
0001
0100
0010
0001
1000
;
`;
		const chart = parseSM(subdivided);
		const notes = chart.difficulties[0]?.notes;

		expect(notes).toHaveLength(8);
		// 8 rows in a 4-beat measure = 0.5 beats per row
		expect(notes?.[0]?.beat).toBe(0);
		expect(notes?.[1]?.beat).toBe(0.5);
		expect(notes?.[2]?.beat).toBe(1);
		expect(notes?.[3]?.beat).toBe(1.5);
	});
});

describe("JSON round-trip", () => {
	it("should preserve chart data through export/import", () => {
		const original = parseSM(MINIMAL_SM);
		const json = exportJSON(original);
		const restored = parseJSON(json);

		expect(restored.metadata.title).toBe(original.metadata.title);
		expect(restored.bpmChanges).toEqual(original.bpmChanges);
		expect(restored.difficulties[0]?.notes).toEqual(original.difficulties[0]?.notes);
	});

	it("should throw JSONParseError for invalid JSON", () => {
		expect(() => parseJSON("not json")).toThrow(JSONParseError);
	});

	it("should throw JSONParseError for invalid schema", () => {
		expect(() => parseJSON('{"invalid": true}')).toThrow(JSONParseError);
	});

	it("should export pretty JSON by default", () => {
		const original = parseSM(MINIMAL_SM);
		const json = exportJSON(original);

		expect(json).toContain("\n");
		expect(json).toContain("  ");
	});

	it("should export compact JSON when pretty=false", () => {
		const original = parseSM(MINIMAL_SM);
		const json = exportJSON(original, false);

		expect(json).not.toContain("\n  ");
	});
});

describe("Chart loader", () => {
	it("should load SM file correctly", () => {
		const chart = loadChart(MINIMAL_SM, "test.sm");

		expect(chart.metadata.title).toBe("Test Song");
	});

	it("should load JSON file correctly", () => {
		const original = parseSM(MINIMAL_SM);
		const json = exportJSON(original);
		const chart = loadChart(json, "test.json");

		expect(chart.metadata.title).toBe("Test Song");
	});

	it("should throw ChartLoadError for unknown format", () => {
		expect(() => loadChart("", "test.txt")).toThrow(ChartLoadError);
	});

	it("should detect SM format", () => {
		const chart = loadChart(MINIMAL_SM, "test.sm");
		expect(chart).toBeDefined();
	});

	it("should detect SSC format (parsed as SM)", () => {
		const chart = loadChart(MINIMAL_SM, "test.ssc");
		expect(chart).toBeDefined();
	});

	it("should throw ChartLoadError with cause", () => {
		try {
			loadChart("invalid json", "test.json");
		} catch (error) {
			expect(error).toBeInstanceOf(ChartLoadError);
			if (error instanceof ChartLoadError) {
				expect(error.cause).toBeInstanceOf(JSONParseError);
			}
		}
	});
});
