export interface PerformanceMetrics {
	fps: number;
	frameTime: number;
	frameTimeJitter: number;
	worstFps: number;
	memoryUsage?: number;
}

export class PerformanceMonitor {
	private frames: number[] = [];
	private lastFrameTimestamp = 0;
	private metrics: PerformanceMetrics = {
		fps: 0,
		frameTime: 0,
		frameTimeJitter: 0,
		worstFps: 0,
	};
	private static readonly FPS_SAMPLE_SIZE = 60;
	private static readonly FPS_CAP = 999;

	/**
	 * Call this at the start of each frame
	 */
	startFrame(): void {
		const now = performance.now();

		// Measure frame-to-frame time (actual FPS), not just work time
		if (this.lastFrameTimestamp > 0) {
			const frameDelta = now - this.lastFrameTimestamp;
			this.frames.push(frameDelta);

			// Keep last 60 frames for rolling average
			if (this.frames.length > PerformanceMonitor.FPS_SAMPLE_SIZE) {
				this.frames.splice(0, this.frames.length - PerformanceMonitor.FPS_SAMPLE_SIZE);
			}
		}

		this.lastFrameTimestamp = now;
	}

	/**
	 * Call this at the end of each frame
	 */
	endFrame(): void {
		// Calculate metrics after each frame
		this.updateMetrics();
	}

	private updateMetrics(): void {
		// Guard against empty array
		if (this.frames.length === 0) return;

		const n = this.frames.length;
		const sum = this.frames.reduce((a, b) => a + b, 0);
		const mean = sum / n;

		// Calculate jitter (standard deviation) - simple array iteration is fine for N=60
		const sumSqDiff = this.frames.reduce((a, t) => a + (t - mean) ** 2, 0);
		const jitter = Math.sqrt(sumSqDiff / n);

		// Worst frame = max frame time, converted to FPS
		const worstFrameTime = Math.max(...this.frames);
		const worstFps = worstFrameTime > 0 ? Math.min(1000 / worstFrameTime, PerformanceMonitor.FPS_CAP) : 0;

		// Calculate FPS from mean frame time, cap at FPS_CAP to avoid unrealistic values
		const fps = mean > 0 ? Math.min(1000 / mean, PerformanceMonitor.FPS_CAP) : 0;
		const memoryUsage = this.getMemoryUsage();

		this.metrics = {
			fps,
			frameTime: mean,
			frameTimeJitter: jitter,
			worstFps,
			...(memoryUsage !== undefined ? { memoryUsage } : {}),
		};
	}

	private getMemoryUsage(): number | undefined {
		// @ts-ignore - performance.memory is non-standard
		if (performance.memory) {
			// @ts-ignore
			return performance.memory.usedJSHeapSize / 1024 / 1024; // MB
		}
		return undefined;
	}

	getMetrics(): PerformanceMetrics {
		return { ...this.metrics };
	}

	reset(): void {
		this.frames = [];
		this.lastFrameTimestamp = 0;
		this.metrics = {
			fps: 0,
			frameTime: 0,
			frameTimeJitter: 0,
			worstFps: 0,
		};
	}
}
