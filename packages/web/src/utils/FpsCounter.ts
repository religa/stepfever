import type { PerformanceMonitor } from "./PerformanceMonitor";

export class FpsCounter {
	private element: HTMLDivElement;
	private monitor: PerformanceMonitor;
	private lastTimingError: number | null = null;
	private audioLatency = 0;
	private currentBpm = 0;

	constructor(monitor: PerformanceMonitor) {
		this.monitor = monitor;
		this.element = document.createElement("div");
		this.element.style.cssText = `
      position: fixed;
      bottom: 10px;
      right: 10px;
      background: rgba(0, 0, 0, 0.7);
      color: #0f0;
      padding: 5px 10px;
      font-family: monospace;
      font-size: 12px;
      z-index: 10000;
      border-radius: 3px;
    `;
		document.body.appendChild(this.element);
	}

	setTimingError(timingError: number): void {
		this.lastTimingError = timingError;
	}

	setAudioLatency(latencyMs: number): void {
		this.audioLatency = latencyMs;
	}

	setBpm(bpm: number): void {
		this.currentBpm = bpm;
	}

	update(): void {
		const metrics = this.monitor.getMetrics();
		const fps = Math.round(metrics.fps);
		const worst = Math.round(metrics.worstFps);
		const frameTime = metrics.frameTime.toFixed(1);
		const jitter = metrics.frameTimeJitter.toFixed(1);
		const memory = metrics.memoryUsage ? `${metrics.memoryUsage.toFixed(1)} MB` : "N/A";
		const bpm = Math.round(this.currentBpm);

		let html = `
      BPM: ${bpm}<br>
      FPS: ${fps} (low: ${worst})<br>
      Frame: ${frameTime}ms ±${jitter}ms<br>
      Memory: ${memory}
    `;

		// Audio latency
		if (this.audioLatency > 0) {
			html += `<br>Audio: ${this.audioLatency.toFixed(0)}ms`;
		}

		// Timing display
		if (this.lastTimingError !== null) {
			const errorMs = Math.round(this.lastTimingError);
			const errorText = errorMs > 0 ? `+${errorMs}ms` : `${errorMs}ms`;
			const absError = Math.abs(errorMs);

			// Determine color based on timing error magnitude
			let timingColor = "#0f0"; // Green (<10ms)
			if (absError >= 20) {
				timingColor = "#f00"; // Red (>=20ms)
			} else if (absError >= 10) {
				timingColor = "#ff0"; // Yellow (>=10ms)
			}

			html += `<br><span style="color: ${timingColor}">Timing: ${errorText}</span>`;
		}

		this.element.innerHTML = html;

		// Color based on jitter (more relevant for rhythm games than raw FPS)
		const jitterVal = metrics.frameTimeJitter;
		if (jitterVal < 3) {
			this.element.style.color = "#0f0"; // Green: stable
		} else if (jitterVal < 8) {
			this.element.style.color = "#ff0"; // Yellow: some variance
		} else {
			this.element.style.color = "#f00"; // Red: unstable
		}
	}

	destroy(): void {
		this.element.remove();
	}
}
