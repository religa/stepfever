import { expect, test } from "@playwright/test";
import { clearAppState, navigateToMainMenu, navigateToSongSelect } from "./helpers/test-helpers";

test.describe("Pause Menu", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await navigateToMainMenu(page);
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();

		// Start gameplay
		await page.keyboard.press("Enter");
		await expect(page.locator("#game-canvas")).toBeVisible({ timeout: 5000 });
	});

	test("ESC should open pause menu during gameplay", async ({ page }) => {
		await page.waitForTimeout(1000); // Let game start

		await page.keyboard.press("Escape");

		await expect(page.locator(".pause-menu, text=PAUSED")).toBeVisible();
	});

	test("pause menu should display Resume, Restart, Quit options", async ({ page }) => {
		await page.waitForTimeout(1000);
		await page.keyboard.press("Escape");

		await expect(page.locator("text=Resume")).toBeVisible();
		await expect(page.locator("text=Restart")).toBeVisible();
		await expect(page.locator("text=Quit")).toBeVisible();
	});

	test("Resume should continue gameplay", async ({ page }) => {
		await page.waitForTimeout(1000);
		await page.keyboard.press("Escape");
		await expect(page.locator("text=PAUSED")).toBeVisible();

		// Press Enter to resume (first option)
		await page.keyboard.press("Enter");

		// Pause menu should close, game should continue
		await expect(page.locator("text=PAUSED")).not.toBeVisible();
		await expect(page.locator("#game-canvas")).toBeVisible();
	});

	test("ESC should toggle pause menu (close when open)", async ({ page }) => {
		await page.waitForTimeout(1000);

		// Open pause menu
		await page.keyboard.press("Escape");
		await expect(page.locator("text=PAUSED")).toBeVisible();

		// Close pause menu with ESC
		await page.keyboard.press("Escape");
		await expect(page.locator("text=PAUSED")).not.toBeVisible();
	});

	test("Restart should reset the song", async ({ page }) => {
		await page.waitForTimeout(2000); // Let some notes pass
		await page.keyboard.press("Escape");

		// Navigate to Restart (ArrowDown once from Resume)
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Enter");

		// Game should restart
		await expect(page.locator("#game-canvas")).toBeVisible();
		// Pause menu should close
		await expect(page.locator("text=PAUSED")).not.toBeVisible();
	});

	test("Quit should return to song select", async ({ page }) => {
		await page.waitForTimeout(1000);
		await page.keyboard.press("Escape");

		// Navigate to Quit (ArrowDown twice from Resume)
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("Enter");

		// Should return to song select
		await expect(page.locator(".song-select")).toBeVisible();
	});

	test("arrow keys should navigate pause menu options", async ({ page }) => {
		await page.waitForTimeout(1000);
		await page.keyboard.press("Escape");
		await expect(page.locator("text=PAUSED")).toBeVisible();

		// Navigate down
		await page.keyboard.press("ArrowDown");
		await page.waitForTimeout(100);

		// Navigate up
		await page.keyboard.press("ArrowUp");
		await page.waitForTimeout(100);

		// Should still be on pause menu
		await expect(page.locator("text=PAUSED")).toBeVisible();
	});

	test("game should freeze while paused", async ({ page }) => {
		await page.waitForTimeout(1000);
		await page.keyboard.press("Escape");
		await expect(page.locator("text=PAUSED")).toBeVisible();

		// Wait and check game is still paused
		await page.waitForTimeout(1000);
		await expect(page.locator("text=PAUSED")).toBeVisible();
		await expect(page.locator("#game-canvas")).toBeVisible();
	});
});
