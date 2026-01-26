import { menuAudio } from "../audio/MenuAudio";
import { songs } from "../songs/loader";
import { type LocalScore, scoresStore } from "../stores/scoresStore";
import { escapeHtml } from "../utils/html";
import type { Screen } from "./ScreenManager";

interface ScoreWithContext extends LocalScore {
	songId: string;
	difficulty: string;
	songTitle: string;
}

const GRADE_COLORS: Record<string, string> = {
	AAA: "#FFD700",
	AA: "#C0C0C0",
	A: "#CD7F32",
	B: "#4169E1",
	C: "#32CD32",
	D: "#FFAA00",
	F: "#DC143C",
};

export class RecentScoresScreen implements Screen {
	private container: HTMLElement | null = null;
	private onNavigate: (screen: string) => void;
	private keyHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(onNavigate: (screen: string) => void) {
		this.onNavigate = onNavigate;
	}

	async mount(container: HTMLElement): Promise<void> {
		this.container = container;
		this.render();
		this.attachEventListeners();
	}

	unmount(): void {
		if (this.keyHandler) {
			window.removeEventListener("keydown", this.keyHandler);
			this.keyHandler = null;
		}
		if (this.container) {
			this.container.innerHTML = "";
			this.container = null;
		}
	}

	private getRecentScores(): ScoreWithContext[] {
		const allScores = scoresStore.getState().scores;
		const songMap = new Map(songs.map((s) => [s.id, s]));

		const scoresWithContext: ScoreWithContext[] = [];
		for (const [key, score] of Object.entries(allScores)) {
			// Use lastIndexOf to handle song IDs containing colons
			const separatorIndex = key.lastIndexOf(":");
			if (separatorIndex === -1) continue;

			const songId = key.slice(0, separatorIndex);
			const difficulty = key.slice(separatorIndex + 1);
			const song = songMap.get(songId);
			if (song) {
				scoresWithContext.push({
					...score,
					songId,
					difficulty,
					songTitle: song.title,
				});
			}
		}

		// Sort by timestamp, most recent first
		return scoresWithContext.sort((a, b) => b.timestamp - a.timestamp).slice(0, 20);
	}

	private render(): void {
		if (!this.container) return;

		const recentScores = this.getRecentScores();

		let scoresHTML: string;
		if (recentScores.length === 0) {
			scoresHTML = '<p class="empty-state">No scores yet. Play some songs to see your history!</p>';
		} else {
			scoresHTML = recentScores
				.map((score) => {
					const gradeColor = GRADE_COLORS[score.grade] ?? "#FFFFFF";
					return `
					<div class="score-row">
						<div class="score-info">
							<span class="song-info">${escapeHtml(score.songTitle)} - ${escapeHtml(score.difficulty)}</span>
						</div>
						<span class="accuracy">${score.accuracy.toFixed(2)}%</span>
						<span class="grade" style="color: ${gradeColor}">${escapeHtml(score.grade)}</span>
					</div>
				`;
				})
				.join("");
		}

		this.container.innerHTML = `
			<div class="recent-scores-screen">
				<h1>Recent Scores</h1>
				<div id="scores-list" class="scores-list">${scoresHTML}</div>
				<div class="controls">
					<button id="btn-back" class="menu-button">Back</button>
					<p>ESC to return</p>
				</div>
			</div>
		`;
	}

	private attachEventListeners(): void {
		document.getElementById("btn-back")?.addEventListener("click", () => {
			menuAudio.playCancel();
			this.onNavigate("main-menu");
		});

		this.keyHandler = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				menuAudio.playCancel();
				this.onNavigate("main-menu");
			}
		};
		window.addEventListener("keydown", this.keyHandler);
	}
}
