import { CONTROLLER_PRESETS } from "@stepfever/core";
import { describe, expect, it } from "vitest";
import { detectControllerConflicts, hasConflicts } from "../src/multiplayer/validator";

describe("Controller Validator", () => {
	it("should detect no conflicts with different presets", () => {
		const controllers = [CONTROLLER_PRESETS.arrows!, CONTROLLER_PRESETS.wasd!];

		const conflicts = detectControllerConflicts(controllers);
		expect(conflicts).toHaveLength(0);
		expect(hasConflicts(controllers)).toBe(false);
	});

	it("should detect conflicts with same preset", () => {
		const controllers = [CONTROLLER_PRESETS.arrows!, CONTROLLER_PRESETS.arrows!];

		const conflicts = detectControllerConflicts(controllers);
		expect(conflicts.length).toBeGreaterThan(0);
		expect(hasConflicts(controllers)).toBe(true);
	});

	it("should detect specific key conflicts", () => {
		const controllers = [CONTROLLER_PRESETS.arrows!, CONTROLLER_PRESETS.arrows!];

		const conflicts = detectControllerConflicts(controllers);

		// ArrowLeft should conflict
		const leftConflict = conflicts.find((c) => c.key === "ArrowLeft");
		expect(leftConflict).toBeDefined();
		expect(leftConflict?.player1).toBe(0);
		expect(leftConflict?.player2).toBe(1);
	});

	it("should detect multiple conflicts between players", () => {
		const controllers = [CONTROLLER_PRESETS.dfjk!, CONTROLLER_PRESETS.wasd!];

		const conflicts = detectControllerConflicts(controllers);

		// "d" is used by both dfjk (left) and wasd (right)
		const dConflict = conflicts.find((c) => c.key === "d");
		expect(dConflict).toBeDefined();
	});

	it("should detect conflicts across 3 players", () => {
		const controllers = [CONTROLLER_PRESETS.arrows!, CONTROLLER_PRESETS.arrows!, CONTROLLER_PRESETS.wasd!];

		const conflicts = detectControllerConflicts(controllers);

		// ArrowLeft conflicts between player 0 and 1
		const leftConflict = conflicts.filter((c) => c.key === "ArrowLeft");
		expect(leftConflict).toHaveLength(1);
	});

	it("should detect conflicts across 4 players", () => {
		const controllers = [
			CONTROLLER_PRESETS.arrows!,
			CONTROLLER_PRESETS.wasd!,
			CONTROLLER_PRESETS.dfjk!,
			CONTROLLER_PRESETS.numpad!,
		];

		const conflicts = detectControllerConflicts(controllers);

		// "d" is used by wasd (right) and dfjk (left)
		const dConflict = conflicts.find((c) => c.key === "d");
		expect(dConflict).toBeDefined();
		expect(dConflict?.player1).toBe(1);
		expect(dConflict?.player2).toBe(2);
	});

	it("should return empty array for single controller", () => {
		const controllers = [CONTROLLER_PRESETS.arrows!];

		const conflicts = detectControllerConflicts(controllers);
		expect(conflicts).toHaveLength(0);
		expect(hasConflicts(controllers)).toBe(false);
	});

	it("should detect all conflicts when all keys overlap", () => {
		const controllers = [CONTROLLER_PRESETS.arrows!, CONTROLLER_PRESETS.arrows!, CONTROLLER_PRESETS.arrows!];

		const conflicts = detectControllerConflicts(controllers);

		// Each key should have 3 conflicts (0-1, 0-2, 1-2)
		const leftConflicts = conflicts.filter((c) => c.key === "ArrowLeft");
		expect(leftConflicts).toHaveLength(3);
	});

	it("should not detect conflicts with zxcv and other presets", () => {
		const controllers = [
			CONTROLLER_PRESETS.arrows!,
			CONTROLLER_PRESETS.wasd!,
			CONTROLLER_PRESETS.numpad!,
			CONTROLLER_PRESETS.zxcv!,
		];

		const conflicts = detectControllerConflicts(controllers);

		// zxcv should not conflict with arrows, numpad
		const zConflict = conflicts.find((c) => c.key === "z");
		expect(zConflict).toBeUndefined();
	});
});
