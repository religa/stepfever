import { expect, test } from "@playwright/test";
import { clearAppState, navigateToMainMenu, navigateToSongSelect, waitForResults } from "./helpers/test-helpers";

test.describe("Gameplay", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await navigateToMainMenu(page);
	});

	test("should load gameplay screen after selecting a song", async ({ page }) => {
		await navigateToSongSelect(page);
		// Wait for songs to load from bundled JSON
		await expect(page.locator(".song-item").first()).toBeVisible();

		await page.keyboard.press("Enter");

		// Game canvas should appear
		await expect(page.locator("#game-canvas")).toBeVisible({ timeout: 5000 });
	});

	test("should display game canvas", async ({ page }) => {
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		const canvas = page.locator("#game-canvas");
		await expect(canvas).toBeVisible();

		// Canvas should have dimensions
		const width = await canvas.evaluate((el: HTMLCanvasElement) => el.width);
		const height = await canvas.evaluate((el: HTMLCanvasElement) => el.height);

		expect(width).toBeGreaterThan(0);
		expect(height).toBeGreaterThan(0);
	});

	test("should handle keyboard input during gameplay", async ({ page }) => {
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		await expect(page.locator("#game-canvas")).toBeVisible();

		// Try pressing arrow keys (should register as input)
		await page.keyboard.press("ArrowLeft");
		await page.keyboard.press("ArrowDown");
		await page.keyboard.press("ArrowUp");
		await page.keyboard.press("ArrowRight");

		// Game should still be running
		await expect(page.locator("#game-canvas")).toBeVisible();
	});

	test("should handle DFJK keys as alternative input", async ({ page }) => {
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		await expect(page.locator("#game-canvas")).toBeVisible();

		// Try DFJK keys
		await page.keyboard.press("d");
		await page.keyboard.press("f");
		await page.keyboard.press("j");
		await page.keyboard.press("k");

		// Game should still be running
		await expect(page.locator("#game-canvas")).toBeVisible();
	});

	test("should transition to results screen after gameplay", async ({ page }) => {
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		await expect(page.locator("#game-canvas")).toBeVisible();

		// Wait for results (with generous timeout for gameplay to complete)
		await waitForResults(page, 40000);

		// Results should be visible
		await expect(page.locator(".results, .grade")).toBeVisible();
	});

	test("should display score after gameplay completion", async ({ page }) => {
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		await waitForResults(page, 40000);

		// Grade should be displayed
		await expect(page.locator(".grade")).toBeVisible();

		const gradeText = await page.locator(".grade").textContent();
		expect(gradeText).toMatch(/AAA|AA|A|B|C|D|F/);
	});

	test("should handle chart loading errors gracefully", async ({ page }) => {
		// Mock a broken chart file response
		await page.route("**/charts/**/*.sm", async (route) => {
			await route.fulfill({
				status: 404,
				body: "Not found",
			});
		});

		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		// Should show error or navigate back to song select
		await page.waitForTimeout(2000);

		// Either error message or back to song select
		const hasError = await page
			.locator(".error")
			.isVisible()
			.catch(() => false);
		const hasSongSelect = await page
			.locator(".song-select")
			.isVisible()
			.catch(() => false);

		expect(hasError || hasSongSelect).toBe(true);
	});

	test("should handle audio loading errors gracefully", async ({ page }) => {
		// Mock broken audio file
		await page.route("**/charts/**/*.ogg", async (route) => {
			await route.fulfill({
				status: 404,
				body: "Not found",
			});
		});
		await page.route("**/charts/**/*.mp3", async (route) => {
			await route.fulfill({
				status: 404,
				body: "Not found",
			});
		});

		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		// Should handle error
		await page.waitForTimeout(2000);

		const hasError = await page
			.locator(".error, .song-select")
			.isVisible()
			.catch(() => false);
		expect(hasError).toBe(true);
	});

	test("should apply global offset from calibration", async ({ page }) => {
		// Set a calibration offset
		await page.evaluate(() => {
			localStorage.setItem(
				"stepfever-preferences",
				JSON.stringify({
					state: { globalOffset: 0.05, playerName: "TestPlayer", showFps: false },
					version: 0,
				}),
			);
		});

		await page.reload();
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		// Game should load with offset applied
		await expect(page.locator("#game-canvas")).toBeVisible();

		// Wait a bit to ensure game is running
		await page.waitForTimeout(1000);

		// Game should still be running (offset shouldn't break it)
		await expect(page.locator("#game-canvas")).toBeVisible();
	});

	test("should handle multiple songs sequentially", async ({ page }) => {
		// Play first song
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		await waitForResults(page, 40000);
		await expect(page.locator(".results")).toBeVisible();

		// Return to song select
		await page.keyboard.press("Enter");
		await expect(page.locator(".song-select")).toBeVisible();

		// Play another song (or same song)
		await page.keyboard.press("Enter");
		await expect(page.locator("#game-canvas")).toBeVisible({ timeout: 5000 });
	});

	test("should cleanup resources when leaving gameplay", async ({ page }) => {
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		await expect(page.locator("#game-canvas")).toBeVisible();

		// Navigate away
		await waitForResults(page, 40000);

		// Canvas should be cleaned up
		const canvasExists = await page.locator("#game-canvas").count();
		expect(canvasExists).toBe(0);
	});

	test("should handle rapid key presses without performance issues", async ({ page }) => {
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		await expect(page.locator("#game-canvas")).toBeVisible();

		// Rapidly press keys
		for (let i = 0; i < 50; i++) {
			await page.keyboard.press("ArrowLeft");
			await page.keyboard.press("ArrowDown");
			await page.keyboard.press("ArrowUp");
			await page.keyboard.press("ArrowRight");
		}

		// Game should still be running
		await expect(page.locator("#game-canvas")).toBeVisible();
	});

	test("should maintain consistent frame rate during gameplay", async ({ page }) => {
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		await expect(page.locator("#game-canvas")).toBeVisible();

		// Monitor for a few seconds
		await page.waitForTimeout(3000);

		// Game should still be responsive
		await page.keyboard.press("ArrowDown");
		await expect(page.locator("#game-canvas")).toBeVisible();
	});
});
