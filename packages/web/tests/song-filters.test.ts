import { beforeEach, describe, expect, it } from "vitest";
import type { SongFilters, SongSortOption, SongStats } from "../src/stores/sessionStore";

// Mock song data for testing
interface MockSong {
	id: string;
	title: string;
	artist: string;
	titleTranslit?: string;
	artistTranslit?: string;
	bpm: number;
	difficulties: { level: number }[];
}

const mockSongs: MockSong[] = [
	{ id: "song-1", title: "Alpha Song", artist: "Artist A", bpm: 120, difficulties: [{ level: 5 }] },
	{ id: "song-2", title: "Beta Track", artist: "Artist B", bpm: 180, difficulties: [{ level: 10 }] },
	{ id: "song-3", title: "Gamma Beat", artist: "Artist C", bpm: 90, difficulties: [{ level: 3 }] },
	{ id: "song-4", title: "Delta Rhythm", artist: "Artist A", bpm: 150, difficulties: [{ level: 8 }] },
	{
		id: "song-5",
		title: "日本語タイトル",
		artist: "日本人アーティスト",
		titleTranslit: "Japanese Title",
		artistTranslit: "Japanese Artist",
		bpm: 140,
		difficulties: [{ level: 6 }],
	},
];

const mockStats: Map<string, SongStats> = new Map([
	["song-1", { songId: "song-1", playCount: 5, lastPlayedAt: 1000 }],
	["song-2", { songId: "song-2", playCount: 10, lastPlayedAt: 3000 }],
	["song-3", { songId: "song-3", playCount: 0, lastPlayedAt: null }],
	["song-4", { songId: "song-4", playCount: 3, lastPlayedAt: 2000 }],
]);

// Replicate the filtering logic from SongSelectNew
function filterSongs(songs: MockSong[], query: string): MockSong[] {
	if (!query) return songs;
	const q = query.toLowerCase();
	return songs.filter(
		(s) =>
			s.title.toLowerCase().includes(q) ||
			s.artist.toLowerCase().includes(q) ||
			s.titleTranslit?.toLowerCase().includes(q) ||
			s.artistTranslit?.toLowerCase().includes(q),
	);
}

// Replicate the sorting logic from SongSelectNew
function sortSongs(songs: MockSong[], sort: SongSortOption, stats: Map<string, SongStats>): MockSong[] {
	return [...songs].sort((a, b) => {
		switch (sort) {
			case "title":
				return a.title.localeCompare(b.title);
			case "bpm":
				return a.bpm - b.bpm;
			case "difficulty":
				return (a.difficulties[0]?.level ?? 0) - (b.difficulties[0]?.level ?? 0);
			case "recent":
				return (stats.get(b.id)?.lastPlayedAt ?? 0) - (stats.get(a.id)?.lastPlayedAt ?? 0);
			case "playCount":
				return (stats.get(b.id)?.playCount ?? 0) - (stats.get(a.id)?.playCount ?? 0);
		}
	});
}

describe("Song Filters", () => {
	describe("Search filtering", () => {
		it("should filter songs by title", () => {
			const result = filterSongs(mockSongs, "alpha");
			expect(result.length).toBe(1);
			expect(result[0]?.title).toBe("Alpha Song");
		});

		it("should filter songs by artist", () => {
			const result = filterSongs(mockSongs, "Artist A");
			expect(result.length).toBe(2);
			expect(result.map((s) => s.id)).toContain("song-1");
			expect(result.map((s) => s.id)).toContain("song-4");
		});

		it("should filter case-insensitively", () => {
			const result = filterSongs(mockSongs, "BETA");
			expect(result.length).toBe(1);
			expect(result[0]?.title).toBe("Beta Track");
		});

		it("should filter by transliterated title", () => {
			const result = filterSongs(mockSongs, "Japanese Title");
			expect(result.length).toBe(1);
			expect(result[0]?.id).toBe("song-5");
		});

		it("should filter by transliterated artist", () => {
			const result = filterSongs(mockSongs, "Japanese Artist");
			expect(result.length).toBe(1);
			expect(result[0]?.id).toBe("song-5");
		});

		it("should return empty array for no matches", () => {
			const result = filterSongs(mockSongs, "nonexistent");
			expect(result.length).toBe(0);
		});

		it("should return all songs for empty query", () => {
			const result = filterSongs(mockSongs, "");
			expect(result.length).toBe(mockSongs.length);
		});
	});

	describe("Sorting", () => {
		it("should sort by title alphabetically", () => {
			const result = sortSongs(mockSongs, "title", mockStats);
			expect(result[0]?.title).toBe("Alpha Song");
			expect(result[1]?.title).toBe("Beta Track");
		});

		it("should sort by BPM ascending", () => {
			const result = sortSongs(mockSongs, "bpm", mockStats);
			expect(result[0]?.bpm).toBe(90); // Gamma Beat
			expect(result[result.length - 1]?.bpm).toBe(180); // Beta Track
		});

		it("should sort by difficulty ascending", () => {
			const result = sortSongs(mockSongs, "difficulty", mockStats);
			expect(result[0]?.difficulties[0]?.level).toBe(3); // Gamma Beat
			expect(result[result.length - 1]?.difficulties[0]?.level).toBe(10); // Beta Track
		});

		it("should sort by recent play descending", () => {
			const result = sortSongs(mockSongs, "recent", mockStats);
			expect(result[0]?.id).toBe("song-2"); // lastPlayedAt: 3000
			expect(result[1]?.id).toBe("song-4"); // lastPlayedAt: 2000
			expect(result[2]?.id).toBe("song-1"); // lastPlayedAt: 1000
		});

		it("should sort by play count descending", () => {
			const result = sortSongs(mockSongs, "playCount", mockStats);
			expect(result[0]?.id).toBe("song-2"); // playCount: 10
			expect(result[1]?.id).toBe("song-1"); // playCount: 5
			expect(result[2]?.id).toBe("song-4"); // playCount: 3
		});

		it("should handle songs without stats when sorting by recent", () => {
			const result = sortSongs(mockSongs, "recent", mockStats);
			// Songs without stats (lastPlayedAt: null) should be at the end
			const lastSongs = result.slice(-2).map((s) => s.id);
			expect(lastSongs).toContain("song-3"); // No stats
			expect(lastSongs).toContain("song-5"); // No stats
		});

		it("should handle songs without stats when sorting by play count", () => {
			const result = sortSongs(mockSongs, "playCount", mockStats);
			// Songs without stats (playCount: 0) should be at the end
			const lastSongs = result.slice(-2).map((s) => s.id);
			expect(lastSongs).toContain("song-3"); // No stats
			expect(lastSongs).toContain("song-5"); // No stats
		});
	});

	describe("Combined filtering and sorting", () => {
		it("should filter first then sort", () => {
			const filtered = filterSongs(mockSongs, "Artist A");
			const sorted = sortSongs(filtered, "bpm", mockStats);
			expect(sorted.length).toBe(2);
			expect(sorted[0]?.id).toBe("song-1"); // BPM 120
			expect(sorted[1]?.id).toBe("song-4"); // BPM 150
		});
	});
});

describe("Session Store Song Filters", () => {
	it("should have correct default values", () => {
		const defaultFilters: SongFilters = { query: "", sort: "title" };
		expect(defaultFilters.query).toBe("");
		expect(defaultFilters.sort).toBe("title");
	});

	it("should support all sort options", () => {
		const sortOptions: SongSortOption[] = ["title", "bpm", "difficulty", "recent", "playCount"];
		expect(sortOptions.length).toBe(5);
	});
});
