import { JSONParseError, parseJSON } from "./formats/json";
import { SMParseError, parseSM } from "./formats/sm";
import type { Chart } from "./model";

type ChartFormat = "sm" | "ssc" | "json";

export class ChartLoadError extends Error {
	constructor(
		message: string,
		public readonly cause?: Error,
	) {
		super(message);
		this.name = "ChartLoadError";
	}
}

export function detectFormat(filename: string): ChartFormat {
	const ext = filename.toLowerCase().split(".").pop();
	switch (ext) {
		case "sm":
			return "sm";
		case "ssc":
			return "ssc";
		case "json":
			return "json";
		default:
			throw new ChartLoadError(`Unknown chart format: .${ext}`);
	}
}

function parseChart(content: string, format: ChartFormat): Chart {
	switch (format) {
		case "sm":
		case "ssc":
			return parseSM(content);
		case "json":
			return parseJSON(content);
	}
}

export function loadChart(content: string, filename: string): Chart {
	const format = detectFormat(filename);
	try {
		return parseChart(content, format);
	} catch (error) {
		if (error instanceof SMParseError || error instanceof JSONParseError) {
			throw new ChartLoadError(`Failed to load ${filename}: ${error.message}`, error);
		}
		throw error;
	}
}

export { SMParseError, JSONParseError };
