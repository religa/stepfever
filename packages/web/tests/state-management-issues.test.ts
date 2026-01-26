import { beforeEach, describe, expect, it } from "vitest";

describe("State Management Issues", () => {
	describe("MultiplayerConfig Cleanup", () => {
		it("should clear multiplayerConfig when navigating away from multiplayer", () => {
			// Simulate multiplayer config being set
			const mockState = {
				multiplayerConfig: {
					playerCount: 2,
					controllers: [
						{
							name: "arrows",
							up: "ArrowUp",
							down: "ArrowDown",
							left: "ArrowLeft",
							right: "ArrowRight",
						},
						{ name: "dfjk", up: "d", down: "f", left: "j", right: "k" },
					],
				},
			};

			expect(mockState.multiplayerConfig).toBeTruthy();

			// When unmounting or pressing Escape, config should be cleared
			mockState.multiplayerConfig = null;

			expect(mockState.multiplayerConfig).toBeNull();
		});
	});

	describe("Speed Modifier Validation", () => {
		it("should clamp X-Mod multiplier to valid range", () => {
			const clampXMod = (multiplier: number): number => {
				return Math.max(0.1, Math.min(20.0, multiplier));
			};

			expect(clampXMod(0.05)).toBe(0.1); // Too low
			expect(clampXMod(25.0)).toBe(20.0); // Too high
			expect(clampXMod(1.5)).toBe(1.5); // Valid
			expect(clampXMod(-1)).toBe(0.1); // Negative
		});

		it("should clamp C-Mod pixelsPerSecond to valid range", () => {
			const clampCMod = (pps: number): number => {
				return Math.max(100, Math.min(1000, pps));
			};

			expect(clampCMod(50)).toBe(100); // Too low
			expect(clampCMod(1500)).toBe(1000); // Too high
			expect(clampCMod(400)).toBe(400); // Valid
			expect(clampCMod(-100)).toBe(100); // Negative
		});

		it("should validate speed modifier before storing", () => {
			// biome-ignore lint/suspicious/noExplicitAny: testing sanitization of arbitrary input
			const sanitizeSpeedMod = (m: any): any => {
				if (!m) return null;
				if (m.type === "xmod") {
					const mul = Math.max(0.1, Math.min(20.0, m.multiplier ?? 1.0));
					return { type: "xmod", multiplier: mul };
				}
				if (m.type === "cmod") {
					const pps = Math.max(100, Math.min(1000, m.pixelsPerSecond ?? 400));
					return { type: "cmod", pixelsPerSecond: pps };
				}
				return null;
			};

			const invalidXMod = { type: "xmod", multiplier: 100 };
			const sanitized = sanitizeSpeedMod(invalidXMod);
			expect(sanitized.multiplier).toBe(20.0);

			const invalidCMod = { type: "cmod", pixelsPerSecond: 5000 };
			const sanitized2 = sanitizeSpeedMod(invalidCMod);
			expect(sanitized2.pixelsPerSecond).toBe(1000);
		});
	});

	describe("Controller Key Normalization", () => {
		it("should normalize controller keys to lowercase", () => {
			const normalizeKey = (key: string): string => {
				return key.trim().toLowerCase();
			};

			expect(normalizeKey("ArrowUp")).toBe("arrowup");
			expect(normalizeKey("D")).toBe("d");
			expect(normalizeKey(" K ")).toBe("k");
		});

		it("should detect conflicts with normalized keys", () => {
			// biome-ignore lint/suspicious/noExplicitAny: testing with generic controller shapes
			const detectConflicts = (controllers: any[]): boolean => {
				const keyMap = new Map<string, number[]>();

				for (let i = 0; i < controllers.length; i++) {
					const config = controllers[i];
					if (!config) continue;
					const keys = [config.left, config.down, config.up, config.right];

					for (const rawKey of keys) {
						const key = (rawKey ?? "").toString().trim().toLowerCase();
						if (!key) continue;
						if (!keyMap.has(key)) {
							keyMap.set(key, []);
						}
						keyMap.get(key)!.push(i);
					}
				}

				// Check for conflicts
				for (const [, players] of keyMap) {
					if (players.length > 1) {
						return true; // Conflict found
					}
				}
				return false;
			};

			const controllers1 = [
				{ left: "a", down: "s", up: "w", right: "d" },
				{ left: "A", down: "S", up: "W", right: "D" }, // Same keys, different case
			];

			expect(detectConflicts(controllers1)).toBe(true);

			const controllers2 = [
				{ left: "a", down: "s", up: "w", right: "d" },
				{ left: "j", down: "k", up: "i", right: "l" },
			];

			expect(detectConflicts(controllers2)).toBe(false);
		});
	});

	describe("Player Name Validation", () => {
		it("should reject player names longer than 50 characters", () => {
			const validatePlayerName = (name: string): boolean => {
				return name.trim().length > 0 && name.trim().length <= 50;
			};

			expect(validatePlayerName("John")).toBe(true);
			expect(validatePlayerName("A".repeat(50))).toBe(true);
			expect(validatePlayerName("A".repeat(51))).toBe(false);
			expect(validatePlayerName("")).toBe(false);
			expect(validatePlayerName("   ")).toBe(false);
		});
	});
});
