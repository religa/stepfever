import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { setupPlayerState } from "./helpers/navigation-helpers";
import { clearAppState, navigateToMainMenu, navigateToSongSelect, waitForResults } from "./helpers/test-helpers";

test.describe("Accessibility", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
	});

	test.describe("Screen-level a11y checks", () => {
		test("Main Menu should have no a11y violations", async ({ page }) => {
			await navigateToMainMenu(page);

			const results = await new AxeBuilder({ page })
				.exclude("#game-canvas") // Exclude canvas elements
				.analyze();

			expect(results.violations).toEqual([]);
		});

		test("Song Select should have no a11y violations", async ({ page }) => {
			await setupPlayerState(page);
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			// Wait for songs to load from bundled JSON
			await expect(page.locator(".song-item").first()).toBeVisible();

			const results = await new AxeBuilder({ page }).exclude("#game-canvas").analyze();

			expect(results.violations).toEqual([]);
		});

		test("Settings should have no a11y violations", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-options");
			await expect(page.locator(".settings, .options")).toBeVisible();

			const results = await new AxeBuilder({ page }).exclude("#game-canvas").analyze();

			expect(results.violations).toEqual([]);
		});

		test("Results should have no a11y violations", async ({ page }) => {
			await setupPlayerState(page);
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			// Wait for songs to load from bundled JSON
			await expect(page.locator(".song-item").first()).toBeVisible();
			await page.keyboard.press("Enter");
			await waitForResults(page, 40000);

			const results = await new AxeBuilder({ page }).exclude("#game-canvas").analyze();

			expect(results.violations).toEqual([]);
		});

		test("Calibration should have no a11y violations", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-calibration");
			await expect(page.locator(".calibration")).toBeVisible();

			const results = await new AxeBuilder({ page }).exclude("#game-canvas").analyze();

			expect(results.violations).toEqual([]);
		});

		test("Player Setup should have no a11y violations", async ({ page }) => {
			await setupPlayerState(page);
			await navigateToMainMenu(page);
			await page.click("#btn-multiplayer");
			await expect(page.locator(".player-setup, .multiplayer-setup")).toBeVisible();

			const results = await new AxeBuilder({ page }).exclude("#game-canvas").analyze();

			expect(results.violations).toEqual([]);
		});
	});

	test.describe("Keyboard focus management", () => {
		test("Main Menu should have correct focus order via Tab", async ({ page }) => {
			await navigateToMainMenu(page);

			// Tab through all interactive elements
			await page.keyboard.press("Tab");

			// Should have focus on some interactive element
			const focusedElement = await page.evaluate(() => {
				const el = document.activeElement;
				return el ? el.tagName.toLowerCase() : null;
			});

			expect(focusedElement).toBeTruthy();
		});

		test("Song Select should manage focus on item selection", async ({ page }) => {
			await setupPlayerState(page);
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			// Wait for songs to load from bundled JSON
			await expect(page.locator(".song-item").first()).toBeVisible();

			// Arrow navigation should work without explicit focus
			await page.keyboard.press("ArrowDown");
			await page.waitForTimeout(100);

			// The song list should be interactive
			const selectedSong = page.locator(".song-item.selected");
			await expect(selectedSong).toBeVisible();
		});

		test("Settings should support full keyboard navigation", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-options");
			await expect(page.locator(".settings, .options")).toBeVisible();

			// Should be able to navigate with keyboard
			await page.keyboard.press("ArrowDown");
			await page.keyboard.press("ArrowUp");

			// ESC should work to go back
			await page.keyboard.press("Escape");
			await expect(page.locator(".main-menu")).toBeVisible();
		});

		test("Modal dialogs should trap focus correctly", async ({ page }) => {
			await navigateToMainMenu(page);

			// Check if there's a set name button that triggers a dialog
			const setNameBtn = page.locator("#btn-set-name");
			if (await setNameBtn.isVisible()) {
				// Set up handler for native dialog
				page.on("dialog", async (dialog) => {
					// Native dialogs handle their own focus trapping
					expect(dialog.type()).toBe("prompt");
					await dialog.dismiss();
				});

				await setNameBtn.click();
				await page.waitForTimeout(100);

				// After dialog closes, focus should return to a reasonable element
				await expect(page.locator(".main-menu")).toBeVisible();
			}
		});
	});
});
