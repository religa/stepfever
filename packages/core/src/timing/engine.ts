import type { BPMChange, Stop } from "../chart/model";

export class TimingEngine {
	private readonly bpmChanges: readonly BPMChange[];
	private readonly stops: readonly Stop[];
	private readonly offset: number;

	// Pre-computed cumulative times at each BPM change
	private readonly segmentTimes: readonly number[];

	constructor(bpmChanges: BPMChange[], stops: Stop[], offset: number) {
		this.bpmChanges = [...bpmChanges].sort((a, b) => a.beat - b.beat);
		this.stops = [...stops].sort((a, b) => a.beat - b.beat);
		this.offset = offset;

		// Ensure we have at least one BPM
		if (this.bpmChanges.length === 0) {
			this.bpmChanges = [{ beat: 0, bpm: 120 }];
		}

		// Pre-compute cumulative times
		this.segmentTimes = this.computeSegmentTimes();
	}

	private computeSegmentTimes(): number[] {
		const times: number[] = [this.offset];

		for (let i = 1; i < this.bpmChanges.length; i++) {
			const prevBPM = this.bpmChanges[i - 1];
			const currBPM = this.bpmChanges[i];
			if (!prevBPM || !currBPM) continue;

			const beatDelta = currBPM.beat - prevBPM.beat;
			const secondsPerBeat = 60 / prevBPM.bpm;
			const prevTime = times[i - 1] ?? 0;
			times.push(prevTime + beatDelta * secondsPerBeat);
		}

		return times;
	}

	/**
	 * Convert a beat position to audio time in seconds.
	 * Does not account for stops (stops affect time→beat, not beat→time).
	 */
	beatToTime(beat: number): number {
		// Find the BPM segment containing this beat
		let segmentIndex = 0;
		for (let i = this.bpmChanges.length - 1; i >= 0; i--) {
			const change = this.bpmChanges[i];
			if (change && beat >= change.beat) {
				segmentIndex = i;
				break;
			}
		}

		const segment = this.bpmChanges[segmentIndex];
		if (!segment) return this.offset;

		const beatDelta = beat - segment.beat;
		const secondsPerBeat = 60 / segment.bpm;
		const segmentTime = this.segmentTimes[segmentIndex] ?? this.offset;

		return segmentTime + beatDelta * secondsPerBeat;
	}

	/**
	 * Convert a beat position to actual audio time, accounting for stops.
	 * This is the time when the note should actually be played in the audio.
	 * Use this for hit detection and miss detection.
	 */
	getAudioTimeAtBeat(beat: number): number {
		const musicalTime = this.beatToTime(beat);
		const cumulativeStopDuration = this.getCumulativeStopDurationBeforeBeat(beat);
		return musicalTime + cumulativeStopDuration;
	}

	/**
	 * Calculate cumulative stop duration before a given beat.
	 * @private
	 */
	private getCumulativeStopDurationBeforeBeat(targetBeat: number): number {
		let total = 0;
		for (const stop of this.stops) {
			if (stop.beat < targetBeat) {
				total += stop.duration;
			} else {
				break; // Stops are sorted, so we can break early
			}
		}
		return total;
	}

	/**
	 * Convert audio time to beat position.
	 * Accounts for stops (during a stop, beat stays frozen).
	 */
	timeToBeat(time: number): number {
		// Adjust for stops - we need to account for cumulative stop time
		let adjustedTime = time;
		let cumulativeStopTime = 0;

		for (const stop of this.stops) {
			// Calculate when this stop occurs in wall-clock time,
			// accounting for all previous stops
			const stopTime = this.beatToTime(stop.beat) + cumulativeStopTime;

			if (time >= stopTime && time < stopTime + stop.duration) {
				// Currently in a stop - return the stop beat
				return stop.beat;
			}
			if (time >= stopTime + stop.duration) {
				cumulativeStopTime += stop.duration;
			}
		}

		adjustedTime = time - cumulativeStopTime;

		// Find the BPM segment containing this time
		let segmentIndex = 0;
		for (let i = this.segmentTimes.length - 1; i >= 0; i--) {
			const segmentTime = this.segmentTimes[i];
			if (segmentTime !== undefined && adjustedTime >= segmentTime) {
				segmentIndex = i;
				break;
			}
		}

		const segment = this.bpmChanges[segmentIndex];
		const segmentTime = this.segmentTimes[segmentIndex];
		if (!segment || segmentTime === undefined) return 0;

		const timeDelta = adjustedTime - segmentTime;
		const beatsPerSecond = segment.bpm / 60;

		return segment.beat + timeDelta * beatsPerSecond;
	}

	/**
	 * Get the BPM at a given beat position.
	 */
	getBpmAtBeat(beat: number): number {
		for (let i = this.bpmChanges.length - 1; i >= 0; i--) {
			const change = this.bpmChanges[i];
			if (change && beat >= change.beat) {
				return change.bpm;
			}
		}
		return this.bpmChanges[0]?.bpm ?? 120;
	}

	/**
	 * Check if the given time is during a stop.
	 */
	isDuringStop(time: number): boolean {
		let cumulativeStopTime = 0;
		for (const stop of this.stops) {
			const stopTime = this.beatToTime(stop.beat) + cumulativeStopTime;
			if (time >= stopTime && time < stopTime + stop.duration) {
				return true;
			}
			if (time >= stopTime + stop.duration) {
				cumulativeStopTime += stop.duration;
			}
		}
		return false;
	}

	/**
	 * Get the total stop time that has elapsed by a given time.
	 */
	getElapsedStopTime(time: number): number {
		let elapsed = 0;
		let cumulativeStopTime = 0;
		for (const stop of this.stops) {
			const stopTime = this.beatToTime(stop.beat) + cumulativeStopTime;
			if (time >= stopTime + stop.duration) {
				elapsed += stop.duration;
				cumulativeStopTime += stop.duration;
			} else if (time > stopTime) {
				elapsed += time - stopTime;
			}
		}
		return elapsed;
	}
}
