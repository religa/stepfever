import { expect, test } from "@playwright/test";
import { getCurrentPath, goBack, goForward, setupPlayerState } from "./helpers/navigation-helpers";
import { clearAppState, navigateToMainMenu, navigateToSongSelect } from "./helpers/test-helpers";

test.describe("URL Routing & Browser History", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
	});

	test.describe("Deep Linking", () => {
		test("should load Main Menu at root URL /", async ({ page }) => {
			await page.goto("/");
			await expect(page.locator("h1")).toContainText("StepFever");
			await expect(page.locator(".main-menu")).toBeVisible();
			expect(await getCurrentPath(page)).toBe("/");
		});

		test("should deep link directly to /single/songs", async ({ page }) => {
			await setupPlayerState(page);
			await page.goto("/single/songs");

			await expect(page.locator(".song-select")).toBeVisible();
			await expect(page.locator("h2")).toContainText("Select Song");
			expect(await getCurrentPath(page)).toBe("/single/songs");
		});

		test("should deep link directly to /multi/setup", async ({ page }) => {
			await setupPlayerState(page);
			await page.goto("/multi/setup");

			await expect(page.locator(".player-setup, .multiplayer-setup")).toBeVisible();
			expect(await getCurrentPath(page)).toBe("/multi/setup");
		});

		test("should deep link directly to /settings", async ({ page }) => {
			await page.goto("/settings");

			await expect(page.locator(".settings, .options")).toBeVisible();
			expect(await getCurrentPath(page)).toBe("/settings");
		});
	});

	test.describe("Browser History", () => {
		test("should handle browser back from Song Select to Main Menu", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);

			await expect(page.locator(".song-select")).toBeVisible();

			await goBack(page);

			await expect(page.locator(".main-menu")).toBeVisible();
			expect(await getCurrentPath(page)).toBe("/");
		});

		test("should handle browser back from Settings to Main Menu", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-options");

			await expect(page.locator(".settings, .options")).toBeVisible();

			await goBack(page);

			await expect(page.locator(".main-menu")).toBeVisible();
			expect(await getCurrentPath(page)).toBe("/");
		});

		test("should handle browser forward after back navigation", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);

			await expect(page.locator(".song-select")).toBeVisible();

			await goBack(page);
			await expect(page.locator(".main-menu")).toBeVisible();

			await goForward(page);
			await expect(page.locator(".song-select")).toBeVisible();
			expect(await getCurrentPath(page)).toBe("/single/songs");
		});

		test("should handle Results route guard (redirect without history.state)", async ({ page }) => {
			// Direct navigation to results without state should redirect to song select
			await setupPlayerState(page);
			await page.goto("/single/results");

			// Should redirect to song select since there's no history.state
			await expect(page.locator(".song-select")).toBeVisible();
			expect(await getCurrentPath(page)).toBe("/single/songs");
		});
	});

	test.describe("State Restoration", () => {
		test("should preserve multiplayer mode on page refresh at /multi/*", async ({ page }) => {
			await setupPlayerState(page);
			await page.goto("/multi/setup");

			await expect(page.locator(".player-setup, .multiplayer-setup")).toBeVisible();

			await page.reload();

			// Should still be on multiplayer setup after refresh
			await expect(page.locator(".player-setup, .multiplayer-setup")).toBeVisible();
			expect(await getCurrentPath(page)).toBe("/multi/setup");
		});

		test("should reset gracefully on refresh at protected route", async ({ page }) => {
			await setupPlayerState(page);

			// Trying to refresh at /single/results without state
			await page.goto("/single/results");

			// Should redirect to song select
			await expect(page.locator(".song-select")).toBeVisible();
		});

		test("should maintain selected song after soft navigation", async ({ page }) => {
			await setupPlayerState(page);
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			// Wait for songs to load from bundled JSON
			await expect(page.locator(".song-item").first()).toBeVisible();

			// Select second song
			await page.keyboard.press("ArrowDown");
			await page.waitForTimeout(100);

			// Navigate to settings via ESC and back
			await page.keyboard.press("Escape");
			await expect(page.locator(".main-menu")).toBeVisible();

			// Go back to song select
			await navigateToSongSelect(page);
			// Wait for songs to load from bundled JSON
			await expect(page.locator(".song-item").first()).toBeVisible();

			// First song should be selected (selection is reset on screen mount)
			await expect(page.locator(".song-item.selected")).toBeVisible();
		});

		test("should sync URL with screen state after programmatic navigation", async ({ page }) => {
			await navigateToMainMenu(page);

			// Navigate programmatically via button
			await page.click("#btn-play");
			await expect(page.locator(".song-select")).toBeVisible();

			// URL should be updated
			expect(await getCurrentPath(page)).toBe("/single/songs");

			// Navigate to settings
			await page.keyboard.press("Escape");
			await expect(page.locator(".main-menu")).toBeVisible();

			await page.click("#btn-options");
			await expect(page.locator(".settings, .options")).toBeVisible();

			// URL should be /settings
			expect(await getCurrentPath(page)).toBe("/settings");
		});
	});
});
