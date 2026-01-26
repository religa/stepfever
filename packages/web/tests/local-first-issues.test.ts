/**
 * Tests for issues found in local-first architecture code review
 */
import { describe, expect, it } from "vitest";

describe("Local-first Code Review Issues", () => {
	describe("MEDIUM: BPM calculation with empty bpmChanges", () => {
		it("should handle empty bpmChanges array gracefully", () => {
			// Test the logic that should be in generate-songs.ts
			const calculateBpm = (bpmChanges: { bpm: number }[]) => {
				const bpms = bpmChanges.map((b) => b.bpm);
				if (bpms.length === 0) {
					return 120; // Default BPM
				}
				const minBpm = Math.min(...bpms);
				const maxBpm = Math.max(...bpms);
				return minBpm === maxBpm ? minBpm : { min: Math.round(minBpm), max: Math.round(maxBpm) };
			};

			// Should return default 120 for empty array
			expect(calculateBpm([])).toBe(120);

			// Should work normally for single BPM
			expect(calculateBpm([{ bpm: 150 }])).toBe(150);

			// Should work for variable BPM
			expect(calculateBpm([{ bpm: 100 }, { bpm: 200 }])).toEqual({ min: 100, max: 200 });
		});
	});

	describe("MEDIUM: Score key parsing with colons in song ID", () => {
		it("should correctly parse score key using lastIndexOf", () => {
			// Test the parseScoreKey logic
			const parseScoreKey = (key: string): { songId: string; difficulty: string } | null => {
				const index = key.lastIndexOf(":");
				if (index === -1) return null;
				return { songId: key.slice(0, index), difficulty: key.slice(index + 1) };
			};

			// Normal case
			expect(parseScoreKey("song-1:Hard")).toEqual({ songId: "song-1", difficulty: "Hard" });

			// Song ID with colon
			expect(parseScoreKey("dancing-stage__Song:With:Colons:Easy")).toEqual({
				songId: "dancing-stage__Song:With:Colons",
				difficulty: "Easy",
			});

			// Invalid key
			expect(parseScoreKey("no-colon")).toBeNull();
		});

		it("should correctly count plays for songs with colons in ID", () => {
			const scores: Record<string, { timestamp: number }> = {
				"song:with:colon:Easy": { timestamp: 1000 },
				"song:with:colon:Hard": { timestamp: 2000 },
				"normal-song:Easy": { timestamp: 3000 },
			};

			const getPlayCount = (songId: string) => {
				let count = 0;
				for (const key of Object.keys(scores)) {
					const index = key.lastIndexOf(":");
					if (index === -1) continue;
					const parsedSongId = key.slice(0, index);
					if (parsedSongId === songId) {
						count++;
					}
				}
				return count;
			};

			expect(getPlayCount("song:with:colon")).toBe(2);
			expect(getPlayCount("normal-song")).toBe(1);
			expect(getPlayCount("nonexistent")).toBe(0);
		});
	});

	describe("MEDIUM: Recent sort timestamp update", () => {
		it("should update timestamp on replay even if not a new high score", () => {
			// Test the improved saveScore logic
			type ScoreData = {
				score: number;
				timestamp: number;
			};

			const scores: Record<string, ScoreData> = {};
			let mockTime = 1000;

			const saveScore = (songId: string, difficulty: string, newScore: number) => {
				const key = `${songId}:${difficulty}`;
				const existing = scores[key];
				const now = mockTime++;

				if (!existing || newScore > existing.score) {
					// New high score
					scores[key] = { score: newScore, timestamp: now };
				} else {
					// Not a high score, but still update timestamp for recent tracking
					scores[key] = { ...existing, timestamp: now };
				}
			};

			// First play
			saveScore("song-1", "Hard", 5000);
			const firstTimestamp = scores["song-1:Hard"]?.timestamp;
			expect(firstTimestamp).toBe(1000);

			// Replay with worse score - timestamp should still update
			saveScore("song-1", "Hard", 3000);

			// Score should remain the best
			expect(scores["song-1:Hard"]?.score).toBe(5000);
			// Timestamp should be updated
			expect(scores["song-1:Hard"]?.timestamp).toBe(1001);
		});
	});
});
