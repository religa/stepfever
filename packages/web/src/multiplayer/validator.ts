import type { ControllerConfig } from "@stepfever/core";

export interface ControllerConflict {
	player1: number;
	player2: number;
	key: string;
}

export function detectControllerConflicts(controllers: ControllerConfig[]): ControllerConflict[] {
	const conflicts: ControllerConflict[] = [];
	const keyMap = new Map<string, { players: number[]; originalKey: string }>();

	// Build key usage map
	for (let i = 0; i < controllers.length; i++) {
		const config = controllers[i];
		if (!config) continue; // Skip if undefined (shouldn't happen)
		const keys = [config.left, config.down, config.up, config.right];

		for (const rawKey of keys) {
			// Normalize keys for comparison: trim whitespace, convert to lowercase
			const normalizedKey = (rawKey ?? "").toString().trim().toLowerCase();
			if (!normalizedKey) continue; // Skip empty keys

			if (!keyMap.has(normalizedKey)) {
				keyMap.set(normalizedKey, { players: [], originalKey: rawKey });
			}
			const entry = keyMap.get(normalizedKey);
			if (entry) {
				entry.players.push(i);
			}
		}
	}

	// Find conflicts
	for (const [_normalizedKey, { players, originalKey }] of keyMap.entries()) {
		if (players.length > 1) {
			// Multiple players using same key
			for (let i = 0; i < players.length - 1; i++) {
				for (let j = i + 1; j < players.length; j++) {
					const player1 = players[i];
					const player2 = players[j];
					if (player1 !== undefined && player2 !== undefined) {
						conflicts.push({
							player1,
							player2,
							key: originalKey, // Use original key casing
						});
					}
				}
			}
		}
	}

	return conflicts;
}

export function hasConflicts(controllers: ControllerConfig[]): boolean {
	return detectControllerConflicts(controllers).length > 0;
}
