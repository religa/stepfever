import * as Tone from "tone";

export class AudioPlayer {
	private player: Tone.Player;
	private playbackStartTime = 0;
	private pausedPosition = 0;
	private isPausedState = false;

	constructor(url: string) {
		this.player = new Tone.Player(url);
		this.player.toDestination();
	}

	async load(): Promise<void> {
		await Tone.loaded();
		await Tone.start();
	}

	play(): void {
		this.playbackStartTime = Tone.now();
		this.pausedPosition = 0;
		this.isPausedState = false;
		this.player.start();
	}

	stop(): void {
		this.player.stop();
		this.isPausedState = false;
		this.pausedPosition = 0;
	}

	pause(): void {
		if (this.player.state === "started") {
			this.pausedPosition = Tone.now() - this.playbackStartTime;
			this.player.stop();
			this.isPausedState = true;
		}
	}

	resume(): void {
		if (this.isPausedState) {
			this.player.start(undefined, this.pausedPosition);
			this.playbackStartTime = Tone.now() - this.pausedPosition;
			this.isPausedState = false;
		}
	}

	isPaused(): boolean {
		return this.isPausedState;
	}

	getPosition(): number {
		if (this.isPausedState) {
			return this.pausedPosition;
		}
		if (this.player.state === "started") {
			return Tone.now() - this.playbackStartTime;
		}
		return 0;
	}

	setVolume(volume: number): void {
		this.player.volume.value = Tone.gainToDb(Math.max(0.001, volume));
	}

	isPlaying(): boolean {
		return this.player.state === "started";
	}

	/**
	 * Get total audio output latency in milliseconds.
	 * Returns 0 if not supported by browser.
	 */
	getOutputLatency(): number {
		const ctx = Tone.getContext().rawContext;
		// @ts-ignore - baseLatency/outputLatency have varying browser support
		return ((ctx.baseLatency ?? 0) + (ctx.outputLatency ?? 0)) * 1000;
	}

	dispose(): void {
		this.player.dispose();
	}
}
