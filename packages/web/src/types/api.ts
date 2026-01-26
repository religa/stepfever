/**
 * Local Types
 *
 * These types represent the local song index structure used in the local-first architecture.
 * They replace the previous API response types.
 */
import type { SongIndexDifficulty, SongIndexEntry } from "@stepfever/core";

// Re-export for backwards compatibility
export type Song = SongIndexEntry;
export type Difficulty = SongIndexDifficulty;
