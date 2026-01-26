import type { SpeedModifier } from "./model";

const BASE_SCROLL_SPEED = 200; // pixels per second at 1.0x and 120 BPM

/**
 * Calculate scroll speed in pixels per second
 */
export function calculateScrollSpeed(modifier: SpeedModifier | null, currentBpm: number): number {
	if (!modifier) {
		// Default: 1.0x at current BPM
		return (BASE_SCROLL_SPEED * currentBpm) / 120;
	}

	if (modifier.type === "xmod") {
		// X-Mod scales with BPM
		return (BASE_SCROLL_SPEED * modifier.multiplier * currentBpm) / 120;
	}

	// C-Mod: constant speed regardless of BPM
	return modifier.pixelsPerSecond;
}

/**
 * Calculate how many beats ahead are visible based on scroll speed
 */
export function calculateVisibilityWindow(scrollSpeed: number, screenHeight: number, currentBpm = 120): number {
	// Guard against invalid scroll speeds
	if (!Number.isFinite(scrollSpeed) || scrollSpeed <= 0) {
		return 0;
	}

	// How many seconds are visible on screen
	const visibleSeconds = screenHeight / scrollSpeed;

	// Convert to beats using actual current BPM
	const beatsPerSecond = currentBpm / 60;
	return visibleSeconds * beatsPerSecond;
}

// Preset speed modifiers (12 common presets)
export const SPEED_PRESETS: Record<string, SpeedModifier> = {
	"0.5x": { type: "xmod", multiplier: 0.5 },
	"0.75x": { type: "xmod", multiplier: 0.75 },
	"1.0x": { type: "xmod", multiplier: 1.0 },
	"1.25x": { type: "xmod", multiplier: 1.25 },
	"1.5x": { type: "xmod", multiplier: 1.5 },
	"2.0x": { type: "xmod", multiplier: 2.0 },
	"2.5x": { type: "xmod", multiplier: 2.5 },
	"3.0x": { type: "xmod", multiplier: 3.0 },
	C300: { type: "cmod", pixelsPerSecond: 300 },
	C400: { type: "cmod", pixelsPerSecond: 400 },
	C500: { type: "cmod", pixelsPerSecond: 500 },
	C600: { type: "cmod", pixelsPerSecond: 600 },
};
