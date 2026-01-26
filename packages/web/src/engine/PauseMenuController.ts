/**
 * Interface for engines that can be paused/resumed.
 * Both GameEngine and MultiplayerEngine implement this.
 */
export interface PauseableEngine {
	pause(): void;
	resume(): void;
}

/**
 * Callbacks for pause menu actions that require screen-level handling.
 */
export interface PauseMenuCallbacks {
	onRestart: () => Promise<void>;
	onQuit: () => void;
}

/**
 * Controller for the pause menu overlay.
 * Extracts shared pause menu logic from GameplayNew and MultiplayerGameplay screens.
 */
export class PauseMenuController {
	private isPaused = false;
	private pauseOverlay: HTMLElement | null = null;
	private selectedOption = 0;
	private readonly pauseOptions = ["Resume", "Restart", "Quit"] as const;
	private engine: PauseableEngine | null = null;

	constructor(
		private container: HTMLElement,
		private callbacks: PauseMenuCallbacks,
	) {}

	/**
	 * Set the engine to control. Can be set after construction
	 * when engine is created asynchronously.
	 */
	setEngine(engine: PauseableEngine): void {
		this.engine = engine;
	}

	/**
	 * Whether the game is currently paused.
	 */
	get paused(): boolean {
		return this.isPaused;
	}

	/**
	 * Handle keyboard events for pause menu.
	 * Returns true if the event was handled and should be stopped.
	 */
	handleKeydown(e: KeyboardEvent): boolean {
		// Handle pause menu navigation when paused
		if (this.isPaused) {
			if (e.key === "ArrowUp") {
				this.navigateMenu(-1);
				return true;
			}
			if (e.key === "ArrowDown") {
				this.navigateMenu(1);
				return true;
			}
			if (e.key === "Enter" || e.key === " ") {
				this.selectOption();
				return true;
			}
			if (e.key === "Escape") {
				this.resume();
				return true;
			}
			// Block all other keys while paused
			return true;
		}

		// When not paused, don't intercept any keys - let them through to gameplay input
		// Only Escape toggles pause (handled by the screen's keydown handler)
		return false;
	}

	/**
	 * Toggle pause state.
	 */
	toggle(): void {
		if (this.isPaused) {
			this.resume();
		} else {
			this.pause();
		}
	}

	/**
	 * Pause the game and show overlay.
	 */
	pause(): void {
		if (!this.engine || this.isPaused) return;

		this.isPaused = true;
		this.engine.pause();
		this.showOverlay();
	}

	/**
	 * Resume the game and hide overlay.
	 */
	resume(): void {
		if (!this.engine || !this.isPaused) return;

		this.isPaused = false;
		this.hideOverlay();
		this.engine.resume();
	}

	/**
	 * Reset pause state without resuming (for restart).
	 */
	reset(): void {
		this.isPaused = false;
		this.selectedOption = 0;
		this.hideOverlay();
	}

	/**
	 * Clean up pause overlay.
	 */
	dispose(): void {
		this.hideOverlay();
		this.engine = null;
	}

	private showOverlay(): void {
		if (this.pauseOverlay) return;

		this.pauseOverlay = document.createElement("div");
		this.pauseOverlay.className = "pause-overlay";
		this.pauseOverlay.innerHTML = `
			<div class="pause-menu">
				<h2>PAUSED</h2>
				<div class="pause-options">
					${this.pauseOptions.map((opt, i) => `<div class="pause-option${i === this.selectedOption ? " selected" : ""}" data-index="${i}">${opt}</div>`).join("")}
				</div>
			</div>
		`;

		// Add click handlers for options
		const options = this.pauseOverlay.querySelectorAll(".pause-option");
		options.forEach((opt, i) => {
			opt.addEventListener("click", () => {
				this.selectedOption = i;
				this.updateSelectedOption();
				this.selectOption();
			});
		});

		this.container.appendChild(this.pauseOverlay);
	}

	private hideOverlay(): void {
		if (this.pauseOverlay) {
			this.pauseOverlay.remove();
			this.pauseOverlay = null;
		}
	}

	private navigateMenu(direction: number): void {
		this.selectedOption = (this.selectedOption + direction + this.pauseOptions.length) % this.pauseOptions.length;
		this.updateSelectedOption();
	}

	private updateSelectedOption(): void {
		if (!this.pauseOverlay) return;

		const options = this.pauseOverlay.querySelectorAll(".pause-option");
		options.forEach((opt, i) => {
			opt.classList.toggle("selected", i === this.selectedOption);
		});
	}

	private selectOption(): void {
		const option = this.pauseOptions[this.selectedOption];
		switch (option) {
			case "Resume":
				this.resume();
				break;
			case "Restart":
				this.callbacks.onRestart();
				break;
			case "Quit":
				this.callbacks.onQuit();
				break;
		}
	}
}
