import { Conductor, VirtualTimeProvider } from "@stepfever/core";
import type { BPMChange, Note } from "@stepfever/core";
import { beforeEach, describe, expect, it } from "vitest";

describe("Pause Menu", () => {
	describe("Conductor pause/resume", () => {
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

		it("should preserve song position when paused", () => {
			conductor.start();

			// Advance to 1 second
			timeProvider.advance(1.0);
			expect(conductor.getSongPosition()).toBe(1.0);

			// Pause
			conductor.pause();
			expect(conductor.getSongPosition()).toBe(1.0);
			expect(conductor.isPaused()).toBe(true);

			// Time continues advancing but position stays the same
			timeProvider.advance(5.0);
			expect(conductor.getSongPosition()).toBe(1.0);
		});

		it("should resume from paused position", () => {
			conductor.start();

			// Advance to 1 second
			timeProvider.advance(1.0);
			expect(conductor.getSongPosition()).toBe(1.0);

			// Pause
			conductor.pause();

			// Time advances while paused
			timeProvider.advance(5.0);

			// Resume
			conductor.resume();
			expect(conductor.isPaused()).toBe(false);

			// Position should continue from where it was paused
			expect(conductor.getSongPosition()).toBe(1.0);

			// Time continues normally
			timeProvider.advance(0.5);
			expect(conductor.getSongPosition()).toBe(1.5);
		});

		it("should not pause if not playing", () => {
			conductor.pause();
			expect(conductor.isPaused()).toBe(false);
		});

		it("should not resume if not paused", () => {
			conductor.start();
			timeProvider.advance(1.0);

			// Try to resume without pausing
			conductor.resume();
			expect(conductor.getSongPosition()).toBe(1.0);
		});

		it("should reset pause state on stop", () => {
			conductor.start();
			timeProvider.advance(1.0);
			conductor.pause();

			expect(conductor.isPaused()).toBe(true);

			conductor.stop();
			expect(conductor.isPaused()).toBe(false);
		});

		it("should preserve beat position when paused", () => {
			conductor.start();

			// At 120 BPM, 0.5s = 1 beat
			timeProvider.advance(0.5);
			expect(conductor.getCurrentBeat()).toBe(1);

			conductor.pause();

			// Beat should stay the same while paused
			timeProvider.advance(5.0);
			expect(conductor.getCurrentBeat()).toBe(1);
		});

		it("should allow multiple pause/resume cycles", () => {
			conductor.start();

			// First cycle
			timeProvider.advance(1.0);
			conductor.pause();
			timeProvider.advance(2.0);
			conductor.resume();
			expect(conductor.getSongPosition()).toBe(1.0);

			// Advance and second cycle
			timeProvider.advance(0.5);
			expect(conductor.getSongPosition()).toBe(1.5);

			conductor.pause();
			timeProvider.advance(3.0);
			conductor.resume();
			expect(conductor.getSongPosition()).toBe(1.5);

			// Verify continued playback
			timeProvider.advance(1.0);
			expect(conductor.getSongPosition()).toBe(2.5);
		});
	});

	describe("Pause UI keyboard navigation", () => {
		it("should cycle through options correctly", () => {
			const options = ["Resume", "Restart", "Quit"];
			let selectedOption = 0;

			const navigateMenu = (direction: number) => {
				selectedOption = (selectedOption + direction + options.length) % options.length;
			};

			// Navigate down
			navigateMenu(1);
			expect(selectedOption).toBe(1); // Restart

			navigateMenu(1);
			expect(selectedOption).toBe(2); // Quit

			navigateMenu(1);
			expect(selectedOption).toBe(0); // Resume (wrap around)

			// Navigate up
			navigateMenu(-1);
			expect(selectedOption).toBe(2); // Quit (wrap around)

			navigateMenu(-1);
			expect(selectedOption).toBe(1); // Restart
		});
	});
});
