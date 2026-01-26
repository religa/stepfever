import type { ControllerConfig } from "@stepfever/core";
import { createStore } from "zustand/vanilla";
import type { Difficulty, Song } from "../types/api";
import type { GamepadConfig } from "./preferencesStore";

export interface MultiplayerConfig {
	playerCount: number;
	controllers: ControllerConfig[];
	gamepadAssignments: (number | null)[]; // Gamepad index per player (null = keyboard-only)
	gamepadConfig?: GamepadConfig | null; // Shared gamepad config from preferences
}

export type SongSortOption = "title" | "bpm" | "difficulty" | "recent" | "playCount";

export interface SongFilters {
	query: string;
	sort: SongSortOption;
}

interface SessionState {
	// Song selection (ephemeral - clears on reload)
	selectedSong: (Song & { difficulties: Difficulty[] }) | null;
	selectedDifficulty: Difficulty | null;
	setSelectedSong: (song: (Song & { difficulties: Difficulty[] }) | null) => void;
	setSelectedDifficulty: (difficulty: Difficulty | null) => void;

	// Multiplayer configuration (ephemeral - clears on reload)
	multiplayerConfig: MultiplayerConfig | null;
	setMultiplayerConfig: (config: MultiplayerConfig | null) => void;

	// Song filters (client-side filtering)
	songFilters: SongFilters;
	setFilters: (partial: Partial<SongFilters>) => void;
}

export const useSession = createStore<SessionState>()((set) => ({
	selectedSong: null,
	selectedDifficulty: null,
	setSelectedSong: (song) => set({ selectedSong: song }),
	setSelectedDifficulty: (difficulty) => set({ selectedDifficulty: difficulty }),

	multiplayerConfig: null,
	setMultiplayerConfig: (config) => set({ multiplayerConfig: config }),

	songFilters: { query: "", sort: "title" },
	setFilters: (partial) =>
		set((state) => ({
			songFilters: { ...state.songFilters, ...partial },
		})),
}));
