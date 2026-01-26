import type { SpeedModifier } from "@stepfever/core";
import { persist } from "zustand/middleware";
import { createStore } from "zustand/vanilla";

// Gamepad input mapping types
export type InputMapping = { type: "button"; index: number } | { type: "axis"; index: number; direction: 1 | -1 };

export interface GamepadConfig {
	name: string;
	left: InputMapping;
	down: InputMapping;
	up: InputMapping;
	right: InputMapping;
	menu?: InputMapping; // Maps to Escape key
	select?: InputMapping; // Maps to Enter key
}

interface PreferencesState {
	// Player name (stored locally, no authentication)
	playerName: string | null;
	setPlayerName: (name: string | null) => void;

	// Global offset (audio calibration)
	globalOffset: number;
	setGlobalOffset: (offset: number) => void;

	// Speed modifier (X-Mod or C-Mod)
	speedModifier: SpeedModifier | null;
	setSpeedModifier: (modifier: SpeedModifier | null) => void;

	// FPS counter display toggle
	showFps: boolean;
	setShowFps: (show: boolean) => void;

	// Timing display toggle (show ms error on judgments)
	showTimingDisplay: boolean;
	setShowTimingDisplay: (show: boolean) => void;

	// Audio latency display toggle (debug-only, shows system audio latency)
	showAudioLatency: boolean;
	setShowAudioLatency: (show: boolean) => void;

	// Per-song offsets (songId/chartUrl → offset in seconds)
	songOffsets: Record<string, number>;
	setSongOffset: (key: string, offset: number) => void;
	getSongOffset: (key: string) => number;
	clearSongOffset: (key: string) => void;

	// Gamepad configuration
	gamepadConfig: GamepadConfig | null;
	setGamepadConfig: (config: GamepadConfig | null) => void;

	// Background image selection
	background: string;
	setBackground: (id: string) => void;

	// Menu sounds (click/navigate audio feedback)
	menuSounds: boolean;
	setMenuSounds: (enabled: boolean) => void;
}

export const usePreferences = createStore<PreferencesState>()(
	persist(
		(set, get) => ({
			playerName: "Player 1",
			setPlayerName: (name) => set({ playerName: name }),

			globalOffset: 0,
			setGlobalOffset: (offset) => set({ globalOffset: offset }),

			speedModifier: null,
			setSpeedModifier: (modifier) => {
				// Sanitize speed modifier to prevent out-of-range values
				const sanitize = (m: SpeedModifier | null): SpeedModifier | null => {
					if (!m) return null;
					if ((m as { type: string }).type === "xmod") {
						const mul = Math.max(0.1, Math.min(20.0, (m as { multiplier?: number }).multiplier ?? 1.0));
						return { type: "xmod", multiplier: mul };
					}
					if ((m as { type: string }).type === "cmod") {
						const pps = Math.max(100, Math.min(1000, (m as { pixelsPerSecond?: number }).pixelsPerSecond ?? 400));
						return { type: "cmod", pixelsPerSecond: pps };
					}
					return null;
				};
				set({ speedModifier: sanitize(modifier) });
			},

			showFps: false,
			setShowFps: (show) => set({ showFps: show }),

			showTimingDisplay: false,
			setShowTimingDisplay: (show) => set({ showTimingDisplay: show }),

			showAudioLatency: false,
			setShowAudioLatency: (show) => set({ showAudioLatency: show }),

			songOffsets: {},
			setSongOffset: (key, offset) =>
				set((state) => ({
					songOffsets: { ...state.songOffsets, [key]: offset },
				})),
			getSongOffset: (key) => get().songOffsets[key] ?? 0,
			clearSongOffset: (key) =>
				set((state) => {
					const { [key]: _, ...rest } = state.songOffsets;
					return { songOffsets: rest };
				}),

			gamepadConfig: null,
			setGamepadConfig: (config) => set({ gamepadConfig: config }),

			background: "background2",
			setBackground: (id) => {
				// Validate background ID to prevent CSS injection
				// Only allow alphanumeric, hyphen, and underscore
				if (/^[a-zA-Z0-9_-]+$/.test(id)) {
					set({ background: id });
				}
				// Invalid IDs are silently ignored (keep previous value)
			},

			menuSounds: true,
			setMenuSounds: (enabled) => set({ menuSounds: enabled }),
		}),
		{
			name: "stepfever-preferences",
		},
	),
);
