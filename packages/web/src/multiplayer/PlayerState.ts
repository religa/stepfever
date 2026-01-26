import type { FinalScore } from "@stepfever/core";
import type { ControllerConfig } from "@stepfever/core";
import type { BrowserConductor } from "../engine/Conductor";
import type { InputManager } from "../engine/InputManager";
import type { Renderer } from "../engine/Renderer";

/**
 * Full player state during gameplay (contains non-serializable objects)
 */
export interface PlayerState {
	playerId: number;
	controller: ControllerConfig;
	conductor: BrowserConductor;
	renderer: Renderer;
	inputManager: InputManager;
	score: FinalScore | null;
	isFinished: boolean;
	rank: number; // 1-4 based on accuracy
}

/**
 * Serializable player result for passing through router/history.state
 * Contains only the data needed for the results screen
 */
export interface PlayerResult {
	playerId: number;
	controllerName: string;
	score: FinalScore | null;
	rank: number;
}

/**
 * Convert PlayerState to serializable PlayerResult
 */
export function toPlayerResult(state: PlayerState): PlayerResult {
	return {
		playerId: state.playerId,
		controllerName: state.controller.name,
		score: state.score,
		rank: state.rank,
	};
}
