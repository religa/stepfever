import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BPMChange, Note } from "../src/chart/model";
import { Conductor, type NoteState, VirtualTimeProvider } from "../src/conductor/conductor";

describe("Conductor", () => {
	let timeProvider: VirtualTimeProvider;
	let conductor: Conductor;

	const defaultBpm: BPMChange[] = [{ beat: 0, bpm: 120 }];
	const defaultNotes: Note[] = [
		{ beat: 0, column: 0, noteType: "tap" },
		{ beat: 1, column: 1, noteType: "tap" },
		{ beat: 2, column: 2, noteType: "tap" },
		{ beat: 3, column: 3, noteType: "tap" },
	];

	beforeEach(() => {
		timeProvider = new VirtualTimeProvider();
		conductor = new Conductor(defaultBpm, [], 0, defaultNotes, timeProvider);
	});

	describe("timing", () => {
		it("should report song position from audio time", () => {
			conductor.start();
			expect(conductor.getSongPosition()).toBe(0);

			timeProvider.advance(1.0);
			expect(conductor.getSongPosition()).toBe(1.0);

			timeProvider.advance(0.5);
			expect(conductor.getSongPosition()).toBe(1.5);
		});

		it("should convert time to beat correctly at 120 BPM", () => {
			conductor.start();

			// 120 BPM = 0.5 seconds per beat
			timeProvider.setTime(0);
			expect(conductor.getCurrentBeat()).toBe(0);

			timeProvider.setTime(0.5);
			expect(conductor.getCurrentBeat()).toBe(1);

			timeProvider.setTime(1.0);
			expect(conductor.getCurrentBeat()).toBe(2);
		});

		it("should return current BPM", () => {
			conductor.start();
			expect(conductor.getCurrentBpm()).toBe(120);
		});
	});

	describe("input handling", () => {
		it("should return marvelous for exact hit", () => {
			conductor.start();

			// Note at beat 0 = time 0
			timeProvider.setTime(0);
			const result = conductor.handleInput(0);

			expect(result).not.toBeNull();
			expect(result?.judgment).toBe("marvelous");
			expect(result?.column).toBe(0);
		});

		it("should return correct judgment for late hit", () => {
			conductor.start();

			// Note at beat 0 = time 0, hit at 50ms late
			// 50ms > 45ms (perfect window), so should be great
			timeProvider.setTime(0.05);
			const result = conductor.handleInput(0);

			expect(result?.judgment).toBe("great");
		});

		it("should not hit same note twice", () => {
			conductor.start();
			timeProvider.setTime(0);

			const first = conductor.handleInput(0);
			const second = conductor.handleInput(0);

			expect(first).not.toBeNull();
			expect(second).toBeNull();
		});

		it("should not hit note in wrong column", () => {
			conductor.start();
			timeProvider.setTime(0);

			// Note is in column 0, press column 1
			const result = conductor.handleInput(1);
			expect(result).toBeNull();
		});

		it("should hit closest note when multiple in window", () => {
			const closeNotes: Note[] = [
				{ beat: 0, column: 0, noteType: "tap" },
				{ beat: 0.5, column: 0, noteType: "tap" }, // 0.25 seconds later at 120 BPM
			];

			conductor = new Conductor(defaultBpm, [], 0, closeNotes, timeProvider);
			conductor.start();

			// At time 0.1 (closer to beat 0 than beat 0.5)
			timeProvider.setTime(0.1);
			const result = conductor.handleInput(0);

			expect(result?.beat).toBe(0);
		});

		it("should not hit notes outside hit window", () => {
			conductor.start();

			// Note at beat 0 = time 0
			// Hit window is ±180ms (boo window)
			timeProvider.setTime(0.2); // 200ms late - outside window
			const result = conductor.handleInput(0);

			expect(result).toBeNull();
		});
	});

	describe("miss detection", () => {
		it("should detect miss after boo window", () => {
			const onMiss = vi.fn();
			conductor.onMiss = onMiss;
			conductor.start();

			// Note at beat 0 = time 0
			// Boo window = 180ms
			// At 181ms, should be missed
			timeProvider.setTime(0.181);
			conductor.update(0);

			expect(onMiss).toHaveBeenCalledTimes(1);
		});

		it("should not double-miss a note", () => {
			const onMiss = vi.fn();
			conductor.onMiss = onMiss;
			conductor.start();

			timeProvider.setTime(0.2);
			conductor.update(0);
			conductor.update(0);
			conductor.update(0);

			expect(onMiss).toHaveBeenCalledTimes(1);
		});

		it("should not miss a note before boo window expires", () => {
			const onMiss = vi.fn();
			conductor.onMiss = onMiss;
			conductor.start();

			// Still within boo window
			timeProvider.setTime(0.17);
			conductor.update(0);

			expect(onMiss).not.toHaveBeenCalled();
		});
	});

	describe("scoring integration", () => {
		it("should track combo", () => {
			const onComboChange = vi.fn();
			conductor.onComboChange = onComboChange;
			conductor.start();

			// Hit all 4 notes perfectly
			for (let i = 0; i < 4; i++) {
				timeProvider.setTime(i * 0.5); // Notes at beats 0, 1, 2, 3
				conductor.handleInput(i);
			}

			expect(conductor.getCombo()).toBe(4);
			expect(onComboChange).toHaveBeenLastCalledWith(4);
		});

		it("should reset combo on miss", () => {
			conductor.start();

			// Hit first note
			timeProvider.setTime(0);
			conductor.handleInput(0);
			expect(conductor.getCombo()).toBe(1);

			// Miss second note
			timeProvider.setTime(1.0); // Way past beat 1
			conductor.update(0);

			expect(conductor.getCombo()).toBe(0);
		});

		it("should calculate accuracy correctly", () => {
			conductor.start();

			// Hit all 4 notes with marvelous
			for (let i = 0; i < 4; i++) {
				timeProvider.setTime(i * 0.5);
				conductor.handleInput(i);
			}

			expect(conductor.getAccuracy()).toBe(100);
		});

		it("should invoke onJudgment callback", () => {
			const onJudgment = vi.fn();
			conductor.onJudgment = onJudgment;
			conductor.start();

			timeProvider.setTime(0);
			conductor.handleInput(0);

			expect(onJudgment).toHaveBeenCalledTimes(1);
			expect(onJudgment).toHaveBeenCalledWith(
				expect.objectContaining({
					judgment: "marvelous",
					column: 0,
				}),
			);
		});
	});

	describe("completion", () => {
		it("should report complete when all notes processed", () => {
			conductor.start();

			expect(conductor.isComplete()).toBe(false);

			// Hit all notes
			for (let i = 0; i < 4; i++) {
				timeProvider.setTime(i * 0.5);
				conductor.handleInput(i);
			}

			expect(conductor.isComplete()).toBe(true);
		});

		it("should finalize with correct score", () => {
			conductor.start();

			// Hit all notes
			for (let i = 0; i < 4; i++) {
				timeProvider.setTime(i * 0.5);
				conductor.handleInput(i);
			}

			const score = conductor.finalize();

			expect(score.judgments.marvelous).toBe(4);
			expect(score.maxCombo).toBe(4);
			expect(score.accuracy).toBe(100);
			expect(score.grade).toBe("AAA");
		});

		it("should mark remaining notes as misses in finalize", () => {
			conductor.start();

			// Hit only 2 notes
			timeProvider.setTime(0);
			conductor.handleInput(0);
			timeProvider.setTime(0.5);
			conductor.handleInput(1);

			const score = conductor.finalize();

			expect(score.judgments.marvelous).toBe(2);
			expect(score.judgments.miss).toBe(2);
			expect(score.accuracy).toBe(50);
		});
	});

	describe("visible notes", () => {
		it("should return notes within render window", () => {
			conductor.start();
			timeProvider.setTime(0.5); // Beat 1

			// Get notes 2 beats ahead, 1 beat behind
			const visible = conductor.getVisibleNotes(2, 1);

			// Should include beats 0, 1, 2, 3 (all within window)
			expect(visible.length).toBe(4);
		});

		it("should exclude notes outside render window", () => {
			const manyNotes: Note[] = [];
			for (let i = 0; i < 100; i++) {
				manyNotes.push({ beat: i, column: i % 4, noteType: "tap" });
			}

			conductor = new Conductor(defaultBpm, [], 0, manyNotes, timeProvider);
			conductor.start();
			timeProvider.setTime(25); // Beat 50

			const visible = conductor.getVisibleNotes(4, 1);

			// Should only include notes around beat 50
			expect(visible.length).toBeLessThan(10);
			for (const state of visible) {
				expect(state.note.beat).toBeGreaterThanOrEqual(49);
				expect(state.note.beat).toBeLessThanOrEqual(54);
			}
		});

		it("should include hit and missed notes in visible list", () => {
			conductor.start();

			// Hit first note
			timeProvider.setTime(0);
			conductor.handleInput(0);

			// Miss second note
			timeProvider.setTime(1.0);
			conductor.update(0);

			// Get visible notes
			// At time 1.0 = beat 2, window (2 ahead, 1 behind) = beats 1-4
			timeProvider.setTime(1.0);
			const visible = conductor.getVisibleNotes(2, 1);

			// Should include beats 1, 2, 3 (beat 0 is outside window)
			expect(visible.length).toBe(3);
			expect(visible.some((s) => s.missed)).toBe(true);
		});
	});

	describe("note states", () => {
		it("should track note states correctly", () => {
			conductor.start();

			const states = conductor.getNoteStates();
			expect(states.size).toBe(4);

			// All notes should start unhit and unmissed
			for (const state of states.values()) {
				expect(state.hit).toBe(false);
				expect(state.missed).toBe(false);
			}
		});

		it("should update note state on hit", () => {
			conductor.start();

			timeProvider.setTime(0);
			conductor.handleInput(0);

			const states = conductor.getNoteStates();
			const firstNote = defaultNotes[0];
			if (!firstNote) throw new Error("No first note");
			const state = states.get(firstNote);

			expect(state?.hit).toBe(true);
			expect(state?.missed).toBe(false);
			expect(state?.judgment).toBeDefined();
		});

		it("should update note state on miss", () => {
			conductor.start();

			timeProvider.setTime(0.2);
			conductor.update(0);

			const states = conductor.getNoteStates();
			const firstNote = defaultNotes[0];
			if (!firstNote) throw new Error("No first note");
			const state = states.get(firstNote);

			expect(state?.hit).toBe(false);
			expect(state?.missed).toBe(true);
			expect(state?.judgment?.judgment).toBe("miss");
		});
	});

	describe("stops", () => {
		it("should detect when in a stop", () => {
			conductor = new Conductor(
				defaultBpm,
				[{ beat: 2, duration: 1.0 }], // 1 second stop at beat 2
				0,
				defaultNotes,
				timeProvider,
			);
			conductor.start();

			// Beat 2 = time 1.0 at 120 BPM
			timeProvider.setTime(0.5); // Before stop
			expect(conductor.isDuringStop()).toBe(false);

			timeProvider.setTime(1.0); // Start of stop
			expect(conductor.isDuringStop()).toBe(true);

			timeProvider.setTime(1.5); // During stop
			expect(conductor.isDuringStop()).toBe(true);

			timeProvider.setTime(2.0); // End of stop
			expect(conductor.isDuringStop()).toBe(false);
		});
	});

	describe("beat to time conversion", () => {
		it("should convert beat to time", () => {
			conductor.start();

			expect(conductor.beatToTime(0)).toBe(0);
			expect(conductor.beatToTime(1)).toBe(0.5); // 120 BPM
			expect(conductor.beatToTime(2)).toBe(1.0);
		});
	});

	describe("start/stop", () => {
		it("should not process updates when not playing", () => {
			const onMiss = vi.fn();
			conductor.onMiss = onMiss;

			// Don't start conductor
			timeProvider.setTime(1.0);
			conductor.update(0);

			expect(onMiss).not.toHaveBeenCalled();
		});

		it("should stop processing after stop() called", () => {
			conductor.start();
			conductor.stop();

			const result = conductor.handleInput(0);
			expect(result).toBeNull();
		});

		it("should return 0 song position when not playing", () => {
			timeProvider.setTime(5.0);
			expect(conductor.getSongPosition()).toBe(0);
		});
	});
});
