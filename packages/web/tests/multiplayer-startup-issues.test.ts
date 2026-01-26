/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Skip tests if running in an environment without DOM (e.g., bun test instead of vitest)
const hasDOM = typeof document !== "undefined";
const describeWithDOM = hasDOM ? describe : describe.skip;

/**
 * Tests for multiplayer engine startup issues found in code review
 *
 * Issue 2 (High): MultiplayerEngine.start() does not clean up partially created resources on failure
 * Location: packages/web/src/multiplayer/MultiplayerEngine.ts:82-177
 */
describeWithDOM("Multiplayer Startup Issues", () => {
	describe("Issue 2: Resource leak on partial initialization failure", () => {
		it("should clean up canvases if renderer init fails", async () => {
			const { MultiplayerEngine } = await import("../src/multiplayer/MultiplayerEngine");
			const { CONTROLLER_PRESETS } = await import("@stepfever/core");

			const container = document.createElement("div");
			// biome-ignore lint/suspicious/noExplicitAny: mock chart for testing
			const mockChart: any = {
				metadata: { title: "Test", artist: "Test" },
				bpmChanges: [{ beat: 0, bpm: 120 }],
				stops: [],
				difficulties: [],
			};

			const config = {
				playerCount: 2,
				controllers: [CONTROLLER_PRESETS.arrows!, CONTROLLER_PRESETS.dfjk!],
				gamepadAssignments: [null, null],
				chart: mockChart,
				difficulty: { name: "Test", level: 1, notes: [] },
				audioFile: "test.mp3",
				globalOffset: 0,
			};

			const engine = new MultiplayerEngine(container, config, 800, 600);

			// Mock renderer init to fail
			vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

			// Should clean up and re-throw
			await expect(engine.start()).rejects.toThrow();

			// Verify cleanup: container should be empty or engine should be stopped
			// (the stop() method should clean up canvases)
			expect(container.children.length).toBe(0);
		});

		it("should clean up audio player if initialization fails mid-way", async () => {
			const { MultiplayerEngine } = await import("../src/multiplayer/MultiplayerEngine");
			const { CONTROLLER_PRESETS } = await import("@stepfever/core");

			const container = document.createElement("div");
			// biome-ignore lint/suspicious/noExplicitAny: mock chart for testing
			const mockChart: any = {
				metadata: { title: "Test", artist: "Test" },
				bpmChanges: [{ beat: 0, bpm: 120 }],
				stops: [],
				difficulties: [],
			};

			const config = {
				playerCount: 2,
				controllers: [CONTROLLER_PRESETS.arrows!, CONTROLLER_PRESETS.dfjk!],
				gamepadAssignments: [null, null],
				chart: mockChart,
				difficulty: { name: "Test", level: 1, notes: [] },
				audioFile: "invalid-url://test.mp3", // Invalid URL
				globalOffset: 0,
			};

			const engine = new MultiplayerEngine(container, config, 800, 600);

			// Should handle audio load failure
			await expect(engine.start()).rejects.toThrow();

			// Audio player should be cleaned up (set to null in stop())
			// biome-ignore lint/suspicious/noExplicitAny: accessing private property for test
			expect((engine as any).audioPlayer).toBeNull();
		});

		it("should call stop() to clean up when initialization fails", async () => {
			const { MultiplayerEngine } = await import("../src/multiplayer/MultiplayerEngine");
			const { CONTROLLER_PRESETS } = await import("@stepfever/core");

			const container = document.createElement("div");
			// biome-ignore lint/suspicious/noExplicitAny: mock chart for testing
			const mockChart: any = {
				metadata: { title: "Test", artist: "Test" },
				bpmChanges: [{ beat: 0, bpm: 120 }],
				stops: [],
				difficulties: [],
			};

			const config = {
				playerCount: 2,
				controllers: [CONTROLLER_PRESETS.arrows!, CONTROLLER_PRESETS.dfjk!],
				gamepadAssignments: [null, null],
				chart: mockChart,
				difficulty: { name: "Test", level: 1, notes: [] },
				audioFile: "test.mp3",
				globalOffset: 0,
			};

			const engine = new MultiplayerEngine(container, config, 800, 600);

			// Spy on stop() method to verify it's called on failure
			const stopSpy = vi.spyOn(engine, "stop");

			// Force a failure during initialization
			vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);

			await expect(engine.start()).rejects.toThrow();

			// stop() should have been called to clean up partially created resources
			expect(stopSpy).toHaveBeenCalled();
		});
	});
});
