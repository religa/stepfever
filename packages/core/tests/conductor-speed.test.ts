import { describe, expect, it } from "vitest";
import type { BPMChange, Note } from "../src/chart/model";
import { Conductor, type ConductorConfig, VirtualTimeProvider } from "../src/conductor/conductor";
import type { CMod, SpeedModifier, XMod } from "../src/mods/model";

describe("Conductor - Speed Modifier Integration", () => {
	const createBasicConfig = (speedModifier?: SpeedModifier | null, bpmChanges?: BPMChange[]): ConductorConfig => {
		const notes: Note[] = [
			{ beat: 0, column: 0, type: "tap" },
			{ beat: 1, column: 1, type: "tap" },
			{ beat: 2, column: 2, type: "tap" },
		];

		return {
			bpmChanges: bpmChanges || [{ beat: 0, bpm: 120 }],
			stops: [],
			offset: 0,
			notes,
			timeProvider: new VirtualTimeProvider(),
			globalOffset: 0,
			speedModifier: speedModifier ?? null,
		};
	};

	describe("Constructor - Config object", () => {
		it("should accept ConductorConfig with speed modifier", () => {
			const xmod2: XMod = { type: "xmod", multiplier: 2.0 };
			const config = createBasicConfig(xmod2);
			const conductor = new Conductor(config);

			expect(conductor.getSpeedModifier()).toEqual(xmod2);
		});

		it("should accept ConductorConfig without speed modifier", () => {
			const config = createBasicConfig(null);
			const conductor = new Conductor(config);

			expect(conductor.getSpeedModifier()).toBeNull();
		});

		it("should default to null speed modifier if not provided", () => {
			const config = createBasicConfig();
			delete config.speedModifier;
			const conductor = new Conductor(config);

			expect(conductor.getSpeedModifier()).toBeNull();
		});
	});

	describe("Constructor - Legacy parameters", () => {
		it("should accept legacy constructor signature", () => {
			const bpmChanges: BPMChange[] = [{ beat: 0, bpm: 120 }];
			const notes: Note[] = [{ beat: 0, column: 0, type: "tap" }];
			const timeProvider = new VirtualTimeProvider();

			const conductor = new Conductor(bpmChanges, [], 0, notes, timeProvider, 0);

			expect(conductor.getSpeedModifier()).toBeNull();
			expect(conductor.getCurrentBpm()).toBe(120);
		});

		it("should work without globalOffset in legacy constructor", () => {
			const bpmChanges: BPMChange[] = [{ beat: 0, bpm: 120 }];
			const notes: Note[] = [{ beat: 0, column: 0, type: "tap" }];
			const timeProvider = new VirtualTimeProvider();

			const conductor = new Conductor(bpmChanges, [], 0, notes, timeProvider);

			expect(conductor.getSpeedModifier()).toBeNull();
		});
	});

	describe("getScrollSpeed", () => {
		it("should return default speed when no modifier is set", () => {
			const config = createBasicConfig(null);
			const conductor = new Conductor(config);
			conductor.start();

			const speed = conductor.getScrollSpeed();
			// At 120 BPM, default is BASE_SCROLL_SPEED * 120 / 120 = 200
			expect(speed).toBe(200);
		});

		it("should apply X-Mod multiplier to scroll speed", () => {
			const xmod2: XMod = { type: "xmod", multiplier: 2.0 };
			const config = createBasicConfig(xmod2);
			const conductor = new Conductor(config);
			conductor.start();

			const speed = conductor.getScrollSpeed();
			// 200 * 2.0 * 120 / 120 = 400
			expect(speed).toBe(400);
		});

		it("should use constant speed for C-Mod", () => {
			const cmod500: CMod = { type: "cmod", pixelsPerSecond: 500 };
			const config = createBasicConfig(cmod500);
			const conductor = new Conductor(config);
			conductor.start();

			const speed = conductor.getScrollSpeed();
			expect(speed).toBe(500);
		});

		it("should update scroll speed when BPM changes (X-Mod)", () => {
			const xmod2: XMod = { type: "xmod", multiplier: 2.0 };
			const bpmChanges: BPMChange[] = [
				{ beat: 0, bpm: 120 },
				{ beat: 4, bpm: 180 },
			];
			const config = createBasicConfig(xmod2, bpmChanges);
			const conductor = new Conductor(config);
			const timeProvider = config.timeProvider as VirtualTimeProvider;

			conductor.start();

			// At beat 0 (120 BPM)
			const speed1 = conductor.getScrollSpeed();
			expect(speed1).toBe(400); // 200 * 2.0 * 120 / 120

			// Advance to beat 4 (180 BPM)
			timeProvider.setTime(2.0); // 4 beats at 120 BPM = 2 seconds
			const speed2 = conductor.getScrollSpeed();
			expect(speed2).toBe(600); // 200 * 2.0 * 180 / 120
		});

		it("should keep constant speed when BPM changes (C-Mod)", () => {
			const cmod500: CMod = { type: "cmod", pixelsPerSecond: 500 };
			const bpmChanges: BPMChange[] = [
				{ beat: 0, bpm: 120 },
				{ beat: 4, bpm: 180 },
			];
			const config = createBasicConfig(cmod500, bpmChanges);
			const conductor = new Conductor(config);
			const timeProvider = config.timeProvider as VirtualTimeProvider;

			conductor.start();

			// At beat 0 (120 BPM)
			const speed1 = conductor.getScrollSpeed();
			expect(speed1).toBe(500);

			// Advance to beat 4 (180 BPM)
			timeProvider.setTime(2.0);
			const speed2 = conductor.getScrollSpeed();
			expect(speed2).toBe(500); // Constant
		});
	});

	describe("setSpeedModifier", () => {
		it("should update speed modifier during gameplay", () => {
			const config = createBasicConfig(null);
			const conductor = new Conductor(config);
			conductor.start();

			const initialSpeed = conductor.getScrollSpeed();
			expect(initialSpeed).toBe(200);

			const xmod3: XMod = { type: "xmod", multiplier: 3.0 };
			conductor.setSpeedModifier(xmod3);

			const newSpeed = conductor.getScrollSpeed();
			expect(newSpeed).toBe(600); // 200 * 3.0 * 120 / 120
		});

		it("should allow switching from X-Mod to C-Mod", () => {
			const xmod2: XMod = { type: "xmod", multiplier: 2.0 };
			const config = createBasicConfig(xmod2);
			const conductor = new Conductor(config);
			conductor.start();

			expect(conductor.getScrollSpeed()).toBe(400);

			const cmod500: CMod = { type: "cmod", pixelsPerSecond: 500 };
			conductor.setSpeedModifier(cmod500);

			expect(conductor.getScrollSpeed()).toBe(500);
		});

		it("should allow switching from C-Mod to X-Mod", () => {
			const cmod500: CMod = { type: "cmod", pixelsPerSecond: 500 };
			const config = createBasicConfig(cmod500);
			const conductor = new Conductor(config);
			conductor.start();

			expect(conductor.getScrollSpeed()).toBe(500);

			const xmod1_5: XMod = { type: "xmod", multiplier: 1.5 };
			conductor.setSpeedModifier(xmod1_5);

			expect(conductor.getScrollSpeed()).toBe(300); // 200 * 1.5 * 120 / 120
		});

		it("should allow clearing speed modifier", () => {
			const xmod2: XMod = { type: "xmod", multiplier: 2.0 };
			const config = createBasicConfig(xmod2);
			const conductor = new Conductor(config);
			conductor.start();

			expect(conductor.getScrollSpeed()).toBe(400);

			conductor.setSpeedModifier(null);

			expect(conductor.getScrollSpeed()).toBe(200); // Back to default
		});
	});

	describe("getSpeedModifier", () => {
		it("should return current speed modifier", () => {
			const xmod2: XMod = { type: "xmod", multiplier: 2.0 };
			const config = createBasicConfig(xmod2);
			const conductor = new Conductor(config);

			expect(conductor.getSpeedModifier()).toEqual(xmod2);
		});

		it("should return null when no modifier is set", () => {
			const config = createBasicConfig(null);
			const conductor = new Conductor(config);

			expect(conductor.getSpeedModifier()).toBeNull();
		});

		it("should return updated modifier after setSpeedModifier", () => {
			const config = createBasicConfig(null);
			const conductor = new Conductor(config);

			expect(conductor.getSpeedModifier()).toBeNull();

			const cmod400: CMod = { type: "cmod", pixelsPerSecond: 400 };
			conductor.setSpeedModifier(cmod400);

			expect(conductor.getSpeedModifier()).toEqual(cmod400);
		});
	});

	describe("Edge cases", () => {
		it("should handle minimum X-Mod multiplier", () => {
			const xmodMin: XMod = { type: "xmod", multiplier: 0.1 };
			const config = createBasicConfig(xmodMin);
			const conductor = new Conductor(config);
			conductor.start();

			const speed = conductor.getScrollSpeed();
			expect(speed).toBe(20); // 200 * 0.1 * 120 / 120
		});

		it("should handle maximum X-Mod multiplier", () => {
			const xmodMax: XMod = { type: "xmod", multiplier: 20.0 };
			const config = createBasicConfig(xmodMax);
			const conductor = new Conductor(config);
			conductor.start();

			const speed = conductor.getScrollSpeed();
			expect(speed).toBe(4000); // 200 * 20.0 * 120 / 120
		});

		it("should handle minimum C-Mod speed", () => {
			const cmodMin: CMod = { type: "cmod", pixelsPerSecond: 100 };
			const config = createBasicConfig(cmodMin);
			const conductor = new Conductor(config);
			conductor.start();

			const speed = conductor.getScrollSpeed();
			expect(speed).toBe(100);
		});

		it("should handle maximum C-Mod speed", () => {
			const cmodMax: CMod = { type: "cmod", pixelsPerSecond: 1000 };
			const config = createBasicConfig(cmodMax);
			const conductor = new Conductor(config);
			conductor.start();

			const speed = conductor.getScrollSpeed();
			expect(speed).toBe(1000);
		});

		it("should handle speed modifier changes without starting", () => {
			const config = createBasicConfig(null);
			const conductor = new Conductor(config);

			// Should not throw, even before start()
			const xmod2: XMod = { type: "xmod", multiplier: 2.0 };
			conductor.setSpeedModifier(xmod2);

			expect(conductor.getSpeedModifier()).toEqual(xmod2);
		});
	});

	describe("Integration with gameplay", () => {
		it("should maintain gameplay functionality with speed modifier", () => {
			const xmod2: XMod = { type: "xmod", multiplier: 2.0 };
			const config = createBasicConfig(xmod2);
			const conductor = new Conductor(config);
			const timeProvider = config.timeProvider as VirtualTimeProvider;

			conductor.start();
			timeProvider.setTime(0);

			// Hit a note (gameplay should work normally)
			const result = conductor.handleInput(0);
			expect(result).not.toBeNull();
			expect(result?.judgment).toBe("marvelous");

			// Speed modifier should still be active
			expect(conductor.getScrollSpeed()).toBe(400);
		});

		it("should not affect timing engine calculations", () => {
			const xmod3: XMod = { type: "xmod", multiplier: 3.0 };
			const config = createBasicConfig(xmod3);
			const conductor = new Conductor(config);
			const timeProvider = config.timeProvider as VirtualTimeProvider;

			conductor.start();
			timeProvider.setTime(0);

			// Speed modifier should not affect beat calculations
			expect(conductor.getCurrentBeat()).toBe(0);

			timeProvider.setTime(0.5); // 0.5 seconds at 120 BPM = 1 beat
			expect(conductor.getCurrentBeat()).toBe(1);
		});
	});
});
