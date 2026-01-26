import { menuAudio } from "../audio/MenuAudio";
import type { PlayerResult } from "../multiplayer/PlayerState";
import { escapeHtml } from "../utils/html";
import type { Screen } from "./ScreenManager";

export interface MultiplayerResultsCallbacks {
	onContinue: () => void;
	onRetry?: () => void;
}

/**
 * MultiplayerResults screen - displays rankings and per-player stats
 */
export class MultiplayerResultsScreen implements Screen {
	private container: HTMLElement | null = null;

	constructor(
		private results: PlayerResult[],
		private callbacks: MultiplayerResultsCallbacks,
	) {
		// Sort by rank
		this.results.sort((a, b) => a.rank - b.rank);
	}

	mount(container: HTMLElement): void {
		this.container = container;
		this.render();
		window.addEventListener("keydown", this.handleKey);
	}

	unmount(): void {
		window.removeEventListener("keydown", this.handleKey);
		if (this.container) {
			this.container.innerHTML = "";
		}
	}

	private handleKey = (e: KeyboardEvent): void => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			menuAudio.playSelect();
			this.callbacks.onContinue();
		} else if (e.key === "Escape") {
			e.preventDefault();
			menuAudio.playCancel();
			this.callbacks.onContinue();
		} else if (e.key === "r" || e.key === "R") {
			e.preventDefault();
			menuAudio.playSelect();
			this.callbacks.onRetry?.();
		}
	};

	private render(): void {
		if (!this.container) return;

		const winner = this.results[0];
		if (!winner) {
			this.container.innerHTML = "<div>No results available</div>";
			return;
		}
		const winnerName = winner.controllerName || "Unknown";

		const playersHtml = this.results
			.map((player) => {
				const score = player.score;
				if (!score) return "";

				const gradeColors: Record<string, string> = {
					AAA: "#00ffff",
					AA: "#ffff00",
					A: "#00ff00",
					B: "#0088ff",
					C: "#ff8800",
					D: "#ff0000",
					F: "#888888",
				};

				const gradeColor = gradeColors[score.grade] ?? "#ffffff";
				const rankEmojis = ["🥇", "🥈", "🥉"];
				const rankEmoji = rankEmojis[Math.min(player.rank - 1, 2)] ?? "";

				return `
					<div class="player-result">
						<div class="player-rank">${rankEmoji} Rank ${player.rank}</div>
						<div class="player-name">Player ${player.playerId + 1} (${escapeHtml(player.controllerName)})</div>
						<div class="player-grade" style="color: ${escapeHtml(gradeColor)}">
							${escapeHtml(score.grade)}
						</div>
						<div class="player-accuracy">
							${escapeHtml(score.accuracy.toFixed(2))}%
						</div>
						<div class="player-combo">
							Max Combo: ${escapeHtml(score.maxCombo)}
						</div>
						<div class="judgment-summary">
							<span class="judgment-marvelous">${escapeHtml(score.judgments.marvelous)} M</span>
							<span class="judgment-perfect">${escapeHtml(score.judgments.perfect)} P</span>
							<span class="judgment-great">${escapeHtml(score.judgments.great)} Gr</span>
							<span class="judgment-good">${escapeHtml(score.judgments.good)} Gd</span>
							<span class="judgment-boo">${escapeHtml(score.judgments.boo)} B</span>
							<span class="judgment-miss">${escapeHtml(score.judgments.miss)} X</span>
						</div>
					</div>
				`;
			})
			.join("");

		this.container.innerHTML = `
			<div class="multiplayer-results">
				<h1>Multiplayer Results</h1>
				<div class="winner-announcement">
					🏆 Winner: ${escapeHtml(winnerName)} 🏆
				</div>

				<div class="players-results">
					${playersHtml}
				</div>

				<div class="results-actions">
					<button id="btn-continue" class="menu-button">Continue</button>
					${this.callbacks.onRetry ? '<button id="btn-retry" class="menu-button">Play Again</button>' : ""}
				</div>

				<div class="controls">
					<p>ENTER/ESC to continue${this.callbacks.onRetry ? " • R to play again" : ""}</p>
				</div>
			</div>
		`;

		this.attachClickHandlers();
	}

	private attachClickHandlers(): void {
		document.getElementById("btn-continue")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.callbacks.onContinue();
		});

		document.getElementById("btn-retry")?.addEventListener("click", () => {
			menuAudio.playSelect();
			this.callbacks.onRetry?.();
		});
	}
}
