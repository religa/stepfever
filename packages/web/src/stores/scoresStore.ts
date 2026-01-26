import type { Grade } from "@stepfever/core";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

export interface LocalScore {
	score: number;
	accuracy: number;
	grade: Grade;
	maxCombo: number;
	judgments: {
		marvelous: number;
		perfect: number;
		great: number;
		good: number;
		boo: number;
		miss: number;
	};
	timestamp: number;
	playCount?: number; // Track number of plays per song/difficulty
}

type ScoreKey = `${string}:${string}`; // songId:difficulty

// Parse score key using lastIndexOf to handle song IDs with colons
function parseScoreKey(key: string): { songId: string; difficulty: string } | null {
	const index = key.lastIndexOf(":");
	if (index === -1) return null;
	return { songId: key.slice(0, index), difficulty: key.slice(index + 1) };
}

interface ScoresState {
	scores: Record<ScoreKey, LocalScore>;
	saveScore: (songId: string, difficulty: string, score: Omit<LocalScore, "timestamp" | "playCount">) => void;
	getBestScore: (songId: string, difficulty: string) => LocalScore | undefined;
	getPlayCount: (songId: string) => number;
	getAllScoresForSong: (songId: string) => LocalScore[];
}

export const scoresStore = createStore<ScoresState>()(
	persist(
		(set, get) => ({
			scores: {},

			saveScore: (songId, difficulty, newScore) => {
				const key: ScoreKey = `${songId}:${difficulty}`;
				const existing = get().scores[key];
				const now = Date.now();
				const playCount = (existing?.playCount ?? 0) + 1;

				if (!existing || newScore.score > existing.score) {
					// New high score - save full score data with incremented play count
					set((state) => ({
						scores: {
							...state.scores,
							[key]: { ...newScore, timestamp: now, playCount },
						},
					}));
				} else {
					// Not a high score, but update timestamp and play count
					set((state) => ({
						scores: {
							...state.scores,
							[key]: { ...existing, timestamp: now, playCount },
						},
					}));
				}
			},

			getBestScore: (songId, difficulty) => {
				return get().scores[`${songId}:${difficulty}`];
			},

			getPlayCount: (songId) => {
				const scores = get().scores;
				let count = 0;
				for (const [key, score] of Object.entries(scores)) {
					const parsed = parseScoreKey(key);
					if (parsed?.songId === songId) {
						// Sum playCount for each difficulty entry
						count += score.playCount ?? 1;
					}
				}
				return count;
			},

			getAllScoresForSong: (songId) => {
				const scores = get().scores;
				const result: LocalScore[] = [];
				for (const [key, score] of Object.entries(scores)) {
					const parsed = parseScoreKey(key);
					if (parsed?.songId === songId) {
						result.push(score);
					}
				}
				return result.sort((a, b) => b.timestamp - a.timestamp);
			},
		}),
		{ name: "stepfever-scores" },
	),
);
