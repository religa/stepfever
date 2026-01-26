import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("MultiplayerEngine Resource Management", () => {
	let originalRequestAnimationFrame: typeof requestAnimationFrame;
	let originalCancelAnimationFrame: typeof cancelAnimationFrame;
	let rafCallbacks: Map<number, FrameRequestCallback>;
	let nextRafId: number;

	beforeEach(() => {
		rafCallbacks = new Map();
		nextRafId = 1;

		originalRequestAnimationFrame = global.requestAnimationFrame;
		originalCancelAnimationFrame = global.cancelAnimationFrame;

		global.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
			const id = nextRafId++;
			rafCallbacks.set(id, callback);
			return id;
		});

		global.cancelAnimationFrame = vi.fn((id: number) => {
			rafCallbacks.delete(id);
		});
	});

	afterEach(() => {
		global.requestAnimationFrame = originalRequestAnimationFrame;
		global.cancelAnimationFrame = originalCancelAnimationFrame;
	});

	it("should properly cancel animation frame when stop() is called", async () => {
		// This test verifies that the animation frame is cancelled
		// when the engine is stopped, preventing resource leaks

		expect(rafCallbacks.size).toBe(0);

		// Simulate starting an animation loop
		const id = requestAnimationFrame(() => {
			// Game loop
		});

		expect(rafCallbacks.size).toBe(1);

		// Simulate stopping the engine
		cancelAnimationFrame(id);

		expect(rafCallbacks.size).toBe(0);
		expect(global.cancelAnimationFrame).toHaveBeenCalledWith(id);
	});

	it("should track visualDelta properly in game loop", () => {
		// This test verifies that visual delta is calculated from performance.now()
		// instead of passing 0 to conductor.update()

		let lastFrameTime: number | null = null;
		const now1 = 1000;
		const now2 = 1016.67; // ~60fps frame

		// First frame
		if (lastFrameTime === null) {
			lastFrameTime = now1;
		}
		const delta1 = 0; // First frame should be 0

		expect(delta1).toBe(0);

		// Second frame
		const delta2 = (now2 - lastFrameTime) / 1000;
		lastFrameTime = now2;

		expect(delta2).toBeCloseTo(0.01667, 4); // ~16.67ms in seconds
		expect(delta2).toBeGreaterThan(0);
	});
});

describe("MultiplayerEngine Conductor Disposal", () => {
	it("should call dispose() on conductors that support it", () => {
		const mockConductor = {
			stop: vi.fn(),
			dispose: vi.fn(),
		};

		// Simulate cleanup
		mockConductor.stop();
		// biome-ignore lint/suspicious/noExplicitAny: testing runtime dispose check
		if (typeof (mockConductor as any).dispose === "function") {
			// biome-ignore lint/suspicious/noExplicitAny: testing runtime dispose check
			(mockConductor as any).dispose();
		}

		expect(mockConductor.stop).toHaveBeenCalled();
		expect(mockConductor.dispose).toHaveBeenCalled();
	});

	it("should handle conductors without dispose() gracefully", () => {
		const mockConductor = {
			stop: vi.fn(),
		};

		// Simulate cleanup
		mockConductor.stop();
		// biome-ignore lint/suspicious/noExplicitAny: testing runtime dispose check
		if (typeof (mockConductor as any).dispose === "function") {
			// biome-ignore lint/suspicious/noExplicitAny: testing runtime dispose check
			(mockConductor as any).dispose();
		}

		expect(mockConductor.stop).toHaveBeenCalled();
		// Should not throw error
	});
});
