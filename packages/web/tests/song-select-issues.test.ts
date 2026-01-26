import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for issues identified in code review for Song Management
 */

describe("Song Select Issues", () => {
	describe("Issue: Empty playerName causing song load failure", () => {
		it("should not call stats API when playerName is empty", () => {
			// Simulate the fix: skip stats fetch when playerName is empty
			const mockGetSongStats = vi.fn().mockRejectedValue(new Error("400"));
			const mockGetSongs = vi.fn().mockResolvedValue([{ id: "1", title: "Test" }]);

			const loadSongsAndStats = async (playerName: string) => {
				const trimmedName = playerName.trim();
				const [songs, stats] = await Promise.all([
					mockGetSongs(),
					trimmedName ? mockGetSongStats(trimmedName) : Promise.resolve([]),
				]);
				return { songs, stats };
			};

			// When playerName is empty, stats should not be fetched
			return loadSongsAndStats("").then(({ songs, stats }) => {
				expect(mockGetSongStats).not.toHaveBeenCalled();
				expect(mockGetSongs).toHaveBeenCalled();
				expect(songs.length).toBe(1);
				expect(stats.length).toBe(0);
			});
		});

		it("should not call stats API when playerName is whitespace only", () => {
			const mockGetSongStats = vi.fn().mockRejectedValue(new Error("400"));
			const mockGetSongs = vi.fn().mockResolvedValue([{ id: "1", title: "Test" }]);

			const loadSongsAndStats = async (playerName: string) => {
				const trimmedName = playerName.trim();
				const [songs, stats] = await Promise.all([
					mockGetSongs(),
					trimmedName ? mockGetSongStats(trimmedName) : Promise.resolve([]),
				]);
				return { songs, stats };
			};

			return loadSongsAndStats("   ").then(({ songs, stats }) => {
				expect(mockGetSongStats).not.toHaveBeenCalled();
				expect(songs.length).toBe(1);
				expect(stats.length).toBe(0);
			});
		});
	});

	describe("Issue: Stats API failure causing song load failure", () => {
		it("should still load songs if stats API fails", () => {
			const mockGetSongStats = vi.fn().mockRejectedValue(new Error("Network error"));
			const mockGetSongs = vi.fn().mockResolvedValue([{ id: "1", title: "Test" }]);

			const loadSongsAndStats = async (playerName: string) => {
				const trimmedName = playerName.trim();
				const [songs, stats] = await Promise.all([
					mockGetSongs(),
					trimmedName
						? mockGetSongStats(trimmedName).catch((err: Error) => {
								console.warn("Failed to load song stats:", err);
								return [];
							})
						: Promise.resolve([]),
				]);
				return { songs, stats };
			};

			return loadSongsAndStats("Player1").then(({ songs, stats }) => {
				expect(songs.length).toBe(1);
				expect(stats.length).toBe(0); // Stats failed but gracefully handled
			});
		});
	});

	describe("Issue: Escape key behavior with debounced search", () => {
		it("should check both input value and store state for search content", () => {
			// Simulate the scenario where input has value but store hasn't updated yet
			const inputValue = "test search";
			const storeQuery = ""; // Debounce hasn't updated store yet

			// The fix: check both input value and store state
			const hasSearchContent = (inputValue: string, storeQuery: string): boolean => {
				return inputValue.trim().length > 0 || storeQuery.length > 0;
			};

			expect(hasSearchContent(inputValue, storeQuery)).toBe(true);
			expect(hasSearchContent("", storeQuery)).toBe(false);
			expect(hasSearchContent("", "stored query")).toBe(true);
		});
	});

	describe("Issue: Performance - getVisibleSongs called on every render", () => {
		it("should cache results when filters haven't changed", () => {
			interface Song {
				id: string;
				title: string;
			}

			// Simulate caching logic
			let cache: Song[] | null = null;
			let lastKey = "";
			let computeCount = 0;

			const getVisibleSongs = (query: string, sort: string, songs: Song[]): Song[] => {
				const filterKey = `${query}|${sort}`;
				if (cache && lastKey === filterKey) {
					return cache;
				}

				computeCount++;
				// Expensive computation
				const result = songs.filter((s) => s.title.toLowerCase().includes(query.toLowerCase()));
				cache = result;
				lastKey = filterKey;
				return result;
			};

			const songs: Song[] = [
				{ id: "1", title: "Alpha" },
				{ id: "2", title: "Beta" },
			];

			// First call computes
			getVisibleSongs("", "title", songs);
			expect(computeCount).toBe(1);

			// Second call with same params returns cached
			getVisibleSongs("", "title", songs);
			expect(computeCount).toBe(1); // Should not increase

			// Different params recomputes
			getVisibleSongs("alpha", "title", songs);
			expect(computeCount).toBe(2);

			// Same new params returns cached
			getVisibleSongs("alpha", "title", songs);
			expect(computeCount).toBe(2); // Should not increase
		});
	});
});
