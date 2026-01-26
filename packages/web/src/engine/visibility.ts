/**
 * Visibility calculation utilities for the game engine.
 * Shared by both single-player GameEngine and MultiplayerEngine.
 */

/** Y position where receptors are placed (notes scroll toward this) */
const RECEPTOR_Y = 100;

/** Default number of beats to look ahead if calculation fails */
const DEFAULT_BEATS_AHEAD = 8;

interface LookAheadParams {
	/** Height of the viewport in pixels */
	viewportHeight: number;
	/** Current scroll speed in pixels per second */
	scrollSpeed: number;
	/** Current BPM of the song */
	bpm: number;
}

/**
 * Calculate how many beats of notes should be visible on screen.
 * This ensures notes appear before reaching the receptor line and
 * provides a buffer for smooth scrolling.
 *
 * @param params - The parameters for the calculation
 * @returns Number of beats to look ahead (always at least DEFAULT_BEATS_AHEAD)
 */
export function calculateBeatsAhead(params: LookAheadParams): number {
	const { viewportHeight, scrollSpeed, bpm } = params;

	// Guard against invalid inputs
	if (!Number.isFinite(scrollSpeed) || scrollSpeed <= 0) {
		return DEFAULT_BEATS_AHEAD;
	}

	if (!Number.isFinite(bpm) || bpm <= 0) {
		return DEFAULT_BEATS_AHEAD;
	}

	// Convert pixels per second to pixels per beat
	// pixels/sec ÷ (beats/sec) = pixels/beat
	const beatsPerSecond = bpm / 60;
	const pixelsPerBeat = scrollSpeed / beatsPerSecond;

	if (!Number.isFinite(pixelsPerBeat) || pixelsPerBeat <= 0) {
		return DEFAULT_BEATS_AHEAD;
	}

	// Calculate beats needed to fill from receptor to bottom of screen
	// Add 2 beats as buffer for smooth scrolling
	const visibleBeats = Math.ceil((viewportHeight - RECEPTOR_Y) / pixelsPerBeat) + 2;

	return Math.max(visibleBeats, DEFAULT_BEATS_AHEAD);
}
