import { describe, expect, it } from "vitest";
import { CONTROLLER_PRESETS, getAllPresets, getControllerPreset } from "../src/input/model";

describe("Controller Presets", () => {
	it("should have 5 controller presets", () => {
		const presets = getAllPresets();
		expect(presets).toHaveLength(5);
	});

	it("should include arrows preset", () => {
		const arrows = CONTROLLER_PRESETS.arrows;
		expect(arrows).toBeDefined();
		expect(arrows?.name).toBe("Arrow Keys");
		expect(arrows?.left).toBe("ArrowLeft");
		expect(arrows?.down).toBe("ArrowDown");
		expect(arrows?.up).toBe("ArrowUp");
		expect(arrows?.right).toBe("ArrowRight");
	});

	it("should include wasd preset", () => {
		const wasd = CONTROLLER_PRESETS.wasd;
		expect(wasd).toBeDefined();
		expect(wasd?.name).toBe("WASD");
		expect(wasd?.left).toBe("a");
		expect(wasd?.down).toBe("s");
		expect(wasd?.up).toBe("w");
		expect(wasd?.right).toBe("d");
	});

	it("should include dfjk preset", () => {
		const dfjk = CONTROLLER_PRESETS.dfjk;
		expect(dfjk).toBeDefined();
		expect(dfjk?.name).toBe("DFJK");
		expect(dfjk?.left).toBe("d");
		expect(dfjk?.down).toBe("f");
		expect(dfjk?.up).toBe("j");
		expect(dfjk?.right).toBe("k");
	});

	it("should include numpad preset", () => {
		const numpad = CONTROLLER_PRESETS.numpad;
		expect(numpad).toBeDefined();
		expect(numpad?.name).toBe("Numpad");
		expect(numpad?.left).toBe("4");
		expect(numpad?.down).toBe("5");
		expect(numpad?.up).toBe("8");
		expect(numpad?.right).toBe("6");
	});

	it("should include zxcv preset", () => {
		const zxcv = CONTROLLER_PRESETS.zxcv;
		expect(zxcv).toBeDefined();
		expect(zxcv?.name).toBe("ZXCV");
		expect(zxcv?.left).toBe("z");
		expect(zxcv?.down).toBe("x");
		expect(zxcv?.up).toBe("c");
		expect(zxcv?.right).toBe("v");
	});

	it("should get controller preset by name", () => {
		const arrows = getControllerPreset("arrows");
		expect(arrows).toBeDefined();
		expect(arrows?.name).toBe("Arrow Keys");
	});

	it("should return null for unknown preset", () => {
		const unknown = getControllerPreset("unknown");
		expect(unknown).toBeNull();
	});

	it("should return all presets in correct order", () => {
		const presets = getAllPresets();
		const names = presets.map((p) => p.name);
		expect(names).toEqual(["Arrow Keys", "WASD", "DFJK", "Numpad", "ZXCV"]);
	});
});
