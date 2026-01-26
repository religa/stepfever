import { AudioTimeProvider, Conductor as CoreConductor } from "@stepfever/core";
import type { Chart, ChartDifficulty, SpeedModifier } from "@stepfever/core";
import * as Tone from "tone";

/**
 * Browser-specific Conductor that uses Tone.js for audio timing
 */
export class BrowserConductor extends CoreConductor {
	private readonly toneStartRef: { value: number };

	constructor(
		chart: Chart,
		difficulty: ChartDifficulty,
		globalOffset = 0,
		speedModifier: SpeedModifier | null = null,
		songOffset = 0,
	) {
		// Use a reference object to avoid accessing 'this' before super()
		const toneStartRef = { value: 0 };
		const timeProvider = new AudioTimeProvider(() => Tone.now() - toneStartRef.value);

		// Use per-chart timing from difficulty if available, else use chart-level
		const bpmChanges = difficulty.bpmChanges ?? chart.bpmChanges;
		const stops = difficulty.stops ?? chart.stops ?? [];

		// Additive offsets: chart + difficulty + global + song-specific
		const totalOffset = (chart.offset ?? 0) + (difficulty.offset ?? 0) + globalOffset + songOffset;

		super({
			bpmChanges,
			stops,
			offset: totalOffset,
			notes: difficulty.notes,
			timeProvider,
			globalOffset: 0, // Already included in totalOffset
			speedModifier,
		});

		this.toneStartRef = toneStartRef;
	}

	override start(): void {
		// Verify audio context is running
		if (Tone.context.state !== "running") {
			throw new Error("AudioContext must be running before starting Conductor");
		}
		this.toneStartRef.value = Tone.now();
		super.start();
	}
}
