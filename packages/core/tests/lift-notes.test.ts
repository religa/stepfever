import { beforeEach, describe, expect, it } from "vitest";
import { Conductor, VirtualTimeProvider } from "../src/conductor/conductor";

describe("Conductor - Lift Notes (handleRelease)", () => {
	let conductor: Conductor;
	let timeProvider: VirtualTimeProvider;

	beforeEach(() => {
		timeProvider = new VirtualTimeProvider();
	});

	it("judges lift notes on release instead of press", () => {
		// Create conductor with a lift note at beat 4 (1 second at 240 BPM)
		conductor = new Conductor({
			bpmChanges: [{ beat: 0, bpm: 240 }],
			stops: [],
			offset: 0,
			notes: [{ beat: 4, column: 0, noteType: "lift" }],
			timeProvider,
		});

		conductor.start();

		// Press at exact time - should not register (lift needs release)
		timeProvider.setTime(1.0);
		const pressResult = conductor.handleInput(0);
		expect(pressResult).toBeNull();

		// Release at exact time - should register and judge
		const releaseResult = conductor.handleRelease(0);
		expect(releaseResult).not.toBeNull();
		expect(releaseResult?.judgment).toBe("marvelous");
	});

	it("returns null when releasing on empty column", () => {
		conductor = new Conductor({
			bpmChanges: [{ beat: 0, bpm: 240 }],
			stops: [],
			offset: 0,
			notes: [{ beat: 4, column: 0, noteType: "lift" }],
			timeProvider,
		});

		conductor.start();
		timeProvider.setTime(1.0);

		// Release on wrong column
		const result = conductor.handleRelease(1);
		expect(result).toBeNull();
	});

	it("returns null when releasing outside hit window", () => {
		conductor = new Conductor({
			bpmChanges: [{ beat: 0, bpm: 240 }],
			stops: [],
			offset: 0,
			notes: [{ beat: 4, column: 0, noteType: "lift" }],
			timeProvider,
		});

		conductor.start();
		// Way too early
		timeProvider.setTime(0.5);

		const result = conductor.handleRelease(0);
		expect(result).toBeNull();
	});

	it("judges lift notes with correct timing window", () => {
		conductor = new Conductor({
			bpmChanges: [{ beat: 0, bpm: 240 }],
			stops: [],
			offset: 0,
			notes: [{ beat: 4, column: 0, noteType: "lift" }],
			timeProvider,
		});

		conductor.start();

		// Release early (within Perfect window)
		timeProvider.setTime(1.0 - 0.04);
		const earlyResult = conductor.handleRelease(0);
		expect(earlyResult).not.toBeNull();
		expect(["marvelous", "perfect"]).toContain(earlyResult?.judgment);
	});

	it("does not judge tap notes on release", () => {
		conductor = new Conductor({
			bpmChanges: [{ beat: 0, bpm: 240 }],
			stops: [],
			offset: 0,
			notes: [{ beat: 4, column: 0, noteType: "tap" }],
			timeProvider,
		});

		conductor.start();
		timeProvider.setTime(1.0);

		// Release should not hit tap notes
		const releaseResult = conductor.handleRelease(0);
		expect(releaseResult).toBeNull();

		// But press should
		const pressResult = conductor.handleInput(0);
		expect(pressResult).not.toBeNull();
	});

	it("handles multiple lift notes in sequence", () => {
		conductor = new Conductor({
			bpmChanges: [{ beat: 0, bpm: 240 }],
			stops: [],
			offset: 0,
			notes: [
				{ beat: 4, column: 0, noteType: "lift" },
				{ beat: 8, column: 0, noteType: "lift" },
			],
			timeProvider,
		});

		conductor.start();

		// First lift at beat 4 (time 1.0)
		timeProvider.setTime(1.0);
		const result1 = conductor.handleRelease(0);
		expect(result1?.judgment).toBe("marvelous");

		// Second lift at beat 8 (time 2.0)
		timeProvider.setTime(2.0);
		const result2 = conductor.handleRelease(0);
		expect(result2?.judgment).toBe("marvelous");
	});

	it("handles simultaneous lift notes on different columns", () => {
		conductor = new Conductor({
			bpmChanges: [{ beat: 0, bpm: 240 }],
			stops: [],
			offset: 0,
			notes: [
				{ beat: 4, column: 0, noteType: "lift" },
				{ beat: 4, column: 3, noteType: "lift" },
			],
			timeProvider,
		});

		conductor.start();
		timeProvider.setTime(1.0);

		// Release both at the same time
		const result1 = conductor.handleRelease(0);
		const result2 = conductor.handleRelease(3);

		expect(result1?.judgment).toBe("marvelous");
		expect(result2?.judgment).toBe("marvelous");
	});

	it("updates scoring correctly for lift notes", () => {
		conductor = new Conductor({
			bpmChanges: [{ beat: 0, bpm: 240 }],
			stops: [],
			offset: 0,
			notes: [
				{ beat: 4, column: 0, noteType: "lift" },
				{ beat: 8, column: 1, noteType: "lift" },
			],
			timeProvider,
		});

		conductor.start();

		// Hit first lift
		timeProvider.setTime(1.0);
		conductor.handleRelease(0);
		expect(conductor.getCombo()).toBe(1);

		// Hit second lift
		timeProvider.setTime(2.0);
		conductor.handleRelease(1);
		expect(conductor.getCombo()).toBe(2);
	});

	it("marks lift notes as missed when past window", () => {
		conductor = new Conductor({
			bpmChanges: [{ beat: 0, bpm: 240 }],
			stops: [],
			offset: 0,
			notes: [{ beat: 4, column: 0, noteType: "lift" }],
			timeProvider,
		});

		conductor.start();

		// Update past the miss window (boo window is 0.18)
		timeProvider.setTime(1.0 + 0.2);
		conductor.update(0);

		// Check note state
		const states = conductor.getNoteStates();
		for (const state of states.values()) {
			expect(state.missed).toBe(true);
		}
	});

	it("handles mixed tap and lift notes", () => {
		conductor = new Conductor({
			bpmChanges: [{ beat: 0, bpm: 240 }],
			stops: [],
			offset: 0,
			notes: [
				{ beat: 4, column: 0, noteType: "tap" },
				{ beat: 6, column: 0, noteType: "lift" },
				{ beat: 8, column: 0, noteType: "tap" },
			],
			timeProvider,
		});

		conductor.start();

		// Tap at beat 4
		timeProvider.setTime(1.0);
		const tap1 = conductor.handleInput(0);
		expect(tap1?.judgment).toBe("marvelous");

		// Lift at beat 6 (time 1.5)
		timeProvider.setTime(1.5);
		const lift = conductor.handleRelease(0);
		expect(lift?.judgment).toBe("marvelous");

		// Tap at beat 8
		timeProvider.setTime(2.0);
		const tap2 = conductor.handleInput(0);
		expect(tap2?.judgment).toBe("marvelous");

		expect(conductor.getCombo()).toBe(3);
	});
});
