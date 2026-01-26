import * as Tone from "tone";
import { useAppStore } from "../stores/appStore";
import type { Screen } from "./ScreenManager";

export class CalibrationScreen implements Screen {
	private container: HTMLElement | null = null;
	private synth: Tone.Synth | null = null;
	private offsets: number[] = [];
	private expectedTime = 0;
	private beatIndex = 0;
	private intervalId?: ReturnType<typeof setInterval>;
	private beatFlashTimeout?: ReturnType<typeof setTimeout>;
	private onNavigate: (screen: string) => void;
	private keyHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(onNavigate: (screen: string) => void) {
		this.onNavigate = onNavigate;
	}

	async mount(container: HTMLElement): Promise<void> {
		this.container = container;
		this.render();
		await this.start();
		this.attachKeyboardListeners();
	}

	unmount(): void {
		this.stop();
		if (this.keyHandler) {
			window.removeEventListener("keydown", this.keyHandler);
		}
		if (this.container) {
			this.container.innerHTML = "";
		}
	}

	private async start(): Promise<void> {
		// Create a simple synth for metronome clicks
		this.synth = new Tone.Synth({
			oscillator: { type: "sine" },
			envelope: {
				attack: 0.001,
				decay: 0.1,
				sustain: 0,
				release: 0.1,
			},
		}).toDestination();

		await Tone.start();

		const bpm = 120;
		const interval = (60 / bpm) * 1000;

		this.beatIndex = 0;
		this.intervalId = setInterval(() => {
			this.expectedTime = Tone.now();
			// Play a short high-pitched click
			this.synth?.triggerAttackRelease("C6", "16n");
			this.beatIndex++;
			this.updateUI();
			// Flash after DOM is updated via requestAnimationFrame
			requestAnimationFrame(() => this.flashBeatIndicator());
		}, interval);
	}

	private stop(): void {
		if (this.intervalId) {
			clearInterval(this.intervalId);
		}
		if (this.beatFlashTimeout) {
			clearTimeout(this.beatFlashTimeout);
		}
		this.synth?.dispose();
	}

	private flashBeatIndicator(): void {
		const indicator = this.container?.querySelector(".beat-indicator") as HTMLElement;
		if (indicator) {
			indicator.style.color = "#00FF00"; // Flash green on beat
			this.beatFlashTimeout = setTimeout(() => {
				indicator.style.color = "#00ffff"; // Return to default
			}, 100);
		}
	}

	private attachKeyboardListeners(): void {
		this.keyHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				e.preventDefault();
				e.stopPropagation();
				this.finish();
			} else if (e.key === " " || e.key === "Enter") {
				e.preventDefault();
				const actualTime = Tone.now();
				const offset = (actualTime - this.expectedTime) * 1000; // Convert to ms
				this.offsets.push(offset);
				this.updateUI();

				if (this.offsets.length >= 10) {
					this.finish();
				}
			}
		};

		window.addEventListener("keydown", this.keyHandler);
	}

	private finish(): void {
		this.stop();

		let finalOffset = 0;

		if (this.offsets.length > 0) {
			// Calculate average offset, excluding outliers
			const sorted = [...this.offsets].sort((a, b) => a - b);
			const trimmed = sorted.length > 2 ? sorted.slice(1, -1) : sorted; // Remove min and max
			finalOffset = trimmed.reduce((a, b) => a + b, 0) / trimmed.length / 1000; // Convert to seconds
		}

		// Save to store
		useAppStore.getState().setGlobalOffset(finalOffset);

		this.onNavigate("settings");
	}

	private updateUI(): void {
		if (!this.container) return;

		const avgOffset = this.offsets.length > 0 ? this.offsets.reduce((a, b) => a + b, 0) / this.offsets.length : 0;

		this.container.innerHTML = `
      <div class="calibration">
        <h1>Audio Calibration</h1>
        <p class="instructions">Press SPACE or ENTER when you hear the beat</p>

        <div class="beat-indicator ${this.beatIndex % 2 === 0 ? "pulse" : ""}">
          Beat ${this.beatIndex}
        </div>

        <div class="offset-info">
          <p>Samples: ${this.offsets.length}/10</p>
          <p>Average offset: ${avgOffset.toFixed(1)}ms</p>
          ${
						this.offsets.length > 0
							? `
            <div class="offset-bars">
              ${this.offsets
								.map((offset) => {
									// Cap at ±200ms, scale to 100px max height
									const maxMs = 200;
									const maxHeight = 100;
									const height = Math.min(Math.abs(offset) * (maxHeight / maxMs), maxHeight);
									const color = offset > 0 ? "#f44336" : "#4caf50";
									return `
                <div class="offset-bar-wrapper">
                  <div class="offset-value">${offset.toFixed(0)}ms</div>
                  <div class="offset-bar" style="height: ${height}px; background: ${color}"></div>
                </div>
              `;
								})
								.join("")}
            </div>
          `
							: ""
					}
        </div>

        <p class="hint">Press ESC to ${this.offsets.length > 0 ? "finish" : "skip"}</p>
      </div>
    `;
	}

	private render(): void {
		this.updateUI();
	}
}
