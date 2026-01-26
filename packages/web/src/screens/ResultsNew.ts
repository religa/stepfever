import type { FinalScore } from "@stepfever/core";
import { menuAudio } from "../audio/MenuAudio";
import { useAppStore } from "../stores/appStore";
import { type LocalScore, scoresStore } from "../stores/scoresStore";
import { getDifficultyClass } from "../utils/difficulty";
import { escapeHtml } from "../utils/html";
import type { Screen } from "./ScreenManager";

const GRADE_COLORS: Record<string, string> = {
	AAA: "#FFD700",
	AA: "#C0C0C0",
	A: "#CD7F32",
	B: "#4169E1",
	C: "#32CD32",
	D: "#FFAA00",
	F: "#DC143C",
};

export class ResultsScreen implements Screen {
	private container: HTMLElement | null = null;
	private score: FinalScore;
	private onNavigate: (screen: string) => void;
	private keyHandler: ((e: KeyboardEvent) => void) | null = null;

	constructor(score: FinalScore, onNavigate: (screen: string) => void) {
		this.score = score;
		this.onNavigate = onNavigate;
	}

	async mount(container: HTMLElement): Promise<void> {
		this.container = container;

		// Save score locally
		this.saveScore();

		// Render with local score
		this.render();
		this.attachKeyboardListeners();
	}

	private saveScore(): void {
		const { selectedSong, selectedDifficulty, playerName } = useAppStore.getState();
		if (!selectedSong || !selectedDifficulty) return;

		// Prompt for name if not set
		let name = playerName;
		if (!name) {
			const promptedName = prompt("Enter your name for the leaderboard:");
			if (promptedName?.trim()) {
				name = promptedName.trim();
				useAppStore.getState().setPlayerName(name);
			} else {
				name = "Anonymous";
			}
		}

		// Calculate score value (simple formula)
		const totalNotes =
			this.score.judgments.marvelous +
			this.score.judgments.perfect +
			this.score.judgments.great +
			this.score.judgments.good +
			this.score.judgments.boo +
			this.score.judgments.miss;
		const scoreValue = Math.round(this.score.accuracy * totalNotes * 10);

		scoresStore.getState().saveScore(selectedSong.id, selectedDifficulty.name, {
			score: scoreValue,
			accuracy: this.score.accuracy,
			grade: this.score.grade,
			maxCombo: this.score.maxCombo,
			judgments: this.score.judgments,
		});
	}

	unmount(): void {
		// Clean up keyboard listener to prevent ghost navigation
		if (this.keyHandler) {
			window.removeEventListener("keydown", this.keyHandler);
			this.keyHandler = null;
		}
		if (this.container) {
			this.container.innerHTML = "";
			this.container = null;
		}
	}

	private render(): void {
		if (!this.container) return;

		const { selectedSong, selectedDifficulty } = useAppStore.getState();

		// Get best score for this song/difficulty
		const bestScore =
			selectedSong && selectedDifficulty
				? scoresStore.getState().getBestScore(selectedSong.id, selectedDifficulty.name)
				: undefined;

		const gradeColor = GRADE_COLORS[this.score.grade] ?? "#FFFFFF";

		this.container.innerHTML = `
      <div class="results">
        <h1 class="grade grade-${escapeHtml(this.score.grade)}" style="color: ${gradeColor}">${escapeHtml(this.score.grade)}</h1>

        <div class="song-info">
          <h2>${escapeHtml(selectedSong?.title ?? "Unknown")}</h2>
          <p>${escapeHtml(selectedSong?.artist ?? "")} - <span class="${getDifficultyClass(selectedDifficulty?.name ?? "")}">${escapeHtml(selectedDifficulty?.name ?? "")}</span></p>
        </div>

        <div class="score-details">
          <div class="score-item">
            <span class="label">Accuracy</span>
            <span class="value">${this.score.accuracy.toFixed(2)}%</span>
          </div>
          <div class="score-item">
            <span class="label">Max Combo</span>
            <span class="value">${this.score.maxCombo}</span>
          </div>
        </div>

        <div class="judgment-breakdown">
          <h3>Judgment Breakdown</h3>
          <div class="judgment-item marvelous">
            <span>Marvelous</span>
            <span>${this.score.judgments.marvelous}</span>
          </div>
          <div class="judgment-item perfect">
            <span>Perfect</span>
            <span>${this.score.judgments.perfect}</span>
          </div>
          <div class="judgment-item great">
            <span>Great</span>
            <span>${this.score.judgments.great}</span>
          </div>
          <div class="judgment-item good">
            <span>Good</span>
            <span>${this.score.judgments.good}</span>
          </div>
          <div class="judgment-item boo">
            <span>Boo</span>
            <span>${this.score.judgments.boo}</span>
          </div>
          <div class="judgment-item miss">
            <span>Miss</span>
            <span>${this.score.judgments.miss}</span>
          </div>
        </div>

        ${this.renderBestScore(bestScore)}

        ${this.renderCalibrationHint()}

        <div class="controls">
          <p>ENTER: Song Select • R: Restart • ESC: Main Menu</p>
        </div>
      </div>
    `;
	}

	private renderBestScore(bestScore: LocalScore | undefined): string {
		if (!bestScore) return "";

		const bestGradeColor = GRADE_COLORS[bestScore.grade] ?? "#FFFFFF";

		return `
			<div class="best-score-section">
				<h3>Personal Best</h3>
				<div class="best-score">
					<span class="grade" style="color: ${bestGradeColor}">${escapeHtml(bestScore.grade)}</span>
					<span class="accuracy">${bestScore.accuracy.toFixed(2)}%</span>
					<span class="combo">×${bestScore.maxCombo}</span>
				</div>
			</div>
		`;
	}

	private renderCalibrationHint(): string {
		if (this.score.suggestedOffset === undefined) return "";

		const direction = this.score.suggestedOffset > 0 ? "early" : "late";
		const offsetStr =
			this.score.suggestedOffset > 0 ? `+${this.score.suggestedOffset}` : `${this.score.suggestedOffset}`;

		return `
			<div class="calibration-hint">
				<p>Tip: Your hits are consistently ${escapeHtml(direction)}. Try Settings → Audio Calibration (suggested: ${escapeHtml(offsetStr)}ms)</p>
			</div>
		`;
	}

	private attachKeyboardListeners(): void {
		this.keyHandler = (e: KeyboardEvent) => {
			if (e.key === "Enter") {
				menuAudio.playSelect();
				if (this.keyHandler) {
					window.removeEventListener("keydown", this.keyHandler);
					this.keyHandler = null;
				}
				this.onNavigate("song-select");
			} else if (e.key === "Escape") {
				menuAudio.playCancel();
				if (this.keyHandler) {
					window.removeEventListener("keydown", this.keyHandler);
					this.keyHandler = null;
				}
				this.onNavigate("main-menu");
			} else if (e.key === "r" || e.key === "R") {
				// Quick restart - replay the same song
				menuAudio.playSelect();
				if (this.keyHandler) {
					window.removeEventListener("keydown", this.keyHandler);
					this.keyHandler = null;
				}
				this.onNavigate("gameplay");
			}
		};

		window.addEventListener("keydown", this.keyHandler);
	}
}
