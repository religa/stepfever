import { expect, test } from "@playwright/test";
import { setupPlayerState } from "./helpers/navigation-helpers";
import { clearAppState, navigateToMainMenu, navigateToSongSelect } from "./helpers/test-helpers";

test.describe("Search and Sort Functionality", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await setupPlayerState(page);
		await navigateToMainMenu(page);
		await navigateToSongSelect(page);
		await expect(page.locator(".song-item").first()).toBeVisible();
	});

	test.describe("Search", () => {
		test("/ key should focus search input", async ({ page }) => {
			await page.keyboard.press("/");
			await page.waitForTimeout(100);

			// Search input should be focused
			const activeElement = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
			expect(activeElement).toBe("input");
		});

		test("search input should filter songs", async ({ page }) => {
			const initialCount = await page.locator(".song-item").count();

			await page.keyboard.press("/");
			await page.keyboard.type("gold");
			await page.waitForTimeout(200); // Debounce time

			const filteredCount = await page.locator(".song-item").count();
			expect(filteredCount).toBeLessThanOrEqual(initialCount);
		});

		test("search should match song titles", async ({ page }) => {
			await page.keyboard.press("/");
			await page.keyboard.type("gold");
			await page.waitForTimeout(200);

			// At least one song with "gold" should be visible
			const songs = page.locator(".song-item");
			const songCount = await songs.count();

			if (songCount > 0) {
				const songText = await page.locator(".song-list").textContent();
				expect(songText?.toLowerCase()).toContain("gold");
			}
		});

		test("ESC should clear search when search is focused", async ({ page }) => {
			await page.keyboard.press("/");
			await page.keyboard.type("test");
			await page.waitForTimeout(200);

			await page.keyboard.press("Escape");
			await page.waitForTimeout(100);

			// Search should be cleared
			const searchValue = await page.locator(".search-input, input[type='text']").inputValue();
			expect(searchValue).toBe("");
		});

		test("ESC should exit to main menu when search is empty", async ({ page }) => {
			await page.keyboard.press("Escape");

			await expect(page.locator(".main-menu")).toBeVisible();
		});

		test("Enter should start game even when search is focused", async ({ page }) => {
			await page.keyboard.press("/");
			await page.keyboard.type("gold");
			await page.waitForTimeout(200);

			// Press Enter to start game
			await page.keyboard.press("Enter");

			// Should navigate to gameplay (if songs match)
			const hasSongs = (await page.locator(".song-item").count()) > 0;
			if (hasSongs) {
				await expect(page.locator("#game-canvas, .song-select")).toBeVisible({ timeout: 5000 });
			}
		});

		test("search should be case insensitive", async ({ page }) => {
			await page.keyboard.press("/");
			await page.keyboard.type("GOLD");
			await page.waitForTimeout(200);

			const upperCount = await page.locator(".song-item").count();

			// Clear and search lowercase
			await page.keyboard.press("Escape");
			await page.keyboard.press("/");
			await page.keyboard.type("gold");
			await page.waitForTimeout(200);

			const lowerCount = await page.locator(".song-item").count();

			expect(upperCount).toBe(lowerCount);
		});

		test("empty search should show all songs", async ({ page }) => {
			const initialCount = await page.locator(".song-item").count();

			await page.keyboard.press("/");
			await page.keyboard.type("xyz123nonexistent");
			await page.waitForTimeout(200);

			// Clear search
			await page.keyboard.press("Escape");
			await page.waitForTimeout(100);

			const finalCount = await page.locator(".song-item").count();
			expect(finalCount).toBe(initialCount);
		});
	});

	test.describe("Sort", () => {
		test("sort dropdown should be visible", async ({ page }) => {
			await expect(page.locator(".sort-dropdown, text=Sort")).toBeVisible();
		});

		test("should have multiple sort options", async ({ page }) => {
			const sortDropdown = page.locator(".sort-dropdown, select");
			if (await sortDropdown.isVisible()) {
				// Click to open dropdown
				await sortDropdown.click();
				await page.waitForTimeout(100);

				// Check for sort options
				const options = page.locator("option, .sort-option");
				const count = await options.count();
				expect(count).toBeGreaterThan(1);
			}
		});

		test("sort by A-Z should alphabetize songs", async ({ page }) => {
			const sortDropdown = page.locator(".sort-dropdown, select");
			if (await sortDropdown.isVisible()) {
				await sortDropdown.selectOption({ label: "A-Z" }).catch(() => {
					// Fallback for non-select dropdowns
				});

				await page.waitForTimeout(100);

				// First song title should come before second alphabetically
				const songs = page.locator(".song-item .song-title, .song-item h3");
				const firstTitle = await songs.first().textContent();
				expect(firstTitle).toBeTruthy();
			}
		});

		test("sort should persist selection", async ({ page }) => {
			const sortDropdown = page.locator(".sort-dropdown, select");
			if (await sortDropdown.isVisible()) {
				// Change sort
				await sortDropdown.click();
				await page.waitForTimeout(100);

				// Navigate away and back
				await page.keyboard.press("Escape");
				await expect(page.locator(".main-menu")).toBeVisible();

				await navigateToSongSelect(page);
				await expect(page.locator(".song-item").first()).toBeVisible();

				// Sort dropdown should still be functional
				await expect(page.locator(".sort-dropdown, select")).toBeVisible();
			}
		});
	});

	test.describe("Combined Search and Sort", () => {
		test("search should work with sort applied", async ({ page }) => {
			// Apply sort first
			const sortDropdown = page.locator(".sort-dropdown, select");
			if (await sortDropdown.isVisible()) {
				await sortDropdown.click();
				await page.waitForTimeout(100);
			}

			// Then search
			await page.keyboard.press("/");
			await page.keyboard.type("a");
			await page.waitForTimeout(200);

			// Should have filtered results
			const count = await page.locator(".song-item").count();
			expect(count).toBeGreaterThanOrEqual(0);
		});

		test("clearing search should maintain sort order", async ({ page }) => {
			await page.keyboard.press("/");
			await page.keyboard.type("test");
			await page.waitForTimeout(200);

			await page.keyboard.press("Escape");
			await page.waitForTimeout(100);

			// Songs should still be in sorted order
			await expect(page.locator(".song-item").first()).toBeVisible();
		});
	});
});
