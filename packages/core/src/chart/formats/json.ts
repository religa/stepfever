import * as v from "valibot";
import { type Chart, ChartSchema } from "../model";

export class JSONParseError extends Error {
	constructor(message: string) {
		super(message);
		this.name = "JSONParseError";
	}
}

export function parseJSON(content: string): Chart {
	try {
		const data: unknown = JSON.parse(content);
		return v.parse(ChartSchema, data);
	} catch (error) {
		if (error instanceof SyntaxError) {
			throw new JSONParseError(`Invalid JSON: ${error.message}`);
		}
		if (error instanceof v.ValiError) {
			throw new JSONParseError(`Invalid chart data: ${error.message}`);
		}
		throw new JSONParseError(`Failed to parse chart: ${error}`);
	}
}

export function exportJSON(chart: Chart, pretty = true): string {
	return JSON.stringify(chart, null, pretty ? 2 : undefined);
}
