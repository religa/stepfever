import type { SongIndex, SongIndexEntry } from "@stepfever/core";
import songIndex from "../generated/songs.json";

// Synchronous access for components that need it immediately
export const songs: SongIndexEntry[] = (songIndex as SongIndex).songs;
