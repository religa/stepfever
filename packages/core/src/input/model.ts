import * as v from "valibot";

export const ControllerConfigSchema = v.object({
	name: v.string(),
	left: v.pipe(v.string(), v.minLength(1)),
	down: v.pipe(v.string(), v.minLength(1)),
	up: v.pipe(v.string(), v.minLength(1)),
	right: v.pipe(v.string(), v.minLength(1)),
});

export type ControllerConfig = v.InferOutput<typeof ControllerConfigSchema>;

// Preset controllers
export const CONTROLLER_PRESETS: Record<string, ControllerConfig> = {
	arrows: {
		name: "Arrow Keys",
		left: "ArrowLeft",
		down: "ArrowDown",
		up: "ArrowUp",
		right: "ArrowRight",
	},
	wasd: {
		name: "WASD",
		left: "a",
		down: "s",
		up: "w",
		right: "d",
	},
	dfjk: {
		name: "DFJK",
		left: "d",
		down: "f",
		up: "j",
		right: "k",
	},
	numpad: {
		name: "Numpad",
		left: "4",
		down: "5",
		up: "8",
		right: "6",
	},
	zxcv: {
		name: "ZXCV",
		left: "z",
		down: "x",
		up: "c",
		right: "v",
	},
};

export function getControllerPreset(name: string): ControllerConfig | null {
	return CONTROLLER_PRESETS[name] || null;
}

export function getAllPresets(): ControllerConfig[] {
	return Object.values(CONTROLLER_PRESETS);
}
