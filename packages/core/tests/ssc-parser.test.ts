import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parseSM } from "../src/chart/formats/sm";

describe("SSC Parser - Per-Chart Timing", () => {
	it("parses test-per-chart-timing.ssc with timing overrides", () => {
		const content = readFileSync(
			join(__dirname, "../../../tests/fixtures/ssc-samples/test-per-chart-timing.ssc"),
			"utf-8",
		);
		const chart = parseSM(content);

		expect(chart.metadata.title).toBe("Per-Chart Timing Test");
		expect(chart.difficulties.length).toBe(4);

		// Easy uses song-level timing (no override)
		const easy = chart.difficulties.find((d) => d.name === "Easy");
		expect(easy).toBeDefined();
		expect(easy?.bpmChanges).toBeUndefined();
		expect(easy?.stops).toBeUndefined();
		expect(easy?.chartName).toBe("Easy - Song Timing");

		// Medium overrides BPM
		const medium = chart.difficulties.find((d) => d.name === "Medium");
		expect(medium).toBeDefined();
		expect(medium?.bpmChanges).toBeDefined();
		expect(medium?.bpmChanges?.[0]?.bpm).toBe(180);
		expect(medium?.chartName).toBe("Medium - Custom BPM");
		expect(medium?.displayBpm).toBe("180");

		// Hard overrides offset and has stops
		const hard = chart.difficulties.find((d) => d.name === "Hard");
		expect(hard).toBeDefined();
		expect(hard?.offset).toBe(0.025);
		expect(hard?.stops?.length).toBe(2);
		expect(hard?.stops?.[0]?.beat).toBe(4);
		expect(hard?.stops?.[0]?.duration).toBe(0.25);
		expect(hard?.chartName).toBe("Hard - Custom Offset");

		// Challenge has complex BPM changes
		const challenge = chart.difficulties.find((d) => d.name === "Challenge");
		expect(challenge).toBeDefined();
		expect(challenge?.bpmChanges?.length).toBe(4);
		expect(challenge?.bpmChanges?.[0]?.bpm).toBe(150);
		expect(challenge?.bpmChanges?.[1]?.bpm).toBe(75);
		expect(challenge?.bpmChanges?.[2]?.bpm).toBe(300);
		expect(challenge?.bpmChanges?.[3]?.bpm).toBe(150);
		expect(challenge?.displayBpm).toBe("75-300");
		expect(challenge?.timeSignatures?.length).toBe(3);
	});

	it("parses test-lifts.ssc with lift notes", () => {
		const content = readFileSync(join(__dirname, "../../../tests/fixtures/ssc-samples/test-lifts.ssc"), "utf-8");
		const chart = parseSM(content);

		expect(chart.metadata.title).toBe("Lift Test");

		const medium = chart.difficulties.find((d) => d.name === "Medium");
		expect(medium).toBeDefined();
		expect(medium?.chartName).toBe("Lift Test Chart");

		// Count lift notes
		const liftNotes = medium?.notes.filter((n) => n.noteType === "lift") ?? [];
		expect(liftNotes.length).toBeGreaterThan(0);

		// Check lift notes are at correct beats
		// Measure 2 (beats 4-7) should have lifts at 4, 5, 6, 7
		const liftsInMeasure2 = liftNotes.filter((n) => n.beat >= 4 && n.beat < 8);
		expect(liftsInMeasure2.length).toBe(4);

		// Hard chart should have per-chart timing
		const hard = chart.difficulties.find((d) => d.name === "Hard");
		expect(hard?.offset).toBe(0.05);
		expect(hard?.bpmChanges?.length).toBe(3);
		expect(hard?.stops?.length).toBe(1);
	});

	it("parses Springtime.ssc with per-chart BPM and OFFSET", () => {
		const content = readFileSync(join(__dirname, "../../../tests/fixtures/ssc-samples/Springtime.ssc"), "utf-8");
		const chart = parseSM(content);

		expect(chart.metadata.title).toBe("Springtime");
		expect(chart.metadata.artist).toBe("Kommisar");
		expect(chart.difficulties.length).toBeGreaterThan(0);

		// Check that some difficulties have per-chart BPM overrides
		const difficultiesWithBpmOverrides = chart.difficulties.filter((d) => d.bpmChanges !== undefined);
		expect(difficultiesWithBpmOverrides.length).toBeGreaterThan(0);

		// Check CHARTNAME is parsed
		const difficultiesWithChartName = chart.difficulties.filter((d) => d.chartName !== undefined);
		expect(difficultiesWithChartName.length).toBeGreaterThan(0);
	});

	it("parses L9.ssc with complex time signatures", () => {
		const content = readFileSync(join(__dirname, "../../../tests/fixtures/ssc-samples/L9.ssc"), "utf-8");
		const chart = parseSM(content);

		expect(chart.metadata.title).toBe("L9");

		// Check time signatures are parsed
		const difficulty = chart.difficulties[0];
		expect(difficulty?.timeSignatures).toBeDefined();
		expect(difficulty?.timeSignatures?.length).toBeGreaterThan(5);

		// Verify time signature structure
		const firstTimeSig = difficulty?.timeSignatures?.[0];
		expect(firstTimeSig).toBeDefined();
		expect(typeof firstTimeSig?.beat).toBe("number");
		expect(typeof firstTimeSig?.numerator).toBe("number");
		expect(typeof firstTimeSig?.denominator).toBe("number");
	});
});

describe("SSC Parser - Metadata Extraction", () => {
	it("extracts CHARTNAME from SSC sections", () => {
		const content = `
#TITLE:Test Song;
#ARTIST:Test Artist;
#BPMS:0=120;

#NOTEDATA:;
#STEPSTYPE:dance-single;
#DIFFICULTY:Medium;
#METER:5;
#CHARTNAME:My Custom Chart Name;
#NOTES:
1000
0000
0000
0000
;
`;
		const chart = parseSM(content);
		expect(chart.difficulties[0]?.chartName).toBe("My Custom Chart Name");
	});

	it("extracts CREDIT from SSC sections", () => {
		const content = `
#TITLE:Test Song;
#ARTIST:Test Artist;
#BPMS:0=120;

#NOTEDATA:;
#STEPSTYPE:dance-single;
#DIFFICULTY:Medium;
#METER:5;
#CREDIT:Chart Author;
#NOTES:
1000
0000
0000
0000
;
`;
		const chart = parseSM(content);
		expect(chart.difficulties[0]?.credit).toBe("Chart Author");
	});

	it("extracts DISPLAYBPM from SSC sections", () => {
		const content = `
#TITLE:Test Song;
#ARTIST:Test Artist;
#BPMS:0=120;

#NOTEDATA:;
#STEPSTYPE:dance-single;
#DIFFICULTY:Medium;
#METER:5;
#DISPLAYBPM:100-200;
#NOTES:
1000
0000
0000
0000
;
`;
		const chart = parseSM(content);
		expect(chart.difficulties[0]?.displayBpm).toBe("100-200");
	});

	it("extracts CHARTSTYLE from SSC sections", () => {
		const content = `
#TITLE:Test Song;
#ARTIST:Test Artist;
#BPMS:0=120;

#NOTEDATA:;
#STEPSTYPE:dance-single;
#DIFFICULTY:Medium;
#METER:5;
#CHARTSTYLE:Routine;
#NOTES:
1000
0000
0000
0000
;
`;
		const chart = parseSM(content);
		expect(chart.difficulties[0]?.chartStyle).toBe("Routine");
	});
});

describe("SSC Parser - Time Signatures", () => {
	it("parses TIMESIGNATURES with multiple changes", () => {
		const content = `
#TITLE:Test Song;
#ARTIST:Test Artist;
#BPMS:0=120;

#NOTEDATA:;
#STEPSTYPE:dance-single;
#DIFFICULTY:Medium;
#METER:5;
#TIMESIGNATURES:0.000=4=4,4.000=3=4,8.000=2=4;
#NOTES:
1000
0000
0000
0000
,
1000
0000
0000
0000
;
`;
		const chart = parseSM(content);
		const timeSigs = chart.difficulties[0]?.timeSignatures;
		expect(timeSigs?.length).toBe(3);

		expect(timeSigs?.[0]?.beat).toBe(0);
		expect(timeSigs?.[0]?.numerator).toBe(4);
		expect(timeSigs?.[0]?.denominator).toBe(4);

		expect(timeSigs?.[1]?.beat).toBe(4);
		expect(timeSigs?.[1]?.numerator).toBe(3);
		expect(timeSigs?.[1]?.denominator).toBe(4);

		expect(timeSigs?.[2]?.beat).toBe(8);
		expect(timeSigs?.[2]?.numerator).toBe(2);
		expect(timeSigs?.[2]?.denominator).toBe(4);
	});
});
