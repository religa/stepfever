import * as v from "valibot";

// Note types supported in dance-single mode
export const NoteTypeSchema = v.picklist(["tap", "hold_head", "hold_tail", "roll_head", "mine", "lift", "fake"]);
export type NoteType = v.InferOutput<typeof NoteTypeSchema>;

// A single note in the chart
export const NoteSchema = v.object({
	beat: v.pipe(v.number(), v.minValue(0)),
	column: v.pipe(v.number(), v.integer(), v.minValue(0), v.maxValue(3)), // 4-key dance-single
	noteType: NoteTypeSchema,
	// For hold/roll notes, reference to the tail
	holdTailBeat: v.optional(v.pipe(v.number(), v.minValue(0))),
});
export type Note = v.InferOutput<typeof NoteSchema>;

// BPM change event
export const BPMChangeSchema = v.object({
	beat: v.pipe(v.number(), v.minValue(0)),
	bpm: v.pipe(v.number(), v.minValue(0.001), v.maxValue(10000)),
});
export type BPMChange = v.InferOutput<typeof BPMChangeSchema>;

// Stop/freeze event (pause scrolling)
export const StopSchema = v.object({
	beat: v.pipe(v.number(), v.minValue(0)),
	duration: v.pipe(v.number(), v.minValue(0.001)), // Duration in seconds
});
export type Stop = v.InferOutput<typeof StopSchema>;

// Chart metadata
export const ChartMetadataSchema = v.object({
	title: v.string(),
	subtitle: v.optional(v.string(), ""),
	artist: v.string(),
	titleTranslit: v.optional(v.string()),
	artistTranslit: v.optional(v.string()),
	credit: v.optional(v.string()),
	banner: v.optional(v.string()),
	background: v.optional(v.string()),
	music: v.optional(v.string()),
	sampleStart: v.optional(v.number()),
	sampleLength: v.optional(v.number()),
});
export type ChartMetadata = v.InferOutput<typeof ChartMetadataSchema>;

// Difficulty level
export const DifficultyNameSchema = v.picklist(["Beginner", "Easy", "Medium", "Hard", "Challenge", "Edit"]);
export type DifficultyName = v.InferOutput<typeof DifficultyNameSchema>;

// Time signature change event (SSC only)
export const TimeSignatureSchema = v.object({
	beat: v.pipe(v.number(), v.minValue(0)),
	numerator: v.pipe(v.number(), v.integer(), v.minValue(1)),
	denominator: v.pipe(v.number(), v.integer(), v.minValue(1)),
});
export type TimeSignature = v.InferOutput<typeof TimeSignatureSchema>;

// A single difficulty within a chart
export const ChartDifficultySchema = v.object({
	name: DifficultyNameSchema,
	meter: v.pipe(v.number(), v.integer(), v.minValue(1)),
	notes: v.array(NoteSchema),
	description: v.optional(v.string()),
	// Per-chart timing overrides (SSC only)
	bpmChanges: v.optional(v.array(BPMChangeSchema)),
	stops: v.optional(v.array(StopSchema)),
	offset: v.optional(v.number()),
	// SSC metadata
	chartName: v.optional(v.string()),
	credit: v.optional(v.string()),
	displayBpm: v.optional(v.string()),
	timeSignatures: v.optional(v.array(TimeSignatureSchema)),
	chartStyle: v.optional(v.string()),
});
export type ChartDifficulty = v.InferOutput<typeof ChartDifficultySchema>;

// Complete chart file
export const ChartSchema = v.object({
	metadata: ChartMetadataSchema,
	bpmChanges: v.pipe(v.array(BPMChangeSchema), v.minLength(1)),
	stops: v.optional(v.array(StopSchema), []),
	offset: v.optional(v.number(), 0), // Audio offset in seconds
	difficulties: v.array(ChartDifficultySchema),
});
export type Chart = v.InferOutput<typeof ChartSchema>;

// Song index types for local-first architecture
export interface SongIndexDifficulty {
	name: DifficultyName;
	level: number;
	chartPath: string;
	noteCount: number;
}

export interface SongIndexEntry {
	id: string;
	title: string;
	artist: string;
	titleTranslit?: string | undefined;
	artistTranslit?: string | undefined;
	bpm: number | { min: number; max: number };
	banner?: string | undefined;
	audioFile?: string | undefined;
	difficulties: SongIndexDifficulty[];
}

export interface SongIndex {
	songs: SongIndexEntry[];
	generatedAt: string;
}
