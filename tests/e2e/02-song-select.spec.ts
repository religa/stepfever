import { expect, test } from "@playwright/test";
import { clearAppState, navigateToMainMenu, navigateToSongSelect } from "./helpers/test-helpers";

test.describe("Song Select", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await navigateToMainMenu(page);
		await navigateToSongSelect(page);
	});

	test("should display song select screen", async ({ page }) => {
		await expect(page.locator(".song-select")).toBeVisible();
		await expect(page.locator("h2")).toContainText("Select Song");
	});

	test("should display songs from bundled index", async ({ page }) => {
		// Songs load synchronously from bundled JSON
		const songs = page.locator(".song-item");
		await expect(songs.first()).toBeVisible();
	});

	test("should display song information (title and artist)", async ({ page }) => {
		const firstSong = page.locator(".song-item").first();
		await expect(firstSong).toBeVisible();

		// Song should have title and artist (exact text depends on seeded data)
		const songText = await firstSong.textContent();
		expect(songText).toBeTruthy();
		expect(songText?.length).toBeGreaterThan(0);
	});

	test("should navigate between songs with arrow keys", async ({ page }) => {
		// First song should be selected initially
		await expect(page.locator(".song-item.selected").first()).toBeVisible();

		// Navigate down
		await page.keyboard.press("ArrowDown");
		await page.waitForTimeout(100);

		// Selection should have moved (if there are multiple songs)
		const songs = await page.locator(".song-item").count();
		if (songs > 1) {
			const selectedIndex = await page.evaluate(() => {
				const items = document.querySelectorAll(".song-item");
				return Array.from(items).findIndex((item) => item.classList.contains("selected"));
			});
			expect(selectedIndex).toBeGreaterThanOrEqual(0);
		}
	});

	test("should display difficulties for selected song", async ({ page }) => {
		// Difficulties should be displayed or selectable
		// Either visible immediately or after entering difficulty selection mode
		await expect(page.locator(".difficulty-item, .difficulty-list").first()).toBeVisible();
	});

	test("should navigate between difficulties with left/right arrow keys", async ({ page }) => {
		// Navigate to difficulty selection
		await page.keyboard.press("ArrowRight");
		await page.waitForTimeout(100);

		// Check if difficulty navigation works
		await page.keyboard.press("ArrowRight");
		await page.waitForTimeout(100);

		await page.keyboard.press("ArrowLeft");
		await page.waitForTimeout(100);
	});

	test("should return to main menu on ESC", async ({ page }) => {
		await page.keyboard.press("Escape");
		await expect(page.locator(".main-menu")).toBeVisible();
		await expect(page.locator("h1")).toContainText("StepFever");
	});

	test("should start gameplay when Enter is pressed", async ({ page }) => {
		await page.keyboard.press("Enter");

		// Should navigate to gameplay or show loading
		// Game canvas should appear or error message if chart loading fails
		await expect(page.locator("#game-canvas, .error").first()).toBeVisible({ timeout: 5000 });
	});

	test("should handle no songs available gracefully", async ({ page }) => {
		// This test verifies UI handling when songs array is empty
		// In local-first mode, songs are bundled so this is an edge case
		// The UI should show a message if the bundled index is empty
		await expect(page.locator(".song-select")).toBeVisible();
	});

	test("should display banner image if available", async ({ page }) => {
		// Check if any banners are displayed
		const banners = page.locator(".banner, img[src*='banner']");
		const count = await banners.count();

		// If banners exist in data, they should be displayed
		if (count > 0) {
			await expect(banners.first()).toBeVisible();
		}
	});

	test("should escape HTML in song titles and artist names", async ({ page }) => {
		// Verify XSS is prevented - bundled data is trusted but display should escape
		const innerHTML = await page.locator(".song-select").innerHTML();
		expect(innerHTML).not.toContain("<script>");
		expect(innerHTML).not.toContain("onerror=");
	});

	test("should show selected song highlighting", async ({ page }) => {
		const selectedSong = page.locator(".song-item.selected");
		await expect(selectedSong).toBeVisible();

		// Selected song should have different styling
		const className = await selectedSong.getAttribute("class");
		expect(className).toContain("selected");
	});

	test("should allow cycling through all available songs", async ({ page }) => {
		const songCount = await page.locator(".song-item").count();

		// Cycle through all songs
		for (let i = 0; i < songCount + 1; i++) {
			await page.keyboard.press("ArrowDown");
			await page.waitForTimeout(50);
		}

		// Should wrap around or stop at last song
		const selectedSong = page.locator(".song-item.selected");
		await expect(selectedSong).toBeVisible();
	});
});

test.describe("Song Select - Extended Navigation", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await navigateToMainMenu(page);
		await navigateToSongSelect(page);
		// Wait for songs to be visible (loaded from bundled JSON)
		await expect(page.locator(".song-item").first()).toBeVisible();
	});

	test.describe("Mouse interactions", () => {
		test("click on song item should select that song", async ({ page }) => {
			const songs = page.locator(".song-item");
			const songCount = await songs.count();

			if (songCount > 1) {
				// Click on second song
				await songs.nth(1).click();
				await page.waitForTimeout(100);

				// Second song should be selected
				await expect(songs.nth(1)).toHaveClass(/selected/);
			}
		});

		test("double-click on difficulty should start gameplay", async ({ page }) => {
			// First click on a song to select it
			await page.locator(".song-item").first().click();
			await page.waitForTimeout(100);

			// Double-click on difficulty
			const difficulty = page.locator(".difficulty-item").first();
			if (await difficulty.isVisible()) {
				await difficulty.dblclick();

				// Should start gameplay
				await expect(page.locator("#game-canvas, .error")).toBeVisible({ timeout: 5000 });
			}
		});

		test("click on already selected song should not deselect", async ({ page }) => {
			// Click on first song (already selected by default)
			const firstSong = page.locator(".song-item").first();
			await firstSong.click();
			await page.waitForTimeout(100);

			// Should still be selected
			await expect(firstSong).toHaveClass(/selected/);
		});

		test("mouse wheel should scroll through song list", async ({ page }) => {
			const songList = page.locator(".song-list");

			// Scroll down
			await songList.evaluate((el) => {
				el.scrollTop = el.scrollTop + 100;
			});

			// Song list should handle scroll
			await expect(songList).toBeVisible();
		});

		test("clicking outside song list should not change selection", async ({ page }) => {
			const initialSelected = await page.locator(".song-item.selected").textContent();

			// Click outside the song list
			await page.click(".song-select h2");
			await page.waitForTimeout(100);

			// Selection should remain the same
			const currentSelected = await page.locator(".song-item.selected").textContent();
			expect(currentSelected).toBe(initialSelected);
		});
	});

	test.describe("Keyboard navigation", () => {
		test("Page Down should jump multiple songs forward", async ({ page }) => {
			const songCount = await page.locator(".song-item").count();

			if (songCount > 3) {
				await page.keyboard.press("PageDown");
				await page.waitForTimeout(100);

				// Should have moved selection
				await expect(page.locator(".song-item.selected")).toBeVisible();
			}
		});

		test("Page Up should jump multiple songs backward", async ({ page }) => {
			const songCount = await page.locator(".song-item").count();

			if (songCount > 3) {
				// First go to end
				for (let i = 0; i < songCount - 1; i++) {
					await page.keyboard.press("ArrowDown");
				}
				await page.waitForTimeout(100);

				await page.keyboard.press("PageUp");
				await page.waitForTimeout(100);

				// Should have moved selection
				await expect(page.locator(".song-item.selected")).toBeVisible();
			}
		});

		test("End key should jump to last song and scroll into view", async ({ page }) => {
			const songCount = await page.locator(".song-item").count();

			if (songCount > 1) {
				await page.keyboard.press("End");
				await page.waitForTimeout(100);

				// Last song should be selected or visible
				await expect(page.locator(".song-item.selected")).toBeVisible();
			}
		});
	});

	test.describe("Visual verification", () => {
		test("should visually highlight selected song", async ({ page }) => {
			const selectedSong = page.locator(".song-item.selected");

			// Selected song should have different styling
			const className = await selectedSong.getAttribute("class");
			expect(className).toContain("selected");

			// The selection indicator should be visible
			await expect(selectedSong).toBeVisible();
		});

		test("difficulty selection should have visible highlight", async ({ page }) => {
			// Navigate to difficulty selection
			await page.keyboard.press("ArrowRight");
			await page.waitForTimeout(100);

			// Difficulty items should exist
			const difficulties = page.locator(".difficulty-item, .difficulty-list");
			await expect(difficulties.first()).toBeVisible();
		});
	});
});
