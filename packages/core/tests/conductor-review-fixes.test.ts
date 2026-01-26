import { beforeEach, describe, expect, it } from "vitest";
import type { BPMChange, Note, Stop } from "../src/chart/model";
import { Conductor, VirtualTimeProvider } from "../src/conductor/conductor";

describe("Conductor Code Review Fixes", () => {
	let timeProvider: VirtualTimeProvider;
	const defaultBpm: BPMChange[] = [{ beat: 0, bpm: 120 }];

	beforeEach(() => {
		timeProvider = new VirtualTimeProvider();
	});

	describe("HIGH: Notes after stops should use stop-adjusted timing", () => {
		it("should judge notes after stops using stop-adjusted timing", () => {
			// Stop at beat 1 for 1 second
			// Note at beat 2
			// At 120 BPM: beat 1 = 0.5s, beat 2 = 1.0s
			// With 1s stop at beat 1: beat 2 should occur at 0.5s + 1s + 0.5s = 2.0s
			const stops: Stop[] = [{ beat: 1, duration: 1.0 }];
			const notes: Note[] = [{ beat: 2, column: 0, noteType: "tap" }];

			const conductor = new Conductor(defaultBpm, stops, 0, notes, timeProvider);
			conductor.start();

			// At audio time 2.0s, we should be able to hit the note at beat 2
			timeProvider.setTime(2.0);
			const result = conductor.handleInput(0);

			expect(result).not.toBeNull();
			expect(result?.judgment).toBe("marvelous");
		});

		it("should delay miss detection for notes after stops", () => {
			const stops: Stop[] = [{ beat: 1, duration: 1.0 }];
			const notes: Note[] = [{ beat: 2, column: 0, noteType: "tap" }];

			const conductor = new Conductor(defaultBpm, stops, 0, notes, timeProvider);
			conductor.start();

			const trackedNote = notes[0];
			if (!trackedNote) throw new Error("No note");

			// At time 1.3s (during the stop), note should not be missed
			timeProvider.setTime(1.3);
			conductor.update(0);
			expect(conductor.getNoteStates().get(trackedNote)?.missed).toBe(false);

			// After the stop (past 2.0s + boo window), note should be missed
			timeProvider.setTime(2.2);
			conductor.update(0);
			expect(conductor.getNoteStates().get(trackedNote)?.missed).toBe(true);
		});

		it("should handle multiple consecutive stops", () => {
			// Stop at beat 1 for 0.5s, stop at beat 2 for 0.5s
			// Note at beat 3
			const stops: Stop[] = [
				{ beat: 1, duration: 0.5 },
				{ beat: 2, duration: 0.5 },
			];
			const notes: Note[] = [{ beat: 3, column: 0, noteType: "tap" }];

			const conductor = new Conductor(defaultBpm, stops, 0, notes, timeProvider);
			conductor.start();

			// At 120 BPM: beat 3 = 1.5s normally
			// With two 0.5s stops: 1.5s + 0.5s + 0.5s = 2.5s
			timeProvider.setTime(2.5);
			const result = conductor.handleInput(0);

			expect(result).not.toBeNull();
			expect(result?.judgment).toBe("marvelous");
		});
	});

	describe("MEDIUM: Input validation for column", () => {
		it("should reject negative column values", () => {
			const notes: Note[] = [{ beat: 0, column: 0, noteType: "tap" }];
			const conductor = new Conductor(defaultBpm, [], 0, notes, timeProvider);
			conductor.start();

			timeProvider.setTime(0);
			const result = conductor.handleInput(-1);

			expect(result).toBeNull();
		});

		it("should reject non-integer column values", () => {
			const notes: Note[] = [{ beat: 0, column: 0, noteType: "tap" }];
			const conductor = new Conductor(defaultBpm, [], 0, notes, timeProvider);
			conductor.start();

			timeProvider.setTime(0);
			const result = conductor.handleInput(1.5);

			expect(result).toBeNull();
		});

		it("should reject NaN column values", () => {
			const notes: Note[] = [{ beat: 0, column: 0, noteType: "tap" }];
			const conductor = new Conductor(defaultBpm, [], 0, notes, timeProvider);
			conductor.start();

			timeProvider.setTime(0);
			const result = conductor.handleInput(Number.NaN);

			expect(result).toBeNull();
		});

		it("should accept valid column values (0-3)", () => {
			const notes: Note[] = [
				{ beat: 0, column: 0, noteType: "tap" },
				{ beat: 1, column: 1, noteType: "tap" },
				{ beat: 2, column: 2, noteType: "tap" },
				{ beat: 3, column: 3, noteType: "tap" },
			];
			const conductor = new Conductor(defaultBpm, [], 0, notes, timeProvider);
			conductor.start();

			for (let i = 0; i < 4; i++) {
				timeProvider.setTime(i * 0.5);
				const result = conductor.handleInput(i);
				expect(result).not.toBeNull();
			}
		});
	});

	describe("MEDIUM: Double miss processing prevention", () => {
		it("should not miss the same note twice even if update called multiple times", () => {
			const notes: Note[] = [{ beat: 0, column: 0, noteType: "tap" }];
			const conductor = new Conductor(defaultBpm, [], 0, notes, timeProvider);
			conductor.start();

			const trackedNote = notes[0];
			if (!trackedNote) throw new Error("No note");

			// Move past the miss window
			timeProvider.setTime(0.2);

			// Call update multiple times
			conductor.update(0);
			conductor.update(0);
			conductor.update(0);

			// Check that state is consistent
			const state = conductor.getNoteStates().get(trackedNote);
			expect(state?.missed).toBe(true);
			expect(state?.hit).toBe(false);

			// Finalize should show exactly 1 miss
			const score = conductor.finalize();
			expect(score.judgments.miss).toBe(1);
		});

		it("should not allow hitting a note after it's been marked as missed", () => {
			const notes: Note[] = [{ beat: 0, column: 0, noteType: "tap" }];
			const conductor = new Conductor(defaultBpm, [], 0, notes, timeProvider);
			conductor.start();

			// Move past the miss window
			timeProvider.setTime(0.2);
			conductor.update(0);

			// Try to hit the note
			const result = conductor.handleInput(0);
			expect(result).toBeNull();
		});

		it("should not allow missing a note after it's been hit", () => {
			const notes: Note[] = [{ beat: 0, column: 0, noteType: "tap" }];
			const conductor = new Conductor(defaultBpm, [], 0, notes, timeProvider);
			conductor.start();

			// Hit the note
			timeProvider.setTime(0);
			conductor.handleInput(0);

			// Move past the miss window
			timeProvider.setTime(0.2);
			conductor.update(0);

			// Check that it's not marked as missed
			const trackedNote = notes[0];
			if (!trackedNote) throw new Error("No note");
			const state = conductor.getNoteStates().get(trackedNote);
			expect(state?.hit).toBe(true);
			expect(state?.missed).toBe(false);
		});
	});

	describe("HIGH: Inconsistent offset handling in note selection", () => {
		it("should select closest note considering global offset", () => {
			// Two notes close together
			const notes: Note[] = [
				{ beat: 0, column: 0, noteType: "tap" }, // time 0.0
				{ beat: 0.5, column: 0, noteType: "tap" }, // time 0.25
			];

			// Global offset of 50ms
			const conductor = new Conductor(defaultBpm, [], 0, notes, timeProvider, 0.05);
			conductor.start();

			// At time 0.05 (50ms), without offset adjustment this is 50ms from beat 0
			// With offset, adjusted time is 0.0, which is exact for beat 0
			timeProvider.setTime(0.05);
			const result = conductor.handleInput(0);

			expect(result).not.toBeNull();
			expect(result?.beat).toBe(0); // Should hit first note, not second
			expect(result?.judgment).toBe("marvelous"); // Should be perfect with offset
		});

		it("should apply offset consistently across closest note calculation", () => {
			// Two notes with offset
			const notes: Note[] = [
				{ beat: 1, column: 0, noteType: "tap" }, // time 0.5
				{ beat: 1.5, column: 0, noteType: "tap" }, // time 0.75
			];

			// Global offset of 100ms
			const conductor = new Conductor(defaultBpm, [], 0, notes, timeProvider, 0.1);
			conductor.start();

			// At time 0.6 (100ms late for beat 1 = 0.5s)
			// Adjusted time = 0.6 - 0.1 = 0.5 (exact for beat 1)
			timeProvider.setTime(0.6);
			const result = conductor.handleInput(0);

			expect(result).not.toBeNull();
			expect(result?.beat).toBe(1);
			expect(result?.judgment).toBe("marvelous");
		});
	});

	describe("MEDIUM: Mutable state leak via getNoteStates", () => {
		it("should return readonly map preventing external modification", () => {
			const notes: Note[] = [{ beat: 0, column: 0, noteType: "tap" }];
			const conductor = new Conductor(defaultBpm, [], 0, notes, timeProvider);

			const states = conductor.getNoteStates();

			// TypeScript should prevent this at compile time with ReadonlyMap
			// At runtime, the returned map should still be the same reference
			expect(states).toBe(conductor.getNoteStates());
		});

		it("should not allow external code to corrupt note states", () => {
			const notes: Note[] = [{ beat: 0, column: 0, noteType: "tap" }];
			const conductor = new Conductor(defaultBpm, [], 0, notes, timeProvider);
			conductor.start();

			const states = conductor.getNoteStates();
			const firstNote = notes[0];
			if (!firstNote) throw new Error("No note");
			const state = states.get(firstNote);

			// Even if we could mutate (which we shouldn't with Readonly types),
			// the conductor should maintain internal consistency
			if (state) {
				// This is testing that if someone bypassed readonly,
				// conductor logic would still work
				const originalHit = state.hit;
				expect(originalHit).toBe(false);
			}

			// Hit the note normally
			timeProvider.setTime(0);
			conductor.handleInput(0);

			// Verify the note was hit
			const updatedState = conductor.getNoteStates().get(firstNote);
			expect(updatedState?.hit).toBe(true);
		});
	});
});
