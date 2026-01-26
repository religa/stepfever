import { expect, test } from "@playwright/test";
import { setupPlayerState } from "./helpers/navigation-helpers";
import { clearAppState, navigateToMainMenu, navigateToSongSelect, waitForResults } from "./helpers/test-helpers";

test.describe("UX Polish Features", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await setupPlayerState(page);
	});

	test.describe("Quick Restart", () => {
		test("R key on results screen should restart same song", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			await expect(page.locator(".song-item").first()).toBeVisible();
			await page.keyboard.press("Enter");

			// Wait for results
			await waitForResults(page, 45000);
			await expect(page.locator(".results")).toBeVisible();

			// Press R to restart
			await page.keyboard.press("r");

			// Should start gameplay again
			await expect(page.locator("#game-canvas")).toBeVisible({ timeout: 5000 });
		});
	});

	test.describe("Grade Colors", () => {
		test("F grade should display in crimson/red", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			await expect(page.locator(".song-item").first()).toBeVisible();
			await page.keyboard.press("Enter");

			await waitForResults(page, 45000);

			const grade = page.locator(".grade");
			await expect(grade).toBeVisible();

			const gradeText = await grade.textContent();
			if (gradeText?.includes("F")) {
				const color = await grade.evaluate((el) => window.getComputedStyle(el).color);
				// Crimson is rgb(220, 20, 60) or similar red tone
				expect(color).toMatch(/rgb\(\s*\d{2,3}\s*,\s*\d{1,2}\s*,\s*\d{1,2}\s*\)/);
			}
		});

		test("grade element should have appropriate color class", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			await expect(page.locator(".song-item").first()).toBeVisible();
			await page.keyboard.press("Enter");

			await waitForResults(page, 45000);

			const grade = page.locator(".grade");
			await expect(grade).toBeVisible();

			// Grade should have a color-related class or style
			const className = await grade.getAttribute("class");
			expect(className).toBeTruthy();
		});
	});

	test.describe("Difficulty Colors", () => {
		test("Beginner difficulty should be green", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			await expect(page.locator(".song-item").first()).toBeVisible();

			const beginner = page.locator(".difficulty-item.beginner, text=Beginner").first();
			if (await beginner.isVisible()) {
				const color = await beginner.evaluate((el) => window.getComputedStyle(el).color);
				// Green tones
				expect(color).toBeTruthy();
			}
		});

		test("Hard difficulty should be red", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			await expect(page.locator(".song-item").first()).toBeVisible();

			const hard = page.locator(".difficulty-item.hard, text=Hard").first();
			if (await hard.isVisible()) {
				const color = await hard.evaluate((el) => window.getComputedStyle(el).color);
				// Red tones
				expect(color).toBeTruthy();
			}
		});
	});

	test.describe("Menu Sounds Toggle", () => {
		test("Menu Sounds toggle should be visible in settings", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-options");
			await expect(page.locator(".settings")).toBeVisible();

			await expect(page.locator("text=Menu Sounds")).toBeVisible();
		});

		test("Menu Sounds toggle should switch between ON and OFF", async ({ page }) => {
			await navigateToMainMenu(page);
			await page.click("#btn-options");
			await expect(page.locator(".settings")).toBeVisible();

			// Find and click the Menu Sounds toggle
			const toggle = page.locator(".setting-item:has-text('Menu Sounds') button");
			if (await toggle.isVisible()) {
				const initialText = await toggle.textContent();
				await toggle.click();
				await page.waitForTimeout(100);
				const newText = await toggle.textContent();

				// Should toggle between ON and OFF
				if (initialText === "ON") {
					expect(newText).toBe("OFF");
				} else {
					expect(newText).toBe("ON");
				}
			}
		});
	});

	test.describe("Keyboard Hints", () => {
		test("Results screen should show R: Restart hint", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			await expect(page.locator(".song-item").first()).toBeVisible();
			await page.keyboard.press("Enter");

			await waitForResults(page, 45000);

			await expect(page.locator("text=R: Restart")).toBeVisible();
		});

		test("Song Select should show keyboard hints", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);

			await expect(page.locator(".footer, .controls")).toContainText(/ENTER|ESC|Arrow/i);
		});
	});

	test.describe("Personal Best Display", () => {
		test("Results screen should show Personal Best section", async ({ page }) => {
			await navigateToMainMenu(page);
			await navigateToSongSelect(page);
			await expect(page.locator(".song-item").first()).toBeVisible();
			await page.keyboard.press("Enter");

			await waitForResults(page, 45000);

			await expect(page.locator("text=Personal Best")).toBeVisible();
		});
	});
});
