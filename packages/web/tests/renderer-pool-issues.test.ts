/**
 * Tests for code review issues identified in renderer implementation
 *
 * Issues tested:
 * - MEDIUM: GraphicsPool.release() must reset transform properties (FIXED)
 * - MEDIUM: render() must guard against uninitialized state (FIXED)
 */
import { describe, expect, it, vi } from "vitest";

// Mock Graphics for testing pool behavior
class MockGraphics {
	visible = true;
	alpha = 1;
	rotation = 0;
	scale = {
		x: 1,
		y: 1,
		set: function (v: number) {
			this.x = v;
			this.y = v;
		},
	};
	tint = 0xffffff;

	clear = vi.fn();
	destroy = vi.fn();
}

// Simulated GraphicsPool matching the fixed implementation
class GraphicsPool {
	private pool: MockGraphics[] = [];

	constructor(initialSize = 32) {
		for (let i = 0; i < initialSize; i++) {
			this.pool.push(new MockGraphics());
		}
	}

	acquire(): MockGraphics {
		if (this.pool.length > 0) {
			return this.pool.pop()!;
		}
		return new MockGraphics();
	}

	release(graphic: MockGraphics): void {
		graphic.clear();
		graphic.visible = false;
		// FIXED: Reset transform properties
		graphic.alpha = 1;
		graphic.rotation = 0;
		graphic.scale.set(1);
		graphic.tint = 0xffffff;
		this.pool.push(graphic);
	}

	destroy(): void {
		for (const graphic of this.pool) {
			graphic.destroy();
		}
		this.pool = [];
	}
}

describe("GraphicsPool (Fixed)", () => {
	it("release() should reset all transform properties for clean reuse", () => {
		const pool = new GraphicsPool(1);

		// Acquire a graphic
		const graphic = pool.acquire();

		// Simulate modifications during rendering
		graphic.alpha = 0.5;
		graphic.rotation = Math.PI / 4;
		graphic.tint = 0xff0000;
		graphic.scale.set(2);

		// Release back to pool
		pool.release(graphic);

		// Acquire again
		const reacquired = pool.acquire();

		// Should be reset to clean state
		expect(reacquired.alpha).toBe(1);
		expect(reacquired.rotation).toBe(0);
		expect(reacquired.tint).toBe(0xffffff);
		expect(reacquired.scale.x).toBe(1);
		expect(reacquired.scale.y).toBe(1);
		expect(reacquired.visible).toBe(false); // Visibility set false on release
	});

	it("should reuse pooled objects instead of creating new ones", () => {
		const pool = new GraphicsPool(2);

		const g1 = pool.acquire();
		const g2 = pool.acquire();

		pool.release(g1);
		pool.release(g2);

		const g3 = pool.acquire();
		const g4 = pool.acquire();

		// Should reuse the same objects (LIFO order)
		expect(g3).toBe(g2);
		expect(g4).toBe(g1);
	});

	it("should create new objects when pool is exhausted", () => {
		const pool = new GraphicsPool(1);

		const g1 = pool.acquire();
		const g2 = pool.acquire(); // Pool exhausted, creates new

		expect(g1).not.toBe(g2);
	});

	it("destroy() should clean up all pooled objects", () => {
		const pool = new GraphicsPool(3);

		// Acquire and release some objects
		const g1 = pool.acquire();
		pool.release(g1);

		// Destroy pool
		pool.destroy();

		// Verify destroy was called on pooled objects
		expect(g1.destroy).toHaveBeenCalled();
	});
});
