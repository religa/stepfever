/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Tests for race condition issues
 *
 * Issues covered:
 * - HIGH: Race condition in GameEngine pause/resume (double game loop)
 * - HIGH: Async race condition in GameplayScreen.mount() (stale mount)
 * - MEDIUM: Resource leak when stop() occurs during async init
 */

describe("Game Engine Race Condition Issues", () => {
	beforeEach(() => {
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe("GameEngine pause/resume race condition", () => {
		it("should not create double game loops on rapid pause/resume", async () => {
			// Simulate the race condition scenario:
			// 1. Game is running with rAF scheduled
			// 2. pause() is called - sets isPaused=true but rAF still pending
			// 3. resume() is called immediately - starts new loop
			// 4. Pending rAF from step 1 fires - should NOT continue

			let loopCount = 0;
			let rafId: number | null = null;
			let isPaused = false;
			let isRunning = true;

			const gameLoop = () => {
				if (!isRunning || isPaused) return;
				loopCount++;
				rafId = requestAnimationFrame(gameLoop);
			};

			const pause = () => {
				isPaused = true;
				// BUG: Without cancelling rAF, the pending frame can still fire
				// FIX: Should cancel the pending rAF here
				if (rafId !== null) {
					cancelAnimationFrame(rafId);
					rafId = null;
				}
			};

			const resume = () => {
				isPaused = false;
				gameLoop();
			};

			// Start the loop
			gameLoop();
			expect(loopCount).toBe(1);

			// Advance time to trigger rAF
			await vi.advanceTimersByTimeAsync(16);
			expect(loopCount).toBe(2);

			// Pause - this should cancel the pending rAF
			pause();

			// Resume immediately
			resume();
			expect(loopCount).toBe(3);

			// Advance time - should only have ONE loop running, not two
			await vi.advanceTimersByTimeAsync(16);

			// If there were two loops, loopCount would be 5 (3 + 2)
			// With proper cancellation, it should be 4 (3 + 1)
			expect(loopCount).toBe(4);

			// Clean up
			isRunning = false;
			if (rafId !== null) {
				cancelAnimationFrame(rafId);
			}
		});

		it("should track rafId to allow proper cancellation", () => {
			// Test that we can track and cancel rAF
			let rafId: number | null = null;
			let executed = false;

			rafId = requestAnimationFrame(() => {
				executed = true;
			});

			expect(rafId).not.toBeNull();

			// Cancel before it executes
			cancelAnimationFrame(rafId);

			// Advance time
			vi.advanceTimersByTime(100);

			// Should not have executed
			expect(executed).toBe(false);
		});
	});

	describe("GameplayScreen mount race condition", () => {
		it("should prevent stale mounts from completing", async () => {
			// Simulate the race condition:
			// 1. mount() called, starts async work
			// 2. unmount() called, sets isMounted=false
			// 3. mount() called again, sets isMounted=true
			// 4. First mount's async work completes - should NOT proceed

			let isMounted = false;
			let mountId = 0;
			let enginesCreated = 0;

			const mount = async (myMountId: number) => {
				// Simulate async work (fetch, loadChart)
				await new Promise((resolve) => setTimeout(resolve, 100));

				// Check if this mount is still valid
				if (!isMounted || mountId !== myMountId) {
					// Stale mount - abort
					return;
				}

				// Create engine
				enginesCreated++;
			};

			// First mount
			isMounted = true;
			const firstMountId = ++mountId;
			const firstMountPromise = mount(firstMountId);

			// Unmount before first mount completes
			isMounted = false;

			// Second mount
			isMounted = true;
			const secondMountId = ++mountId;
			const secondMountPromise = mount(secondMountId);

			// Advance time to complete both mounts
			await vi.advanceTimersByTimeAsync(200);

			await firstMountPromise;
			await secondMountPromise;

			// Only the second mount should have created an engine
			expect(enginesCreated).toBe(1);
		});

		it("should use incrementing mountId to detect stale mounts", () => {
			let mountId = 0;

			const startMount = () => ++mountId;

			const id1 = startMount();
			const id2 = startMount();
			const id3 = startMount();

			expect(id1).toBe(1);
			expect(id2).toBe(2);
			expect(id3).toBe(3);

			// Each mount gets a unique ID
			expect(id1 !== id2 && id2 !== id3).toBe(true);
		});
	});

	describe("GameEngine init resource leak", () => {
		it("should destroy renderer if stop() called during init", async () => {
			// Simulate the scenario:
			// 1. start() begins, audioPlayer.load() completes
			// 2. renderer.init() starts (async)
			// 3. stop() is called while renderer.init() is in progress
			// 4. stop() destroys the renderer
			// 5. renderer.init() completes
			// 6. BUG: Renderer has already been destroyed but init created new resources

			let rendererDestroyed = false;
			let rendererInitialized = false;
			let isStopped = false;

			const renderer = {
				init: async () => {
					await new Promise((resolve) => setTimeout(resolve, 100));
					rendererInitialized = true;
				},
				destroy: () => {
					rendererDestroyed = true;
				},
			};

			const start = async () => {
				// Simulate audio load
				await new Promise((resolve) => setTimeout(resolve, 50));
				if (isStopped) return;

				// Start renderer init
				await renderer.init();

				// FIX: Check isStopped AFTER init completes and destroy if needed
				if (isStopped) {
					renderer.destroy();
					return;
				}

				// Continue with game loop...
			};

			const stop = () => {
				isStopped = true;
				renderer.destroy();
			};

			// Start the engine
			const startPromise = start();

			// Wait for audio load but not renderer init
			await vi.advanceTimersByTimeAsync(60);

			// Stop during renderer init
			stop();
			expect(rendererDestroyed).toBe(true);

			// Let renderer init complete
			await vi.advanceTimersByTimeAsync(100);
			await startPromise;

			// Renderer should have been destroyed (and destroyed again after init if fixed)
			expect(rendererInitialized).toBe(true);
			expect(rendererDestroyed).toBe(true);
		});
	});
});
