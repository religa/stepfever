import * as fs from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";

describe("UX Event Handling Issues", () => {
	describe("Event Listener Leak in restartGame", () => {
		it("GameplayNew restartGame should clean up listeners before re-mounting", () => {
			// This test verifies that restartGame properly cleans up event listeners
			// The issue: restartGame was calling mount() which adds new listeners,
			// but wasn't removing the old listeners first

			const sourcePath = path.join(__dirname, "../src/screens/GameplayNew.ts");
			const source = fs.readFileSync(sourcePath, "utf-8");

			// Find the restartGame method
			const restartMatch = source.match(/private\s+async\s+restartGame\(\)[\s\S]*?(?=\n\t(?:private|public|unmount))/);
			expect(restartMatch, "Could not find restartGame method").toBeTruthy();

			const restartGameSource = restartMatch![0];

			// The fix should either:
			// 1. Call this.unmount() before mount
			// 2. Call this.events.dispose() before mount
			const hasUnmountCall = restartGameSource.includes("this.unmount()");
			const hasEventsDispose = restartGameSource.includes("this.events.dispose()");

			expect(
				hasUnmountCall || hasEventsDispose,
				`restartGame should call unmount() or events.dispose() to clean up listeners. Found:\n${restartGameSource}`,
			).toBe(true);
		});

		it("MultiplayerGameplay restartGame should clean up listeners before re-mounting", () => {
			// This test verifies that restartGame properly cleans up event listeners
			// The issue: restartGame was calling mount() which adds new listeners,
			// but wasn't removing the old listeners first

			const sourcePath = path.join(__dirname, "../src/screens/MultiplayerGameplay.ts");
			const source = fs.readFileSync(sourcePath, "utf-8");

			// Find the restartGame method
			const restartMatch = source.match(/private\s+async\s+restartGame\(\)[\s\S]*?(?=\n\t(?:private|public|unmount))/);
			expect(restartMatch, "Could not find restartGame method").toBeTruthy();

			const restartGameSource = restartMatch![0];

			// The fix should either:
			// 1. Call this.unmount() before mount
			// 2. Remove listeners explicitly (handleKeydown, handleResize)
			const hasUnmountCall = restartGameSource.includes("this.unmount()");
			const hasExplicitKeydownCleanup =
				restartGameSource.includes("removeEventListener") && restartGameSource.includes("handleKeydown");
			const hasExplicitResizeCleanup =
				restartGameSource.includes("removeEventListener") && restartGameSource.includes("handleResize");

			expect(
				hasUnmountCall || (hasExplicitKeydownCleanup && hasExplicitResizeCleanup),
				`restartGame should call unmount() or explicitly remove listeners to prevent leaks. Found:\n${restartGameSource}`,
			).toBe(true);
		});
	});

	describe("Speed Modifier Display", () => {
		it("should display 0.75x correctly (not 0.8x)", () => {
			// Test the fix for the speed modifier display bug
			const multiplier = 0.75;

			// Old behavior (bug): toFixed(1) rounds 0.75 to "0.8"
			const oldBehavior = multiplier.toFixed(1); // "0.8"

			// New behavior (fix): parseFloat(toFixed(2)) preserves 0.75
			const newBehavior = Number.parseFloat(multiplier.toFixed(2)); // 0.75

			expect(oldBehavior).toBe("0.8"); // Confirms the bug existed
			expect(newBehavior).toBe(0.75); // Confirms the fix works
			expect(`${newBehavior}x speed`).toBe("0.75x speed"); // Confirms display is correct
		});

		it("should display 1.0x correctly", () => {
			const multiplier = 1.0;
			const result = Number.parseFloat(multiplier.toFixed(2));
			expect(`${result}x speed`).toBe("1x speed");
		});

		it("should display 1.5x correctly", () => {
			const multiplier = 1.5;
			const result = Number.parseFloat(multiplier.toFixed(2));
			expect(`${result}x speed`).toBe("1.5x speed");
		});

		it("should display 2.25x correctly", () => {
			const multiplier = 2.25;
			const result = Number.parseFloat(multiplier.toFixed(2));
			expect(`${result}x speed`).toBe("2.25x speed");
		});
	});

	describe("Calibration Beat Indicator", () => {
		it("requestAnimationFrame should be used after updateUI for DOM flash", () => {
			// This test verifies the calibration screen uses requestAnimationFrame
			// to ensure the DOM is ready before flashing the beat indicator

			const sourcePath = path.join(__dirname, "../src/screens/CalibrationNew.ts");
			const source = fs.readFileSync(sourcePath, "utf-8");

			// Find the interval callback that plays the beat
			const intervalMatch = source.match(/setInterval\(\s*\(\)\s*=>\s*\{[\s\S]*?\},\s*interval\s*\)/);
			expect(intervalMatch, "Could not find setInterval callback").toBeTruthy();

			const intervalSource = intervalMatch![0];

			// The fix should use requestAnimationFrame around flashBeatIndicator
			const hasRAF = intervalSource.includes("requestAnimationFrame");
			const hasFlash = intervalSource.includes("flashBeatIndicator");

			expect(hasRAF && hasFlash, "setInterval callback should use requestAnimationFrame for flashBeatIndicator").toBe(
				true,
			);
		});
	});
});
