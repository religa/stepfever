import type { Judgment } from "../scoring/model";
import type { TimingConfig, TimingWindow } from "../timing/model";

const DEFAULT_WINDOWS: Required<TimingWindow> = {
	marvelous: 0.0225,
	perfect: 0.045,
	great: 0.09,
	good: 0.135,
	boo: 0.18,
};

export class JudgmentEngine {
	private readonly windows: Required<TimingWindow>;
	private readonly globalOffset: number;

	constructor(config: Partial<TimingConfig> = {}) {
		this.windows = { ...DEFAULT_WINDOWS, ...config.windows };
		this.globalOffset = config.globalOffset ?? 0;
	}

	/**
	 * Determine judgment for a hit.
	 * @param expectedTime - When the note should be hit (audio time)
	 * @param actualTime - When the player hit (audio time)
	 * @returns The judgment
	 */
	judgeHit(expectedTime: number, actualTime: number): Judgment {
		const adjustedActual = actualTime - this.globalOffset;
		const error = Math.abs(adjustedActual - expectedTime);

		if (error <= this.windows.marvelous) return "marvelous";
		if (error <= this.windows.perfect) return "perfect";
		if (error <= this.windows.great) return "great";
		if (error <= this.windows.good) return "good";
		if (error <= this.windows.boo) return "boo";
		return "miss";
	}

	/**
	 * Check if a note should be marked as missed.
	 * @param expectedTime - When the note should be hit
	 * @param currentTime - Current audio time
	 * @returns True if the note is past the miss window
	 */
	checkMiss(expectedTime: number, currentTime: number): boolean {
		const adjustedCurrent = currentTime - this.globalOffset;
		return adjustedCurrent > expectedTime + this.windows.boo;
	}

	/**
	 * Check if a note is within the hit window (can be hit now).
	 * @param expectedTime - When the note should be hit
	 * @param currentTime - Current audio time
	 * @returns True if the note can be hit
	 */
	isInHitWindow(expectedTime: number, currentTime: number): boolean {
		const adjustedCurrent = currentTime - this.globalOffset;
		const error = Math.abs(adjustedCurrent - expectedTime);
		return error <= this.windows.boo;
	}

	/**
	 * Get signed timing error in milliseconds.
	 * Negative = early, positive = late.
	 */
	getTimingError(expectedTime: number, actualTime: number): number {
		const adjustedActual = actualTime - this.globalOffset;
		return (adjustedActual - expectedTime) * 1000;
	}

	/**
	 * Get the boo window size (for miss detection).
	 */
	getBooWindow(): number {
		return this.windows.boo;
	}
}
