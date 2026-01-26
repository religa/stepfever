import { menuAudio } from "../audio/MenuAudio";
import { isMultiplayerRoute } from "../router";
import { songs } from "../songs/loader";
import { useAppStore } from "../stores/appStore";
import { scoresStore } from "../stores/scoresStore";
import { type SongSortOption, useSession } from "../stores/sessionStore";
import type { Difficulty, Song } from "../types/api";
import { getDifficultyClass } from "../utils/difficulty";
import { escapeHtml } from "../utils/html";
import { getMenuAction } from "../utils/input";
import type { Screen } from "./ScreenManager";

const SORT_OPTIONS: SongSortOption[] = ["title", "bpm", "difficulty", "recent", "playCount"];
const SORT_LABELS: Record<SongSortOption, string> = {
	title: "A-Z",
	bpm: "BPM",
	difficulty: "Difficulty",
	recent: "Recent",
	playCount: "Most Played",
};

export class SongSelectScreen implements Screen {
	private container: HTMLElement | null = null;
	private allSongs: (Song & { difficulties: Difficulty[] })[] = [];
	private selectedIndex = 0;
	private selectedDifficultyIndex = 0;
	private onNavigate: (screen: string) => void;
	private keyHandler: ((e: KeyboardEvent) => void) | null = null;
	private isMultiplayer = false;
	private isMounted = false;
	private clickHandler: ((e: MouseEvent) => void) | null = null;
	private dblClickHandler: ((e: MouseEvent) => void) | null = null;
	private searchInput: HTMLInputElement | null = null;
	private debounceTimer: ReturnType<typeof setTimeout> | null = null;
	// Cache for visible songs to avoid expensive recomputation on every navigation
	private visibleSongsCache: (Song & { difficulties: Difficulty[] })[] | null = null;
	private lastFilterKey = "";

	constructor(onNavigate: (screen: string) => void) {
		this.onNavigate = onNavigate;
	}

	async mount(container: HTMLElement): Promise<void> {
		this.isMounted = true;
		this.container = container;
		// Use URL-based mode detection for consistency
		this.isMultiplayer = isMultiplayerRoute();
		this.loadSongs();
		if (!this.isMounted) return;
		this.createSearchInput();
		this.render();
		this.attachKeyboardListeners();
		this.attachMouseListeners();
	}

	unmount(): void {
		this.isMounted = false;
		if (this.keyHandler) {
			window.removeEventListener("keydown", this.keyHandler);
		}
		if (this.container && this.clickHandler) {
			this.container.removeEventListener("click", this.clickHandler);
		}
		if (this.container && this.dblClickHandler) {
			this.container.removeEventListener("dblclick", this.dblClickHandler);
		}
		if (this.searchInput) {
			this.searchInput.remove();
			this.searchInput = null;
		}
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
			this.debounceTimer = null;
		}
		// Reset filters and cache on unmount to start fresh next time
		useSession.getState().setFilters({ query: "", sort: "title" });
		this.visibleSongsCache = null;
		this.lastFilterKey = "";
		if (this.container) {
			this.container.innerHTML = "";
		}
	}

	private loadSongs(): void {
		// Load songs from local index (synchronous, bundled at build time)
		this.allSongs = songs;
	}

	private createSearchInput(): void {
		const input = document.createElement("input");
		input.type = "text";
		input.placeholder = "Search songs... (press /)";
		input.className = "song-search-input";

		input.addEventListener("input", () => {
			// Debounce search to avoid excessive re-renders
			if (this.debounceTimer) {
				clearTimeout(this.debounceTimer);
			}
			this.debounceTimer = setTimeout(() => {
				useSession.getState().setFilters({ query: input.value });
				this.selectedIndex = 0;
				this.selectedDifficultyIndex = 0;
				this.render();
			}, 150);
		});

		document.body.appendChild(input);
		this.searchInput = input;
	}

	private getVisibleSongs(): (Song & { difficulties: Difficulty[] })[] {
		const { query, sort } = useSession.getState().songFilters;
		const filterKey = `${query}|${sort}`;

		// Return cached result if filters haven't changed
		if (this.visibleSongsCache && this.lastFilterKey === filterKey) {
			return this.visibleSongsCache;
		}

		const scores = scoresStore.getState();
		let filtered = this.allSongs;

		// Search filter (title, artist, translits)
		if (query) {
			const q = query.toLowerCase();
			filtered = filtered.filter(
				(s) =>
					s.title.toLowerCase().includes(q) ||
					s.artist.toLowerCase().includes(q) ||
					s.titleTranslit?.toLowerCase().includes(q) ||
					s.artistTranslit?.toLowerCase().includes(q),
			);
		}

		// Sort
		const result = [...filtered].sort((a, b) => {
			switch (sort) {
				case "title":
					return a.title.localeCompare(b.title);
				case "bpm": {
					const aBpm = typeof a.bpm === "number" ? a.bpm : a.bpm.max;
					const bBpm = typeof b.bpm === "number" ? b.bpm : b.bpm.max;
					return aBpm - bBpm;
				}
				case "difficulty":
					return (a.difficulties[0]?.level ?? 0) - (b.difficulties[0]?.level ?? 0);
				case "recent": {
					const aScores = scores.getAllScoresForSong(a.id);
					const bScores = scores.getAllScoresForSong(b.id);
					const aTime = aScores[0]?.timestamp ?? 0;
					const bTime = bScores[0]?.timestamp ?? 0;
					return bTime - aTime;
				}
				case "playCount":
					return scores.getPlayCount(b.id) - scores.getPlayCount(a.id);
			}
		});

		// Cache the result
		this.visibleSongsCache = result;
		this.lastFilterKey = filterKey;
		return result;
	}

	private cycleSortOption(): void {
		const current = useSession.getState().songFilters.sort;
		const idx = SORT_OPTIONS.indexOf(current);
		const next = SORT_OPTIONS[(idx + 1) % SORT_OPTIONS.length];
		if (next) {
			useSession.getState().setFilters({ sort: next });
			this.visibleSongsCache = null; // Invalidate cache
			this.selectedIndex = 0;
			this.selectedDifficultyIndex = 0;
			this.render();
		}
	}

	private render(): void {
		const visibleSongs = this.getVisibleSongs();
		const { sort } = useSession.getState().songFilters;
		const scores = scoresStore.getState();

		// Preserve scroll position before rebuilding DOM
		const songsContainer = this.container?.querySelector(".songs") as HTMLElement | null;
		const savedScrollTop = songsContainer?.scrollTop ?? 0;

		if (!this.container || visibleSongs.length === 0) {
			if (this.container) {
				const hasAllSongs = this.allSongs.length > 0;
				this.container.innerHTML = `
          <div class="song-select">
            <h2>${hasAllSongs ? "No matching songs" : "No songs available"}</h2>
            <p>${hasAllSongs ? "Try a different search" : "Press ESC to return"}</p>
          </div>
        `;
			}
			return;
		}

		// Clamp selected index to visible songs
		if (this.selectedIndex >= visibleSongs.length) {
			this.selectedIndex = Math.max(0, visibleSongs.length - 1);
		}

		const song = visibleSongs[this.selectedIndex];
		if (!song) {
			return;
		}

		// Clamp difficulty index
		if (this.selectedDifficultyIndex >= song.difficulties.length) {
			this.selectedDifficultyIndex = Math.max(0, song.difficulties.length - 1);
		}

		const difficulty = song.difficulties[this.selectedDifficultyIndex];

		const songsHTML = visibleSongs
			.map((s, i) => {
				const playCount = scores.getPlayCount(s.id);
				const playCountBadge = playCount > 0 ? `<span class="play-count-badge">×${playCount}</span>` : "";

				const bpmDisplay = typeof s.bpm === "number" ? s.bpm : `${s.bpm.min}-${s.bpm.max}`;

				return `
      <div class="song-item ${i === this.selectedIndex ? "selected" : ""}" data-song-index="${i}">
        ${
					s.banner
						? `<img src="${escapeHtml(s.banner)}" class="banner" onerror="this.style.display='none'" />`
						: `<div class="banner-placeholder">♪</div>`
				}
        <div class="song-info">
          <h3>${escapeHtml(s.title)}</h3>
          <p class="artist">${escapeHtml(s.artist)}</p>
          <p class="bpm">BPM: ${bpmDisplay}</p>
        </div>
        ${playCountBadge}
      </div>
    `;
			})
			.join("");

		this.container.innerHTML = `
      <div class="song-select">
        ${this.isMultiplayer ? '<div class="multiplayer-indicator">MULTIPLAYER MODE</div>' : ""}
        <div class="song-list">
          <h2>${this.isMultiplayer ? "Select Song (Multiplayer)" : "Select Song"}</h2>
          <div class="sort-toggle" data-action="toggle-sort">Sort: ${SORT_LABELS[sort]} ▼</div>
          <div class="songs">
            ${songsHTML}
          </div>
        </div>

        <div class="difficulty-select">
          <h2>Select Difficulty</h2>
          <div class="difficulties">
            ${song.difficulties
							.map(
								(d, i) => `
              <div class="difficulty-item ${i === this.selectedDifficultyIndex ? "selected" : ""}" data-difficulty-index="${i}">
                <span class="diff-name ${getDifficultyClass(d.name)}">${escapeHtml(d.name)}</span>
                <span class="diff-level">Lv.${d.level}</span>
                <span class="diff-notes">${d.noteCount} notes</span>
              </div>
            `,
							)
							.join("")}
          </div>

          ${
						difficulty
							? `
            <div class="difficulty-details">
              <h3>${escapeHtml(difficulty.name)} - Level ${difficulty.level}</h3>
              <p>${difficulty.noteCount} notes</p>
            </div>
          `
							: ""
					}
        </div>

        <div class="controls">
          <p>↑/↓: Select Song • ←/→: Select Difficulty • /: Search</p>
          <p>ENTER: Start • ESC: ${useSession.getState().songFilters.query ? "Clear search" : "Back"}</p>
        </div>
      </div>
    `;

		// Restore scroll position then scroll selected into view if needed
		const newSongsContainer = this.container?.querySelector(".songs") as HTMLElement | null;
		if (newSongsContainer && savedScrollTop > 0) {
			// Restore previous scroll position immediately (no animation)
			newSongsContainer.style.scrollBehavior = "auto";
			newSongsContainer.scrollTop = savedScrollTop;
			newSongsContainer.style.scrollBehavior = "";
		}

		// Scroll selected song into view only if needed (with smooth scroll)
		setTimeout(() => {
			if (!this.isMounted) return;
			const container = this.container?.querySelector(".songs") as HTMLElement | undefined;
			const songItems = this.container?.querySelectorAll(".song-item");
			const selectedSongItem = songItems?.[this.selectedIndex] as HTMLElement | undefined;

			if (container && selectedSongItem) {
				const containerRect = container.getBoundingClientRect();
				const itemRect = selectedSongItem.getBoundingClientRect();

				// Only scroll if the item is not fully visible
				const isAbove = itemRect.top < containerRect.top;
				const isBelow = itemRect.bottom > containerRect.bottom;

				if (isAbove || isBelow) {
					selectedSongItem.scrollIntoView({
						behavior: "smooth",
						block: "nearest",
					});
				}
			}
		}, 0);
	}

	private attachKeyboardListeners(): void {
		this.keyHandler = (e: KeyboardEvent) => {
			const action = getMenuAction(e.key);
			const isSearchFocused = document.activeElement === this.searchInput;

			// Allow SEARCH action even when not focused
			if (action === "SEARCH" && !isSearchFocused) {
				e.preventDefault();
				this.searchInput?.focus();
				return;
			}

			// Handle BACK specially - clear search first, then navigate
			if (action === "BACK") {
				e.preventDefault();
				menuAudio.playCancel();
				// Check both input value (before debounce) and store state
				const hasInputContent = this.searchInput && this.searchInput.value.trim().length > 0;
				const hasStoreQuery = useSession.getState().songFilters.query.length > 0;
				// If search has content (either in input or store), clear it first
				if (hasInputContent || hasStoreQuery) {
					if (this.searchInput) {
						this.searchInput.value = "";
					}
					this.searchInput?.blur();
					// Clear debounce timer to prevent stale update
					if (this.debounceTimer) {
						clearTimeout(this.debounceTimer);
						this.debounceTimer = null;
					}
					useSession.getState().setFilters({ query: "" });
					this.visibleSongsCache = null; // Invalidate cache
					this.selectedIndex = 0;
					this.selectedDifficultyIndex = 0;
					this.render();
				} else {
					// CRITICAL: Preserve controller config if in multiplayer mode
					if (this.isMultiplayer) {
						this.onNavigate("player-setup");
					} else {
						this.onNavigate("main-menu");
					}
				}
				return;
			}

			// Block navigation when search is focused, but allow CONFIRM to start game
			if (isSearchFocused) {
				if (action === "CONFIRM") {
					e.preventDefault();
					this.searchInput?.blur();
					menuAudio.playSelect();
					this.startGame();
				}
				return;
			}

			if (!action) return;

			e.preventDefault();
			switch (action) {
				case "UP":
					this.selectedIndex = Math.max(0, this.selectedIndex - 1);
					this.selectedDifficultyIndex = 0;
					menuAudio.playNavigate();
					this.render();
					break;
				case "DOWN": {
					const visibleSongs = this.getVisibleSongs();
					this.selectedIndex = Math.min(visibleSongs.length - 1, this.selectedIndex + 1);
					this.selectedDifficultyIndex = 0;
					menuAudio.playNavigate();
					this.render();
					break;
				}
				case "LEFT": {
					const visibleSongs = this.getVisibleSongs();
					if (visibleSongs[this.selectedIndex]) {
						this.selectedDifficultyIndex = Math.max(0, this.selectedDifficultyIndex - 1);
						menuAudio.playNavigate();
						this.render();
					}
					break;
				}
				case "RIGHT": {
					const visibleSongs = this.getVisibleSongs();
					const currentSong = visibleSongs[this.selectedIndex];
					if (currentSong) {
						const maxDiff = currentSong.difficulties.length - 1;
						this.selectedDifficultyIndex = Math.min(maxDiff, this.selectedDifficultyIndex + 1);
						menuAudio.playNavigate();
						this.render();
					}
					break;
				}
				case "CONFIRM":
					menuAudio.playSelect();
					this.startGame();
					break;
			}
		};

		window.addEventListener("keydown", this.keyHandler);
	}

	private attachMouseListeners(): void {
		if (!this.container) return;

		// Handle song item clicks
		this.clickHandler = (e: MouseEvent) => {
			const target = e.target as HTMLElement;

			// Handle sort toggle
			const sortToggle = target.closest("[data-action='toggle-sort']");
			if (sortToggle) {
				menuAudio.playNavigate();
				this.cycleSortOption();
				return;
			}

			// Find the song item (might click on child elements)
			const songItem = target.closest(".song-item") as HTMLElement;
			if (songItem) {
				const index = songItem.dataset.songIndex;
				if (index !== undefined) {
					const songIndex = Number.parseInt(index, 10);
					const visibleSongs = this.getVisibleSongs();
					if (!Number.isNaN(songIndex) && songIndex >= 0 && songIndex < visibleSongs.length) {
						menuAudio.playNavigate();
						this.selectedIndex = songIndex;
						this.selectedDifficultyIndex = 0;
						this.render();
					}
				}
				return;
			}

			// Find the difficulty item
			const difficultyItem = target.closest(".difficulty-item") as HTMLElement;
			if (difficultyItem) {
				const index = difficultyItem.dataset.difficultyIndex;
				if (index !== undefined) {
					const diffIndex = Number.parseInt(index, 10);
					const visibleSongs = this.getVisibleSongs();
					const currentSong = visibleSongs[this.selectedIndex];
					if (
						currentSong &&
						!Number.isNaN(diffIndex) &&
						diffIndex >= 0 &&
						diffIndex < currentSong.difficulties.length
					) {
						menuAudio.playNavigate();
						this.selectedDifficultyIndex = diffIndex;
						this.render();
					}
				}
				return;
			}
		};

		this.container.addEventListener("click", this.clickHandler);

		// Handle double-click to start game
		this.dblClickHandler = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			const difficultyItem = target.closest(".difficulty-item");
			if (difficultyItem) {
				menuAudio.playSelect();
				this.startGame();
			}
		};

		this.container.addEventListener("dblclick", this.dblClickHandler);
	}

	private startGame(): void {
		const visibleSongs = this.getVisibleSongs();
		const song = visibleSongs[this.selectedIndex];
		const difficulty = song?.difficulties[this.selectedDifficultyIndex];

		if (song && difficulty) {
			useAppStore.getState().setSelectedSong(song);
			useAppStore.getState().setSelectedDifficulty(difficulty);
			if (this.isMultiplayer) {
				// Re-verify multiplayerConfig still exists before navigating
				if (!useAppStore.getState().multiplayerConfig) {
					console.error("Multiplayer config lost");
					// Redirect to player-setup (not main-menu) to reconfigure
					this.onNavigate("player-setup");
					return;
				}
				this.onNavigate("multiplayer-gameplay");
			} else {
				this.onNavigate("gameplay");
			}
		}
	}
}
