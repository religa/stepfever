import type { BPMChange, Note, Stop } from "../chart/model";
import { JudgmentEngine } from "../judgment/engine";
import type { SpeedModifier } from "../mods/model";
import { calculateScrollSpeed } from "../mods/speed";
import { ScoringEngine } from "../scoring/engine";
import type { FinalScore, JudgmentResult } from "../scoring/model";
import { TimingEngine } from "../timing/engine";

/**
 * Time provider interface - allows testing with virtual time
 */
export interface TimeProvider {
	getCurrentTime(): number;
}

/**
 * Real audio time provider (for browser)
 */
export class AudioTimeProvider implements TimeProvider {
	constructor(private readonly getAudioTime: () => number) {}

	getCurrentTime(): number {
		return this.getAudioTime();
	}
}

/**
 * Virtual time provider (for testing)
 */
export class VirtualTimeProvider implements TimeProvider {
	private time = 0;

	getCurrentTime(): number {
		return this.time;
	}

	setTime(time: number): void {
		this.time = time;
	}

	advance(delta: number): void {
		this.time += delta;
	}
}

/**
 * Note state during gameplay
 */
export interface NoteState {
	note: Note;
	hit: boolean;
	missed: boolean;
	judgment?: JudgmentResult;
}

/**
 * Configuration for Conductor
 */
export interface ConductorConfig {
	bpmChanges: BPMChange[];
	stops: Stop[];
	offset: number;
	notes: Note[];
	timeProvider: TimeProvider;
	globalOffset?: number;
	speedModifier?: SpeedModifier | null;
}

/**
 * Conductor - The heart of the rhythm game engine.
 *
 * CRITICAL: Audio time is the single source of truth.
 * Visual interpolation uses frame delta, but all game logic uses audio time.
 */
export class Conductor {
	private readonly timingEngine: TimingEngine;
	private readonly judgmentEngine: JudgmentEngine;
	private readonly scoringEngine: ScoringEngine;
	private readonly timeProvider: TimeProvider;

	private readonly noteStates: Map<Note, NoteState> = new Map();
	private readonly songDuration: number;
	private startTime = 0;
	private isPlaying = false;
	private pausedAt: number | null = null;
	private speedModifier: SpeedModifier | null = null;

	// Callbacks
	public onJudgment?: (result: JudgmentResult) => void;
	public onMiss?: (note: Note) => void;
	public onComboChange?: (combo: number) => void;

	constructor(config: ConductorConfig);
	constructor(
		bpmChanges: BPMChange[],
		stops: Stop[],
		offset: number,
		notes: Note[],
		timeProvider: TimeProvider,
		globalOffset?: number,
	);
	constructor(
		configOrBpmChanges: ConductorConfig | BPMChange[],
		stops?: Stop[],
		offset?: number,
		notes?: Note[],
		timeProvider?: TimeProvider,
		globalOffset?: number,
	) {
		// Parse arguments - support both config object and legacy parameters
		let config: ConductorConfig;
		if (Array.isArray(configOrBpmChanges)) {
			// Legacy constructor signature
			config = {
				bpmChanges: configOrBpmChanges,
				stops: stops ?? [],
				offset: offset ?? 0,
				notes: notes ?? [],
				timeProvider: timeProvider ?? new VirtualTimeProvider(),
				globalOffset: globalOffset ?? 0,
				speedModifier: null,
			};
		} else {
			// Config object signature
			config = configOrBpmChanges;
		}

		this.timingEngine = new TimingEngine(config.bpmChanges, config.stops, config.offset);
		this.judgmentEngine = new JudgmentEngine({ globalOffset: config.globalOffset ?? 0 });
		this.scoringEngine = new ScoringEngine(config.notes.length);
		this.timeProvider = config.timeProvider;
		this.speedModifier = config.speedModifier ?? null;

		// Initialize note states and calculate song duration
		let lastBeat = 0;
		for (const note of config.notes) {
			this.noteStates.set(note, { note, hit: false, missed: false });
			if (note.beat > lastBeat) {
				lastBeat = note.beat;
			}
		}
		// Cache song duration (time of last note + 1 beat buffer)
		this.songDuration = this.timingEngine.getAudioTimeAtBeat(lastBeat + 1);
	}

	/**
	 * Start the conductor (call when audio starts playing)
	 */
	start(): void {
		this.startTime = this.timeProvider.getCurrentTime();
		this.isPlaying = true;
	}

	/**
	 * Stop the conductor
	 */
	stop(): void {
		this.isPlaying = false;
		this.pausedAt = null;
	}

	/**
	 * Pause the conductor (preserves elapsed time)
	 */
	pause(): void {
		if (!this.isPlaying) return;
		this.pausedAt = this.getSongPosition();
		this.isPlaying = false;
	}

	/**
	 * Resume the conductor from paused state
	 */
	resume(): void {
		if (this.pausedAt === null) return;
		this.startTime = this.timeProvider.getCurrentTime() - this.pausedAt;
		this.pausedAt = null;
		this.isPlaying = true;
	}

	/**
	 * Check if conductor is currently paused
	 */
	isPaused(): boolean {
		return this.pausedAt !== null;
	}

	/**
	 * Get current song position in seconds (relative to song start)
	 * THIS IS THE SINGLE SOURCE OF TRUTH FOR GAME LOGIC
	 */
	getSongPosition(): number {
		if (this.pausedAt !== null) return this.pausedAt;
		if (!this.isPlaying) return 0;
		return this.timeProvider.getCurrentTime() - this.startTime;
	}

	/**
	 * Get current beat position
	 */
	getCurrentBeat(): number {
		return this.timingEngine.timeToBeat(this.getSongPosition());
	}

	/**
	 * Get current BPM
	 */
	getCurrentBpm(): number {
		return this.timingEngine.getBpmAtBeat(this.getCurrentBeat());
	}

	/**
	 * Check if currently in a stop
	 */
	isDuringStop(): boolean {
		return this.timingEngine.isDuringStop(this.getSongPosition());
	}

	/**
	 * Update - call every frame to check for misses
	 * @param _visualDelta - Frame delta (for visual interpolation only, not game logic)
	 */
	update(_visualDelta: number): void {
		if (!this.isPlaying) return;

		const currentTime = this.getSongPosition();

		// Check for missed notes
		for (const [note, state] of this.noteStates) {
			if (state.hit || state.missed) continue;

			const noteTime = this.timingEngine.getAudioTimeAtBeat(note.beat);
			if (this.judgmentEngine.checkMiss(noteTime, currentTime)) {
				state.missed = true;

				const result: JudgmentResult = {
					judgment: "miss",
					timingError: 0,
					beat: note.beat,
					column: note.column,
				};
				state.judgment = result;

				this.scoringEngine.recordJudgment(result);
				this.onMiss?.(note);
				this.onComboChange?.(this.scoringEngine.getCombo());
			}
		}
	}

	/**
	 * Handle player input
	 * @param column - The column that was pressed (0-3)
	 * @returns The judgment result, or null if no note was hit
	 */
	handleInput(column: number): JudgmentResult | null {
		if (!this.isPlaying) return null;

		// Validate column input
		if (!Number.isInteger(column) || column < 0) return null;

		const currentTime = this.getSongPosition();

		// Find the closest unhit note in this column that's within the hit window
		// Lift notes are excluded - they are judged on release
		let closestNote: Note | null = null;
		let closestTime = Number.POSITIVE_INFINITY;

		for (const [note, state] of this.noteStates) {
			if (state.hit || state.missed) continue;
			if (note.column !== column) continue;
			if (note.noteType === "lift") continue; // Lift notes judged on release

			const noteTime = this.timingEngine.getAudioTimeAtBeat(note.beat);
			if (!this.judgmentEngine.isInHitWindow(noteTime, currentTime)) continue;

			const diff = Math.abs(noteTime - currentTime);
			if (diff < closestTime) {
				closestTime = diff;
				closestNote = note;
			}
		}

		if (!closestNote) return null;

		const noteTime = this.timingEngine.getAudioTimeAtBeat(closestNote.beat);
		const judgment = this.judgmentEngine.judgeHit(noteTime, currentTime);

		const result: JudgmentResult = {
			judgment,
			timingError: this.judgmentEngine.getTimingError(noteTime, currentTime),
			beat: closestNote.beat,
			column: closestNote.column,
		};

		// Update state
		const state = this.noteStates.get(closestNote);
		if (state) {
			state.hit = true;
			state.judgment = result;
		}

		this.scoringEngine.recordJudgment(result);
		this.onJudgment?.(result);
		this.onComboChange?.(this.scoringEngine.getCombo());

		return result;
	}

	/**
	 * Handle player input release (for lift notes)
	 * @param column - The column that was released (0-3)
	 * @returns The judgment result, or null if no lift note was hit
	 */
	handleRelease(column: number): JudgmentResult | null {
		if (!this.isPlaying) return null;

		// Validate column input
		if (!Number.isInteger(column) || column < 0) return null;

		const currentTime = this.getSongPosition();

		// Find the closest unhit lift note in this column that's within the hit window
		let closestNote: Note | null = null;
		let closestTime = Number.POSITIVE_INFINITY;

		for (const [note, state] of this.noteStates) {
			if (state.hit || state.missed) continue;
			if (note.column !== column) continue;
			if (note.noteType !== "lift") continue; // Only lift notes

			const noteTime = this.timingEngine.getAudioTimeAtBeat(note.beat);
			if (!this.judgmentEngine.isInHitWindow(noteTime, currentTime)) continue;

			const diff = Math.abs(noteTime - currentTime);
			if (diff < closestTime) {
				closestTime = diff;
				closestNote = note;
			}
		}

		if (!closestNote) return null;

		const noteTime = this.timingEngine.getAudioTimeAtBeat(closestNote.beat);
		const judgment = this.judgmentEngine.judgeHit(noteTime, currentTime);

		const result: JudgmentResult = {
			judgment,
			timingError: this.judgmentEngine.getTimingError(noteTime, currentTime),
			beat: closestNote.beat,
			column: closestNote.column,
		};

		// Update state
		const state = this.noteStates.get(closestNote);
		if (state) {
			state.hit = true;
			state.judgment = result;
		}

		this.scoringEngine.recordJudgment(result);
		this.onJudgment?.(result);
		this.onComboChange?.(this.scoringEngine.getCombo());

		return result;
	}

	/**
	 * Get all note states (for rendering)
	 * Returns a ReadonlyMap to prevent external mutation.
	 */
	getNoteStates(): ReadonlyMap<Note, Readonly<NoteState>> {
		return this.noteStates;
	}

	/**
	 * Get notes that should be visible (within render window)
	 */
	getVisibleNotes(beatsAhead: number, beatsBehind: number): NoteState[] {
		const currentBeat = this.getCurrentBeat();
		const minBeat = currentBeat - beatsBehind;
		const maxBeat = currentBeat + beatsAhead;

		const visible: NoteState[] = [];
		for (const state of this.noteStates.values()) {
			if (state.note.beat >= minBeat && state.note.beat <= maxBeat) {
				visible.push(state);
			}
		}
		return visible;
	}

	/**
	 * Convert beat to time (for rendering)
	 */
	beatToTime(beat: number): number {
		return this.timingEngine.beatToTime(beat);
	}

	/**
	 * Get current combo
	 */
	getCombo(): number {
		return this.scoringEngine.getCombo();
	}

	/**
	 * Get current accuracy
	 */
	getAccuracy(): number {
		return this.scoringEngine.getAccuracy();
	}

	/**
	 * Check if all notes have been processed
	 */
	isComplete(): boolean {
		for (const state of this.noteStates.values()) {
			if (!state.hit && !state.missed) return false;
		}
		return true;
	}

	/**
	 * Finalize and get the score
	 */
	finalize(): FinalScore {
		return this.scoringEngine.finalize();
	}

	/**
	 * Get current scroll speed in pixels per second
	 */
	getScrollSpeed(): number {
		const currentBpm = this.getCurrentBpm();
		return calculateScrollSpeed(this.speedModifier, currentBpm);
	}

	/**
	 * Set speed modifier (can be changed during gameplay)
	 */
	setSpeedModifier(modifier: SpeedModifier | null): void {
		this.speedModifier = modifier;
	}

	/**
	 * Get current speed modifier
	 */
	getSpeedModifier(): SpeedModifier | null {
		return this.speedModifier;
	}

	/**
	 * Get total song duration in seconds (based on last note)
	 */
	getSongDuration(): number {
		return this.songDuration;
	}

	/**
	 * Get current progress as a fraction (0-1)
	 */
	getProgress(): number {
		const duration = this.getSongDuration();
		if (duration <= 0) return 0;
		const progress = this.getSongPosition() / duration;
		return Math.max(0, Math.min(1, progress));
	}
}
