import { expect, test } from "@playwright/test";
import { setupPlayerState } from "./helpers/navigation-helpers";
import { clearAppState, navigateToMainMenu, waitForResults } from "./helpers/test-helpers";

test.describe("User Journeys", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await setupPlayerState(page);
	});

	test("complete single player game using mouse only", async ({ page }) => {
		// Main Menu: Click Play
		await navigateToMainMenu(page);
		await page.click("#btn-play");

		// Song Select: Click on first song
		await expect(page.locator(".song-select")).toBeVisible();
		// Wait for songs to load from bundled JSON
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.locator(".song-item").first().click();
		await page.waitForTimeout(100);

		// Click on difficulty to start (double-click)
		await page.locator(".difficulty-item").first().dblclick();

		// Gameplay: Wait for game to finish
		await page.waitForSelector("#game-canvas", { timeout: 5000 });
		await waitForResults(page, 40000);

		// Results: Click Continue button
		await expect(page.locator(".results")).toBeVisible();
		const continueBtn = page.locator(
			"#btn-continue, .btn-continue, button:has-text('Continue'), button:has-text('Song Select')",
		);
		if (await continueBtn.isVisible()) {
			await continueBtn.click();
		} else {
			// Fallback to keyboard
			await page.keyboard.press("Enter");
		}

		// Should be back at Song Select
		await expect(page.locator(".song-select")).toBeVisible();
	});

	test("complete single player game using keyboard only", async ({ page }) => {
		// Main Menu: Enter to start
		await navigateToMainMenu(page);
		await page.keyboard.press("Enter");

		// Song Select: Use arrows to navigate
		await expect(page.locator(".song-select")).toBeVisible();
		// Wait for songs to load from bundled JSON
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("ArrowDown"); // Select song
		await page.waitForTimeout(100);
		await page.keyboard.press("Enter"); // Start gameplay

		// Gameplay: Wait for game to finish
		await page.waitForSelector("#game-canvas", { timeout: 5000 });
		await waitForResults(page, 40000);

		// Results: Press Enter to continue
		await expect(page.locator(".results")).toBeVisible();
		await page.keyboard.press("Enter");

		// Should be back at Song Select
		await expect(page.locator(".song-select")).toBeVisible();
	});

	test("complete multiplayer setup and game", async ({ page }) => {
		// Main Menu: Navigate to Multiplayer
		await navigateToMainMenu(page);
		await page.click("#btn-multiplayer");

		// Player Setup: Configure players
		await expect(page.locator(".player-setup")).toBeVisible();

		// Select player count and continue
		await page.keyboard.press("Enter"); // Go to controller selection
		await page.waitForTimeout(100);
		await page.keyboard.press("Enter"); // Start game

		// Song Select: Select a song
		await expect(page.locator(".song-select")).toBeVisible();
		// Wait for songs to load from bundled JSON
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter"); // Start gameplay

		// Gameplay: Wait for game to finish (multiplayer has multiple canvases)
		await page.waitForSelector("canvas", { timeout: 5000 });
		await waitForResults(page, 40000);

		// Results: Verify multiplayer results
		await expect(page.locator(".results, .multiplayer-results")).toBeVisible();
	});

	test("navigate through all settings screens", async ({ page }) => {
		// Main Menu: Go to Options
		await navigateToMainMenu(page);
		await page.click("#btn-options");

		// Settings screen
		await expect(page.locator(".settings, .options")).toBeVisible();

		// Navigate to Calibration (if button exists)
		const calibrationBtn = page.locator("#btn-calibration, button:has-text('Calibration')");
		if (await calibrationBtn.isVisible()) {
			await calibrationBtn.click();
			await expect(page.locator(".calibration")).toBeVisible();

			// Go back to settings
			await page.keyboard.press("Escape");
			await expect(page.locator(".settings, .options, .main-menu")).toBeVisible();
		}

		// Go back to main menu
		await page.keyboard.press("Escape");
		await expect(page.locator(".main-menu")).toBeVisible();
	});

	test("recover from browser refresh mid-flow", async ({ page }) => {
		// Start a flow: Main Menu -> Song Select
		await navigateToMainMenu(page);
		await page.click("#btn-play");

		await expect(page.locator(".song-select")).toBeVisible();
		// Wait for songs to load from bundled JSON
		await expect(page.locator(".song-item").first()).toBeVisible();

		// Select a song
		await page.keyboard.press("ArrowDown");
		await page.waitForTimeout(100);

		// Refresh the page
		await page.reload();

		// Should recover gracefully to song select
		await expect(page.locator(".song-select")).toBeVisible();

		// Navigation should still work
		await page.keyboard.press("Escape");
		await expect(page.locator(".main-menu")).toBeVisible();

		// Can continue normal flow
		await page.click("#btn-play");
		await expect(page.locator(".song-select")).toBeVisible();
	});
});
