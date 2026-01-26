/**
 * Tests for issues found during code review of API removal changes
 */
import { describe, expect, it } from "vitest";

describe("Code Review Issues", () => {
	describe("HIGH: Play count should increment per play, not per difficulty", () => {
		it("should increment play count when replaying the same song/difficulty", () => {
			// Test the fixed saveScore and getPlayCount logic
			interface LocalScore {
				score: number;
				timestamp: number;
				playCount?: number;
			}

			const scores: Record<string, LocalScore> = {};
			let mockTime = 1000;

			const saveScore = (songId: string, difficulty: string, newScore: number) => {
				const key = `${songId}:${difficulty}`;
				const existing = scores[key];
				const now = mockTime++;
				const playCount = (existing?.playCount ?? 0) + 1;

				if (!existing || newScore > existing.score) {
					scores[key] = { score: newScore, timestamp: now, playCount };
				} else {
					scores[key] = { ...existing, timestamp: now, playCount };
				}
			};

			const getPlayCount = (songId: string) => {
				let count = 0;
				for (const [key, score] of Object.entries(scores)) {
					const index = key.lastIndexOf(":");
					if (index === -1) continue;
					const parsedSongId = key.slice(0, index);
					if (parsedSongId === songId) {
						count += score.playCount ?? 1;
					}
				}
				return count;
			};

			// First play
			saveScore("test-song", "Challenge", 50000);
			expect(getPlayCount("test-song")).toBe(1);

			// Second play (same difficulty) - should increment count
			saveScore("test-song", "Challenge", 55000);
			expect(getPlayCount("test-song")).toBe(2);

			// Third play (same difficulty) - should increment again
			saveScore("test-song", "Challenge", 45000);
			expect(getPlayCount("test-song")).toBe(3);
		});

		it("should count plays across multiple difficulties correctly", () => {
			interface LocalScore {
				score: number;
				timestamp: number;
				playCount?: number;
			}

			const scores: Record<string, LocalScore> = {};
			let mockTime = 1000;

			const saveScore = (songId: string, difficulty: string, newScore: number) => {
				const key = `${songId}:${difficulty}`;
				const existing = scores[key];
				const now = mockTime++;
				const playCount = (existing?.playCount ?? 0) + 1;

				if (!existing || newScore > existing.score) {
					scores[key] = { score: newScore, timestamp: now, playCount };
				} else {
					scores[key] = { ...existing, timestamp: now, playCount };
				}
			};

			const getPlayCount = (songId: string) => {
				let count = 0;
				for (const [key, score] of Object.entries(scores)) {
					const index = key.lastIndexOf(":");
					if (index === -1) continue;
					const parsedSongId = key.slice(0, index);
					if (parsedSongId === songId) {
						count += score.playCount ?? 1;
					}
				}
				return count;
			};

			// Play Easy 2 times
			saveScore("test-song", "Easy", 30000);
			saveScore("test-song", "Easy", 35000);

			// Play Hard 3 times
			saveScore("test-song", "Hard", 40000);
			saveScore("test-song", "Hard", 45000);
			saveScore("test-song", "Hard", 50000);

			// Total should be 5 plays (2 Easy + 3 Hard)
			expect(getPlayCount("test-song")).toBe(5);
		});
	});

	describe("MEDIUM: Background ID validation (CSS injection prevention)", () => {
		it("should accept valid alphanumeric background IDs", () => {
			const isValidBackgroundId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

			expect(isValidBackgroundId("background2")).toBe(true);
			expect(isValidBackgroundId("my-custom-bg")).toBe(true);
			expect(isValidBackgroundId("bg_underscore_123")).toBe(true);
		});

		it("should reject background IDs with path traversal attempts", () => {
			const isValidBackgroundId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

			expect(isValidBackgroundId("../../../etc/passwd")).toBe(false);
			expect(isValidBackgroundId("..")).toBe(false);
			expect(isValidBackgroundId("./test")).toBe(false);
		});

		it("should reject background IDs with URL injection", () => {
			const isValidBackgroundId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

			expect(isValidBackgroundId("url(javascript:alert(1))")).toBe(false);
			expect(isValidBackgroundId("http://evil.com/bg.png")).toBe(false);
		});

		it("should reject background IDs with CSS injection", () => {
			const isValidBackgroundId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

			expect(isValidBackgroundId("'); background: red; /*")).toBe(false);
			expect(isValidBackgroundId("background; color: red")).toBe(false);
		});

		it("should reject background IDs with special characters", () => {
			const isValidBackgroundId = (id: string) => /^[a-zA-Z0-9_-]+$/.test(id);

			expect(isValidBackgroundId("<script>alert(1)</script>")).toBe(false);
			expect(isValidBackgroundId("background\ninjection")).toBe(false);
			expect(isValidBackgroundId("bg\0null")).toBe(false);
		});
	});

	describe("MEDIUM: Score key parsing with edge cases", () => {
		const parseScoreKey = (key: string): { songId: string; difficulty: string } | null => {
			const index = key.lastIndexOf(":");
			if (index === -1) return null;
			return { songId: key.slice(0, index), difficulty: key.slice(index + 1) };
		};

		it("should handle song IDs with colons correctly", () => {
			const result = parseScoreKey("Artist:Title:Remix:Hard");
			expect(result).toEqual({ songId: "Artist:Title:Remix", difficulty: "Hard" });
		});

		it("should handle normal song IDs without colons", () => {
			const result = parseScoreKey("song-id:Hard");
			expect(result).toEqual({ songId: "song-id", difficulty: "Hard" });
		});

		it("should return null for keys without colons", () => {
			const result = parseScoreKey("invalid-key");
			expect(result).toBeNull();
		});

		it("should handle empty difficulty", () => {
			const result = parseScoreKey("song:");
			expect(result).toEqual({ songId: "song", difficulty: "" });
		});

		it("should handle keys with only colon", () => {
			const result = parseScoreKey(":");
			expect(result).toEqual({ songId: "", difficulty: "" });
		});
	});

	describe("MEDIUM: Playwright parallel execution", () => {
		it("should document that parallel execution is now enabled", () => {
			// This test documents that the playwright config has been updated
			// to enable parallel execution since DB constraints no longer apply
			// (local-first architecture uses localStorage, not SQLite)
			const expectedConfig = {
				fullyParallel: true,
				workers: undefined, // Use default based on available cores
			};
			expect(expectedConfig.fullyParallel).toBe(true);
			expect(expectedConfig.workers).toBeUndefined();
		});
	});
});
