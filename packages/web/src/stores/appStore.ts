/**
 * Backwards compatibility layer - re-exports from split stores
 *
 * The state is now properly split into:
 * - preferencesStore: Persisted settings (playerName, globalOffset, speedModifier, etc.)
 * - sessionStore: Ephemeral game state (selectedSong, selectedDifficulty, multiplayerConfig)
 *
 * New code should import directly from the specific stores.
 * This file provides backwards compatibility for existing code.
 */

import type { SpeedModifier } from "@stepfever/core";
import type { StoreApi } from "zustand/vanilla";
import type { Difficulty, Song } from "../types/api";
import { usePreferences } from "./preferencesStore";
import { type MultiplayerConfig, useSession } from "./sessionStore";

// Re-export types
export type { MultiplayerConfig };

// Combined interface for backwards compatibility
interface CombinedState {
	// From preferencesStore
	playerName: string | null;
	setPlayerName: (name: string | null) => void;
	globalOffset: number;
	setGlobalOffset: (offset: number) => void;
	speedModifier: SpeedModifier | null;
	setSpeedModifier: (modifier: SpeedModifier | null) => void;
	showFps: boolean;
	setShowFps: (show: boolean) => void;
	showTimingDisplay: boolean;
	setShowTimingDisplay: (show: boolean) => void;
	showAudioLatency: boolean;
	setShowAudioLatency: (show: boolean) => void;

	// From sessionStore
	selectedSong: (Song & { difficulties: Difficulty[] }) | null;
	selectedDifficulty: Difficulty | null;
	setSelectedSong: (song: (Song & { difficulties: Difficulty[] }) | null) => void;
	setSelectedDifficulty: (difficulty: Difficulty | null) => void;
	multiplayerConfig: MultiplayerConfig | null;
	setMultiplayerConfig: (config: MultiplayerConfig | null) => void;
}

/**
 * Combined store facade for backwards compatibility
 * Proxies to the split stores (preferencesStore and sessionStore)
 */
export const useAppStore: StoreApi<CombinedState> = {
	getState: () => ({
		...usePreferences.getState(),
		...useSession.getState(),
	}),
	getInitialState: () => ({
		...usePreferences.getInitialState(),
		...useSession.getInitialState(),
	}),
	setState: (partial, _replace) => {
		// Route state updates to appropriate store using dynamic key detection
		const updates = typeof partial === "function" ? partial(useAppStore.getState()) : partial;

		const prefState = usePreferences.getState();
		const sessionState = useSession.getState();

		const prefUpdates: Record<string, unknown> = {};
		const sessionUpdates: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(updates)) {
			if (key in prefState) {
				prefUpdates[key] = value;
			} else if (key in sessionState) {
				sessionUpdates[key] = value;
			}
		}

		if (Object.keys(prefUpdates).length > 0) {
			usePreferences.setState(prefUpdates as unknown as Parameters<typeof usePreferences.setState>[0]);
		}
		if (Object.keys(sessionUpdates).length > 0) {
			useSession.setState(sessionUpdates as unknown as Parameters<typeof useSession.setState>[0]);
		}
	},
	subscribe: (listener) => {
		// Track previous state for proper change detection
		let prevState = useAppStore.getState();

		const notify = () => {
			const nextState = useAppStore.getState();
			listener(nextState, prevState);
			prevState = nextState;
		};

		// Subscribe to both stores
		const unsubPrefs = usePreferences.subscribe(notify);
		const unsubSession = useSession.subscribe(notify);

		return () => {
			unsubPrefs();
			unsubSession();
		};
	},
};
