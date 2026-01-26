import { describe, expect, it } from "vitest";
import { LayoutManager } from "../src/multiplayer/LayoutManager";

describe("LayoutManager", () => {
	it("should create layout manager with canvas dimensions", () => {
		const manager = new LayoutManager(800, 600);
		expect(manager).toBeDefined();
	});

	it("should calculate 2-player vertical split layout", () => {
		const manager = new LayoutManager(800, 600);
		const viewports = manager.calculateViewports(2);

		expect(viewports).toHaveLength(2);

		// Player 1 (left half)
		expect(viewports[0]).toEqual({
			x: 0,
			y: 0,
			width: 400,
			height: 600,
			playerId: 0,
		});

		// Player 2 (right half)
		expect(viewports[1]).toEqual({
			x: 400,
			y: 0,
			width: 400,
			height: 600,
			playerId: 1,
		});
	});

	it("should calculate 3-player vertical split layout", () => {
		const manager = new LayoutManager(900, 600);
		const viewports = manager.calculateViewports(3);

		expect(viewports).toHaveLength(3);

		// Player 1 (left third)
		expect(viewports[0]).toEqual({
			x: 0,
			y: 0,
			width: 300,
			height: 600,
			playerId: 0,
		});

		// Player 2 (middle third)
		expect(viewports[1]).toEqual({
			x: 300,
			y: 0,
			width: 300,
			height: 600,
			playerId: 1,
		});

		// Player 3 (right third)
		expect(viewports[2]).toEqual({
			x: 600,
			y: 0,
			width: 300,
			height: 600,
			playerId: 2,
		});
	});

	it("should calculate 4-player vertical split layout", () => {
		const manager = new LayoutManager(800, 600);
		const viewports = manager.calculateViewports(4);

		expect(viewports).toHaveLength(4);

		// Player 1 (left quarter)
		expect(viewports[0]).toEqual({
			x: 0,
			y: 0,
			width: 200,
			height: 600,
			playerId: 0,
		});

		// Player 2 (second quarter)
		expect(viewports[1]).toEqual({
			x: 200,
			y: 0,
			width: 200,
			height: 600,
			playerId: 1,
		});

		// Player 3 (third quarter)
		expect(viewports[2]).toEqual({
			x: 400,
			y: 0,
			width: 200,
			height: 600,
			playerId: 2,
		});

		// Player 4 (right quarter)
		expect(viewports[3]).toEqual({
			x: 600,
			y: 0,
			width: 200,
			height: 600,
			playerId: 3,
		});
	});

	it("should calculate 1-player fullscreen layout", () => {
		const manager = new LayoutManager(800, 600);
		const viewports = manager.calculateViewports(1);

		expect(viewports).toHaveLength(1);

		// Single player (fullscreen)
		expect(viewports[0]).toEqual({
			x: 0,
			y: 0,
			width: 800,
			height: 600,
			playerId: 0,
		});
	});

	it("should throw error for invalid player count", () => {
		const manager = new LayoutManager(800, 600);

		expect(() => manager.calculateViewports(5)).toThrow("Player count must be 1-4");
		expect(() => manager.calculateViewports(0)).toThrow("Player count must be 1-4");
	});

	it("should update canvas size", () => {
		const manager = new LayoutManager(800, 600);
		manager.setCanvasSize(1024, 768);

		const viewports = manager.calculateViewports(2);
		expect(viewports[0]?.width).toBe(512);
		expect(viewports[0]?.height).toBe(768);
	});

	it("should preserve full height for all vertical splits", () => {
		const manager = new LayoutManager(800, 600);

		const viewports2 = manager.calculateViewports(2);
		expect(viewports2.every((v) => v.height === 600)).toBe(true);

		const viewports3 = manager.calculateViewports(3);
		expect(viewports3.every((v) => v.height === 600)).toBe(true);

		const viewports4 = manager.calculateViewports(4);
		expect(viewports4.every((v) => v.height === 600)).toBe(true);
	});

	it("should assign correct player IDs", () => {
		const manager = new LayoutManager(800, 600);
		const viewports = manager.calculateViewports(4);

		expect(viewports[0]?.playerId).toBe(0);
		expect(viewports[1]?.playerId).toBe(1);
		expect(viewports[2]?.playerId).toBe(2);
		expect(viewports[3]?.playerId).toBe(3);
	});
});
