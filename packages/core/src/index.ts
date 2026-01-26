// Chart models
export {
	NoteTypeSchema,
	NoteSchema,
	BPMChangeSchema,
	ChartSchema,
	type NoteType,
	type Note,
	type BPMChange,
	type Stop,
	type ChartMetadata,
	type DifficultyName,
	type TimeSignature,
	type ChartDifficulty,
	type Chart,
	type SongIndexEntry,
	type SongIndexDifficulty,
	type SongIndex,
} from "./chart/model";

// Chart parsers and loaders
export {
	parseSM,
	SMParseError,
} from "./chart/formats/sm";

export {
	parseJSON,
	exportJSON,
	JSONParseError,
} from "./chart/formats/json";

export {
	loadChart,
	detectFormat,
	ChartLoadError,
} from "./chart/loader";

// Timing models
export {
	TimingWindowSchema,
	type TimingWindow,
	type TimingConfig,
} from "./timing/model";

// Timing engine
export { TimingEngine } from "./timing/engine";

// Scoring models
export {
	JudgmentSchema,
	ScoreStateSchema,
	FinalScoreSchema,
	GradeSchema,
	COMBO_JUDGMENTS,
	JUDGMENT_WEIGHTS,
	type Judgment,
	type JudgmentResult,
	type ScoreState,
	type FinalScore,
	type Grade,
} from "./scoring/model";

// Judgment engine
export { JudgmentEngine } from "./judgment/engine";

// Scoring engine
export { ScoringEngine } from "./scoring/engine";

// Conductor (audio-visual sync)
export {
	Conductor,
	AudioTimeProvider,
	VirtualTimeProvider,
	type TimeProvider,
	type NoteState,
} from "./conductor/conductor";

// Input / Controller models
export {
	CONTROLLER_PRESETS,
	getControllerPreset,
	getAllPresets,
	type ControllerConfig,
} from "./input/model";

// Speed modifiers
export type {
	XMod,
	CMod,
	SpeedModifier,
} from "./mods/model";

export {
	calculateScrollSpeed,
	calculateVisibilityWindow,
	SPEED_PRESETS,
} from "./mods/speed";
