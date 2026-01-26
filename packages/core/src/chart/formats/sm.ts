import type { BPMChange, Chart, ChartDifficulty, ChartMetadata, Note, NoteType, Stop, TimeSignature } from "../model";

// SM note characters
const NOTE_CHARS: Record<string, NoteType | null> = {
	"0": null, // No note
	"1": "tap",
	"2": "hold_head",
	"3": "hold_tail",
	"4": "roll_head",
	M: "mine",
	L: "lift",
	F: "fake",
};

export class SMParseError extends Error {
	constructor(
		message: string,
		public readonly line?: number,
		public readonly context?: string,
	) {
		super(message);
		this.name = "SMParseError";
	}
}

export function parseSM(content: string): Chart {
	try {
		const metadata = parseMetadata(content);
		const bpmChanges = parseBPMChanges(content);
		const stops = parseStops(content);
		const offset = parseOffset(content);
		const difficulties = parseDifficulties(content);

		if (difficulties.length === 0) {
			throw new SMParseError("No valid dance-single charts found");
		}

		return {
			metadata,
			bpmChanges,
			stops,
			offset,
			difficulties,
		};
	} catch (error) {
		if (error instanceof SMParseError) throw error;
		throw new SMParseError(`Failed to parse SM file: ${error}`);
	}
}

function parseMetadata(content: string): ChartMetadata {
	const getValue = (tag: string): string | undefined => {
		const match = content.match(new RegExp(`#${tag}:([^;]*);`, "i"));
		return match?.[1]?.trim();
	};

	const getNumber = (tag: string): number | undefined => {
		const val = getValue(tag);
		if (val === undefined) return undefined;
		const num = Number.parseFloat(val);
		return Number.isNaN(num) ? undefined : num;
	};

	return {
		title: getValue("TITLE") ?? "Unknown",
		subtitle: getValue("SUBTITLE") ?? "",
		artist: getValue("ARTIST") ?? "Unknown",
		titleTranslit: getValue("TITLETRANSLIT"),
		artistTranslit: getValue("ARTISTTRANSLIT"),
		credit: getValue("CREDIT"),
		banner: getValue("BANNER"),
		background: getValue("BACKGROUND"),
		music: getValue("MUSIC"),
		sampleStart: getNumber("SAMPLESTART"),
		sampleLength: getNumber("SAMPLELENGTH"),
	};
}

function parseBPMChanges(content: string): BPMChange[] {
	const match = content.match(/#BPMS:([^;]*);/i);
	if (!match?.[1]?.trim()) return [{ beat: 0, bpm: 120 }];

	const changes = match[1]
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.includes("="))
		.map((entry) => {
			const [beatStr, bpmStr] = entry.split("=");
			const beat = Number.parseFloat(beatStr?.trim() ?? "");
			const bpm = Number.parseFloat(bpmStr?.trim() ?? "");

			if (Number.isNaN(beat) || Number.isNaN(bpm) || bpm <= 0) {
				return null;
			}
			return { beat, bpm };
		})
		.filter((x): x is BPMChange => x !== null)
		.sort((a, b) => a.beat - b.beat);

	return changes.length > 0 ? changes : [{ beat: 0, bpm: 120 }];
}

function parseStops(content: string): Stop[] {
	const match = content.match(/#STOPS:([^;]*);/i);
	if (!match?.[1]?.trim()) return [];

	return match[1]
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.includes("="))
		.map((entry) => {
			const [beatStr, durationStr] = entry.split("=");
			const beat = Number.parseFloat(beatStr?.trim() ?? "");
			const duration = Number.parseFloat(durationStr?.trim() ?? "");

			if (Number.isNaN(beat) || Number.isNaN(duration) || duration <= 0) {
				return null;
			}
			return { beat, duration };
		})
		.filter((x): x is Stop => x !== null)
		.sort((a, b) => a.beat - b.beat);
}

function parseOffset(content: string): number {
	const match = content.match(/#OFFSET:([^;]*);/i);
	if (!match?.[1]) return 0;
	const offset = Number.parseFloat(match[1]);
	return Number.isNaN(offset) ? 0 : offset;
}

function parseDifficulties(content: string): ChartDifficulty[] {
	const difficulties: ChartDifficulty[] = [];

	// Try SSC format first (#NOTEDATA:)
	const sscSections = content.split(/#NOTEDATA:/gi);
	if (sscSections.length > 1) {
		// SSC format detected
		for (let i = 1; i < sscSections.length; i++) {
			const section = sscSections[i];
			if (!section) continue;

			// Warn about unsupported features
			warnUnsupportedTags(section);

			// Extract SSC tags
			const stepsTypeMatch = section.match(/#STEPSTYPE:([^;]*);/i);
			const difficultyMatch = section.match(/#DIFFICULTY:([^;]*);/i);
			const meterMatch = section.match(/#METER:([^;]*);/i);
			// Match both #NOTES: and #NOTES2: (keysound format)
			const notesMatch = section.match(/#NOTES2?:([\s\S]*?)(?=#NOTEDATA:|$)/i);

			const stepsType = stepsTypeMatch?.[1]?.trim().toLowerCase();
			const difficultyName = difficultyMatch?.[1]?.trim();
			const meterStr = meterMatch?.[1]?.trim();
			const noteData = notesMatch?.[1]?.trim();

			// Only support dance-single
			if (stepsType !== "dance-single") continue;
			if (!noteData) continue;

			const meter = Number.parseInt(meterStr ?? "1", 10);
			const notes = parseNoteData(noteData);

			// Extract per-chart timing overrides (SSC only)
			const chartBpms = extractBPMChanges(section);
			const chartStops = extractStops(section);
			const chartOffset = extractOffset(section);

			// Extract SSC metadata
			const chartName = extractStringTag(section, "CHARTNAME");
			const credit = extractStringTag(section, "CREDIT");
			const displayBpm = extractStringTag(section, "DISPLAYBPM");
			const timeSignatures = extractTimeSignatures(section);
			const chartStyle = extractStringTag(section, "CHARTSTYLE");

			difficulties.push({
				name: normalizeDifficultyName(difficultyName ?? "Medium"),
				meter: Number.isNaN(meter) || meter < 1 ? 1 : meter,
				notes,
				// Timing overrides (only if present)
				bpmChanges: chartBpms.length > 0 ? chartBpms : undefined,
				stops: chartStops.length > 0 ? chartStops : undefined,
				offset: chartOffset,
				// Metadata
				chartName,
				credit,
				displayBpm,
				timeSignatures: timeSignatures.length > 0 ? timeSignatures : undefined,
				chartStyle,
			});
		}
	} else {
		// SM format (#NOTES:)
		const notesSections = content.matchAll(/#NOTES:([^;]*);/gi);

		for (const match of notesSections) {
			const section = match[1];
			if (!section) continue;

			const lines = section
				.split("\n")
				.map((l) => l.trim())
				.filter((l) => l && !l.startsWith("//"));

			if (lines.length < 5) continue;

			// Parse header: type, description, difficulty, meter, groove radar
			const type = lines[0]?.replace(/:$/, "").trim().toLowerCase();
			const description = lines[1]?.replace(/:$/, "").trim();
			const difficultyName = lines[2]?.replace(/:$/, "").trim();
			const meterStr = lines[3]?.replace(/:$/, "").trim();

			// Only support dance-single
			if (type !== "dance-single") continue;

			const meter = Number.parseInt(meterStr ?? "1", 10);

			// Parse note data (everything after the 5 header lines)
			const noteData = lines.slice(5).join("\n");
			const notes = parseNoteData(noteData);

			difficulties.push({
				name: normalizeDifficultyName(difficultyName ?? "Medium"),
				meter: Number.isNaN(meter) || meter < 1 ? 1 : meter,
				notes,
				description: description || undefined,
			});
		}
	}

	return difficulties;
}

function parseNoteData(data: string): Note[] {
	const notes: Note[] = [];
	const measures = data.split(",").map((m) => m.trim());

	let currentBeat = 0;

	for (const measure of measures) {
		const rows = measure
			.split("\n")
			.map((r) => r.trim())
			.filter((r) => r && !r.startsWith("//") && r.length >= 4);

		if (rows.length === 0) {
			currentBeat += 4; // Empty measure = 4 beats
			continue;
		}

		const beatsPerRow = 4 / rows.length; // 4 beats per measure

		for (const row of rows) {
			const columns = row.split("");
			for (let col = 0; col < Math.min(columns.length, 4); col++) {
				const char = columns[col];
				if (char === undefined) continue;
				const noteType = NOTE_CHARS[char];
				if (noteType) {
					notes.push({
						beat: currentBeat,
						column: col,
						noteType,
					});
				}
			}
			currentBeat += beatsPerRow;
		}
	}

	// Link hold heads to tails
	return linkHolds(notes);
}

function linkHolds(notes: Note[]): Note[] {
	// Group by column to find head-tail pairs
	const byColumn = new Map<number, Note[]>();
	for (const note of notes) {
		const col = byColumn.get(note.column) ?? [];
		col.push(note);
		byColumn.set(note.column, col);
	}

	for (const columnNotes of byColumn.values()) {
		columnNotes.sort((a, b) => a.beat - b.beat);

		let openHold: Note | null = null;
		for (const note of columnNotes) {
			if (note.noteType === "hold_head" || note.noteType === "roll_head") {
				openHold = note;
			} else if (note.noteType === "hold_tail" && openHold) {
				openHold.holdTailBeat = note.beat;
				openHold = null;
			}
		}
	}

	// Filter out hold_tail notes (info is now in hold_head)
	return notes.filter((n) => n.noteType !== "hold_tail");
}

function normalizeDifficultyName(name: string): ChartDifficulty["name"] {
	const normalized = name.toLowerCase();
	const mapping: Record<string, ChartDifficulty["name"]> = {
		beginner: "Beginner",
		easy: "Easy",
		basic: "Easy",
		light: "Easy",
		medium: "Medium",
		another: "Medium",
		trick: "Medium",
		hard: "Hard",
		maniac: "Hard",
		heavy: "Hard",
		challenge: "Challenge",
		expert: "Challenge",
		oni: "Challenge",
		edit: "Edit",
	};
	return mapping[normalized] ?? "Medium";
}

// Helper for extracting SSC per-chart BPM changes
function extractBPMChanges(content: string): BPMChange[] {
	const match = content.match(/#BPMS:([^;]*);/i);
	if (!match?.[1]?.trim()) return [];

	return match[1]
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.includes("="))
		.map((entry) => {
			const [beatStr, bpmStr] = entry.split("=");
			const beat = Number.parseFloat(beatStr?.trim() ?? "");
			const bpm = Number.parseFloat(bpmStr?.trim() ?? "");

			if (Number.isNaN(beat) || Number.isNaN(bpm) || bpm <= 0) {
				return null;
			}
			return { beat, bpm };
		})
		.filter((x): x is BPMChange => x !== null)
		.sort((a, b) => a.beat - b.beat);
}

// Helper for extracting SSC per-chart stops
function extractStops(content: string): Stop[] {
	const match = content.match(/#STOPS:([^;]*);/i);
	if (!match?.[1]?.trim()) return [];

	return match[1]
		.split(",")
		.map((entry) => entry.trim())
		.filter((entry) => entry.includes("="))
		.map((entry) => {
			const [beatStr, durationStr] = entry.split("=");
			const beat = Number.parseFloat(beatStr?.trim() ?? "");
			const duration = Number.parseFloat(durationStr?.trim() ?? "");

			if (Number.isNaN(beat) || Number.isNaN(duration) || duration <= 0) {
				return null;
			}
			return { beat, duration };
		})
		.filter((x): x is Stop => x !== null)
		.sort((a, b) => a.beat - b.beat);
}

// Helper for extracting SSC per-chart offset
function extractOffset(content: string): number | undefined {
	const match = content.match(/#OFFSET:([^;]+);/i);
	if (!match?.[1]) return undefined;
	const offset = Number.parseFloat(match[1].trim());
	return Number.isNaN(offset) ? undefined : offset;
}

// Helper for extracting SSC string tags
function extractStringTag(content: string, tag: string): string | undefined {
	const match = content.match(new RegExp(`#${tag}:([^;]*);`, "i"));
	const value = match?.[1]?.trim();
	return value || undefined;
}

// Helper for extracting SSC time signatures
// Format: beat=numerator=denominator (e.g., "0.000=4=4,4.000=3=4")
function extractTimeSignatures(content: string): TimeSignature[] {
	const match = content.match(/#TIMESIGNATURES:([^;]*);/i);
	if (!match?.[1]?.trim()) return [];

	return match[1]
		.split(",")
		.map((entry) => {
			const parts = entry.trim().split("=");
			if (parts.length < 3) return null;

			const beat = Number.parseFloat(parts[0] ?? "");
			const numerator = Number.parseInt(parts[1] ?? "", 10);
			const denominator = Number.parseInt(parts[2] ?? "", 10);

			if (Number.isNaN(beat) || Number.isNaN(numerator) || Number.isNaN(denominator)) {
				return null;
			}

			return {
				beat,
				numerator: numerator || 4,
				denominator: denominator || 4,
			};
		})
		.filter((ts): ts is TimeSignature => ts !== null);
}

// Warn about unsupported SSC features
const WARN_TAGS = ["WARPS", "FAKES", "SCROLLS", "LABELS", "COMBOS", "ATTACKS"];
function warnUnsupportedTags(section: string): void {
	for (const tag of WARN_TAGS) {
		if (section.includes(`#${tag}:`)) {
			console.warn(`SSC feature #${tag} not supported, ignoring`);
		}
	}
}
