import { expect, test } from "@playwright/test";
import { getCurrentPath, setupPlayerState } from "./helpers/navigation-helpers";
import { clearAppState, navigateToMainMenu, navigateToSongSelect } from "./helpers/test-helpers";

test.describe("Multiplayer Navigation", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await setupPlayerState(page);
	});

	test.describe("Player Setup", () => {
		test("should navigate to multiplayer setup on Multiplayer button click", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");

			await expect(page.locator(".player-setup")).toBeVisible();
			expect(await getCurrentPath(page)).toBe("/multi/setup");
		});

		test("should increase player count via ArrowDown", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");

			await expect(page.locator(".player-setup")).toBeVisible();

			// Default is 2 players, ArrowDown should increase to 3
			await page.keyboard.press("ArrowDown");
			await page.waitForTimeout(100);

			await expect(page.locator(".player-setup")).toContainText("3");
		});

		test("should decrease player count via ArrowUp", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");

			await expect(page.locator(".player-setup")).toBeVisible();

			// First increase to 3
			await page.keyboard.press("ArrowDown");
			await page.waitForTimeout(100);

			// Then decrease back to 2
			await page.keyboard.press("ArrowUp");
			await page.waitForTimeout(100);

			await expect(page.locator(".player-setup")).toContainText("2");
		});

		test("should navigate between player slots with Arrow keys in controller selection mode", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");

			await expect(page.locator(".player-setup")).toBeVisible();

			// Enter controller selection mode
			await page.keyboard.press("Enter");
			await page.waitForTimeout(100);

			// Navigate between player slots
			await page.keyboard.press("ArrowDown");
			await page.waitForTimeout(100);

			// The second player should now be selected (indicated by ►)
			const html = await page.locator(".player-setup").innerHTML();
			expect(html).toContain("Player 2");
		});

		test("should show controller conflict warning when same controller selected", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");

			await expect(page.locator(".player-setup")).toBeVisible();

			// Enter controller selection mode
			await page.keyboard.press("Enter");
			await page.waitForTimeout(100);

			// Select the same controller for player 2 as player 1
			await page.keyboard.press("ArrowDown"); // Go to player 2
			await page.waitForTimeout(100);
			await page.keyboard.press("ArrowLeft"); // Change to same controller as player 1
			await page.waitForTimeout(100);

			// Should show warning
			await expect(page.locator(".warning")).toBeVisible();
		});

		test("should proceed to song select on valid controller configuration", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");

			await expect(page.locator(".player-setup")).toBeVisible();

			// Enter controller selection mode
			await page.keyboard.press("Enter");
			await page.waitForTimeout(100);

			// Press Enter to start (with default valid config)
			await page.keyboard.press("Enter");

			// Should navigate to song select in multi mode
			await expect(page.locator(".song-select")).toBeVisible();
			expect(await getCurrentPath(page)).toBe("/multi/songs");
		});
	});

	test.describe("Mode Transitions", () => {
		test("ESC from Song Select should route to player-setup in multi mode", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");

			await expect(page.locator(".player-setup")).toBeVisible();

			// Go to song select
			await page.keyboard.press("Enter");
			await page.waitForTimeout(100);
			await page.keyboard.press("Enter");

			await expect(page.locator(".song-select")).toBeVisible();

			// ESC should go back to player setup in multi mode
			await page.keyboard.press("Escape");

			await expect(page.locator(".player-setup")).toBeVisible();
		});

		test("ESC from Song Select should route to main-menu in single mode", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);

			await expect(page.locator(".song-select")).toBeVisible();

			// ESC should go to main menu in single mode
			await page.keyboard.press("Escape");

			await expect(page.locator(".main-menu")).toBeVisible();
		});

		test("should preserve multiplayer config through Song Select navigation", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");

			// Set 3 players
			await page.keyboard.press("ArrowDown");
			await page.waitForTimeout(100);

			// Enter controller selection and start
			await page.keyboard.press("Enter");
			await page.waitForTimeout(100);
			await page.keyboard.press("Enter");

			await expect(page.locator(".song-select")).toBeVisible();

			// Go back to player setup
			await page.keyboard.press("Escape");

			// Should still show 3 players
			await expect(page.locator(".player-setup")).toContainText("3");
		});

		test("should return to player-setup from controller selection on ESC", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");

			await expect(page.locator(".player-setup")).toBeVisible();

			// Enter controller selection mode
			await page.keyboard.press("Enter");
			await page.waitForTimeout(100);

			// Should be in controller selection
			await expect(page.locator(".player-setup")).toContainText("Controller Setup");

			// ESC should go back to player count selection
			await page.keyboard.press("Escape");
			await page.waitForTimeout(100);

			await expect(page.locator(".player-setup")).toContainText("Number of Players");
		});
	});

	test.describe("State Leakage Prevention", () => {
		test("Play button should clear multiplayerConfig state", async ({ page }) => {
			await navigateToMainMenu(page);

			// First do a multiplayer setup
			await page.click("#btn-multiplayer");
			await page.keyboard.press("Enter");
			await page.waitForTimeout(100);
			await page.keyboard.press("Enter");

			await expect(page.locator(".song-select")).toBeVisible();

			// Go back to main menu
			await page.keyboard.press("Escape");
			await page.keyboard.press("Escape");
			await page.keyboard.press("Escape");
			await expect(page.locator(".main-menu")).toBeVisible();

			// Now click Play (single player)
			await page.click("#btn-play");

			await expect(page.locator(".song-select")).toBeVisible();

			// Should be in single player mode (URL shows /single/songs)
			expect(await getCurrentPath(page)).toBe("/single/songs");
		});

		test("Single player game should not have multiplayer UI elements", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			// Wait for songs to load from bundled JSON
			await expect(page.locator(".song-item").first()).toBeVisible();

			await page.keyboard.press("Enter");

			// Wait for game to load
			await page.waitForSelector("#game-canvas", { timeout: 5000 });

			// Should have single canvas, not multiple
			const canvasCount = await page.locator("canvas").count();
			expect(canvasCount).toBe(1);
		});

		test("Multiplayer should not affect single player subsequent plays", async ({ page }) => {
			// Play multiplayer first
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");
			await page.keyboard.press("Enter");
			await page.waitForTimeout(100);
			await page.keyboard.press("Escape");
			await page.keyboard.press("Escape");

			// Now play single player
			await page.click("#btn-play");
			await expect(page.locator(".song-select")).toBeVisible();

			// URL should indicate single player mode
			expect(await getCurrentPath(page)).toBe("/single/songs");
		});

		test("Refresh during multiplayer should reset to safe state", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");

			await expect(page.locator(".player-setup")).toBeVisible();

			// Refresh
			await page.reload();

			// Should remain on player setup (safe state for /multi/setup)
			await expect(page.locator(".player-setup")).toBeVisible();
			expect(await getCurrentPath(page)).toBe("/multi/setup");
		});
	});
});
