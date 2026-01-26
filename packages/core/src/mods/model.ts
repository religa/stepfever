import * as v from "valibot";

// X-Mod: Multiplier-based (e.g., 2.0x = double speed)
export const XModSchema = v.object({
	type: v.literal("xmod"),
	multiplier: v.pipe(v.number(), v.minValue(0.1), v.maxValue(20.0)),
});

// C-Mod: Constant pixels per second
export const CModSchema = v.object({
	type: v.literal("cmod"),
	pixelsPerSecond: v.pipe(v.number(), v.minValue(100), v.maxValue(1000)),
});

// Union variant
export const SpeedModifierSchema = v.variant("type", [XModSchema, CModSchema]);

export type XMod = v.InferOutput<typeof XModSchema>;
export type CMod = v.InferOutput<typeof CModSchema>;
export type SpeedModifier = v.InferOutput<typeof SpeedModifierSchema>;
