/**
 * Screen interface for all screens in the application
 * mount() can be async for screens that need to load data before rendering
 */
export interface Screen {
	mount(container: HTMLElement): void | Promise<void>;
	unmount(): void;
}

/**
 * ScreenManager handles navigation between different screens
 * Shows loading indicator during async screen transitions
 */
export class ScreenManager {
	private currentScreen: Screen | null = null;
	private loadingOverlay: HTMLElement | null = null;
	private navigationId = 0;

	constructor(private container: HTMLElement) {}

	/**
	 * Navigate to a new screen (supports async mount)
	 * Uses navigation ID to handle race conditions when multiple navigations overlap
	 */
	async navigateTo(screen: Screen): Promise<void> {
		const navId = ++this.navigationId;

		if (this.currentScreen) {
			this.currentScreen.unmount();
		}

		// Show loading indicator for potentially async screens
		this.showLoading();

		this.currentScreen = screen;

		try {
			await this.currentScreen.mount(this.container);
		} finally {
			// Only hide loading if this is still the current navigation
			if (this.navigationId === navId) {
				this.hideLoading();
			}
		}
	}

	/**
	 * Show loading overlay during screen transitions
	 * Removes any existing overlay first to prevent duplicates
	 */
	private showLoading(): void {
		this.hideLoading(); // Prevent duplicate overlays
		this.loadingOverlay = document.createElement("div");
		this.loadingOverlay.className = "screen-loading";
		this.loadingOverlay.innerHTML = `
			<div class="loading-spinner"></div>
			<span>Loading...</span>
		`;
		this.container.appendChild(this.loadingOverlay);
	}

	/**
	 * Hide loading overlay after screen has mounted
	 */
	private hideLoading(): void {
		this.loadingOverlay?.remove();
		this.loadingOverlay = null;
	}

	/**
	 * Get the current screen
	 */
	getCurrentScreen(): Screen | null {
		return this.currentScreen;
	}

	/**
	 * Cleanup current screen
	 */
	cleanup(): void {
		if (this.currentScreen) {
			this.currentScreen.unmount();
			this.currentScreen = null;
		}
		this.hideLoading();
	}
}
