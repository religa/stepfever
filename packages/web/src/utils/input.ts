/**
 * Semantic menu actions derived from keyboard/gamepad input.
 * Centralizes WASD/Arrow/Enter/Escape mapping in one place (DRY).
 */
export type MenuAction = "UP" | "DOWN" | "LEFT" | "RIGHT" | "CONFIRM" | "BACK" | "SEARCH" | null;

/**
 * Maps keyboard keys to semantic menu actions.
 * Supports: Arrow keys, WASD, Enter/Space, Escape, /
 */
export function getMenuAction(key: string): MenuAction {
	switch (key) {
		case "ArrowUp":
		case "w":
		case "W":
			return "UP";
		case "ArrowDown":
		case "s":
		case "S":
			return "DOWN";
		case "ArrowLeft":
		case "a":
		case "A":
			return "LEFT";
		case "ArrowRight":
		case "d":
		case "D":
			return "RIGHT";
		case "Enter":
		case " ":
			return "CONFIRM";
		case "Escape":
			return "BACK";
		case "/":
			return "SEARCH";
		default:
			return null;
	}
}
