import * as v from "valibot";

// Timing windows in seconds (based on Etterna/StepMania defaults)
export const TimingWindowSchema = v.object({
	marvelous: v.optional(v.pipe(v.number(), v.minValue(0.001)), 0.0225), // ±22.5ms
	perfect: v.optional(v.pipe(v.number(), v.minValue(0.001)), 0.045), // ±45ms
	great: v.optional(v.pipe(v.number(), v.minValue(0.001)), 0.09), // ±90ms
	good: v.optional(v.pipe(v.number(), v.minValue(0.001)), 0.135), // ±135ms
	boo: v.optional(v.pipe(v.number(), v.minValue(0.001)), 0.18), // ±180ms
});
export type TimingWindow = v.InferOutput<typeof TimingWindowSchema>;

// Full timing configuration
export const TimingConfigSchema = v.object({
	windows: v.optional(TimingWindowSchema, {}),
	globalOffset: v.optional(v.number(), 0), // User's audio latency offset
});
export type TimingConfig = v.InferOutput<typeof TimingConfigSchema>;
