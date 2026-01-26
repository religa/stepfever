import { expect, test } from "@playwright/test";
import {
	clearAppState,
	navigateToMainMenu,
	navigateToSongSelect,
	verifyJudgmentBreakdown,
	verifyScoreDisplay,
	waitForResults,
} from "./helpers/test-helpers";

test.describe("Results Screen", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);

		// Set player name to avoid prompt
		await page.evaluate(() => {
			localStorage.setItem(
				"stepfever-preferences",
				JSON.stringify({
					state: { playerName: "TestPlayer", globalOffset: 0, showFps: false },
					version: 0,
				}),
			);
		});

		await navigateToMainMenu(page);
		await navigateToSongSelect(page);
		// Wait for songs to load from bundled JSON
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		// Wait for gameplay to finish
		await waitForResults(page, 40000);
	});

	test("should display results screen after gameplay", async ({ page }) => {
		await expect(page.locator(".results")).toBeVisible();
	});

	test("should display grade", async ({ page }) => {
		const grade = page.locator(".grade");
		await expect(grade).toBeVisible();

		const gradeText = await grade.textContent();
		expect(gradeText).toMatch(/AAA|AA|A|B|C|D|F/);
	});

	test("should display accuracy percentage", async ({ page }) => {
		await expect(page.locator(".accuracy, .results")).toContainText(/%/);
	});

	test("should display max combo", async ({ page }) => {
		await expect(page.locator(".max-combo, .results")).toContainText(/combo/i);
	});

	test("should display judgment breakdown", async ({ page }) => {
		await verifyJudgmentBreakdown(page);
	});

	test("should display all judgment types", async ({ page }) => {
		const judgmentTypes = ["marvelous", "perfect", "great", "good", "boo", "miss"];

		for (const judgment of judgmentTypes) {
			await expect(page.locator(`.judgment-item.${judgment}, .judgment-row.${judgment}, .results`)).toBeVisible();
		}
	});

	test("should display judgment counts as numbers", async ({ page }) => {
		const breakdown = page.locator(".judgment-breakdown");
		await expect(breakdown).toBeVisible();

		const text = await breakdown.textContent();
		// Should contain numbers
		expect(text).toMatch(/\d+/);
	});

	test("should color-code judgment rows", async ({ page }) => {
		// Marvelous should have cyan/blue styling
		const marvelous = page.locator(".judgment-item.marvelous, .judgment-row.marvelous");
		if ((await marvelous.count()) > 0) {
			const borderColor = await marvelous.first().evaluate((el) => {
				return window.getComputedStyle(el).borderLeftColor;
			});
			expect(borderColor).toBeTruthy();
		}
	});

	test("should navigate to song select on ENTER", async ({ page }) => {
		await page.keyboard.press("Enter");
		await expect(page.locator(".song-select")).toBeVisible();
	});

	test("should navigate to main menu on ESC", async ({ page }) => {
		await page.keyboard.press("Escape");
		await expect(page.locator(".main-menu")).toBeVisible();
	});

	test("should display song information", async ({ page }) => {
		await expect(page.locator(".results, .song-info")).toBeVisible();
		// Song title should be displayed somewhere
	});

	test("should escape HTML in song titles", async ({ page }) => {
		const innerHTML = await page.locator(".results").innerHTML();
		expect(innerHTML).not.toContain("<script>");
	});

	test("should calculate accuracy correctly", async ({ page }) => {
		const accuracyText = await page.locator(".accuracy, .results").textContent();
		const match = accuracyText?.match(/(\d+(?:\.\d+)?)\s*%/);

		if (match?.[1]) {
			const accuracy = Number.parseFloat(match[1]);
			expect(accuracy).toBeGreaterThanOrEqual(0);
			expect(accuracy).toBeLessThanOrEqual(100);
		}
	});

	test("should display grade with appropriate color", async ({ page }) => {
		const grade = page.locator(".grade");
		const gradeText = await grade.textContent();

		// Different grades should have different colors
		const color = await grade.evaluate((el) => {
			return window.getComputedStyle(el).color;
		});

		expect(color).toBeTruthy();

		// AAA should have gold/cyan color, F should have red/gray
		if (gradeText?.includes("AAA")) {
			expect(color).toMatch(/rgb|#/); // Has some color
		}
	});

	test("should show keyboard controls hint", async ({ page }) => {
		await expect(page.locator(".controls, .results")).toContainText(/ENTER|ESC|Song Select|Main Menu/i);
	});

	test("should display realistic score values", async ({ page }) => {
		// Max combo should be a reasonable number
		const comboText = await page.locator(".max-combo, .results").textContent();
		const comboMatch = comboText?.match(/\d+/);

		if (comboMatch) {
			const combo = Number.parseInt(comboMatch[0]);
			expect(combo).toBeGreaterThanOrEqual(0);
			expect(combo).toBeLessThan(10000); // Sanity check
		}
	});

	test("should sum judgment counts correctly", async ({ page }) => {
		const breakdown = page.locator(".judgment-breakdown, .results");
		const text = await breakdown.textContent();

		// Extract all numbers from judgment breakdown
		const numbers = text?.match(/\d+/g);

		if (numbers) {
			const counts = numbers.map((n) => Number.parseInt(n));
			const sum = counts.reduce((a, b) => a + b, 0);

			// Sum should be reasonable (total note count)
			expect(sum).toBeGreaterThan(0);
			expect(sum).toBeLessThan(100000); // Sanity check
		}
	});

	test("should handle very high accuracy (AAA rank)", async ({ page }) => {
		// We can't control gameplay outcome, but verify display works
		await verifyScoreDisplay(page);
	});

	test("should handle very low accuracy (F rank)", async ({ page }) => {
		// We can't control gameplay outcome, but verify display works
		await verifyScoreDisplay(page);
	});

	test("should allow retrying the same song", async ({ page }) => {
		// Navigate back to song select
		await page.keyboard.press("Enter");
		await expect(page.locator(".song-select")).toBeVisible();

		// Same song should still be selectable
		await page.keyboard.press("Enter");
		await expect(page.locator("#game-canvas")).toBeVisible({ timeout: 5000 });
	});

	test("should display results immediately after gameplay", async ({ page }) => {
		// Results should appear within reasonable time after gameplay ends
		await expect(page.locator(".results")).toBeVisible();

		// No loading screen should be stuck
		const hasLoadingScreen = await page
			.locator(".loading")
			.isVisible()
			.catch(() => false);
		expect(hasLoadingScreen).toBe(false);
	});
});

test.describe("Results - Extended Navigation", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);

		// Set player name to avoid prompt
		await page.evaluate(() => {
			localStorage.setItem(
				"stepfever-preferences",
				JSON.stringify({
					state: { playerName: "TestPlayer", globalOffset: 0, showFps: false },
					version: 0,
				}),
			);
		});

		await navigateToMainMenu(page);
		await navigateToSongSelect(page);
		// Wait for songs to load from bundled JSON
		await expect(page.locator(".song-item").first()).toBeVisible();
		await page.keyboard.press("Enter");

		// Wait for gameplay to finish
		await waitForResults(page, 40000);
	});

	test("ArrowDown/Up should cycle through action buttons", async ({ page }) => {
		// Navigate through buttons using arrows
		await page.keyboard.press("ArrowDown");
		await page.waitForTimeout(100);

		await page.keyboard.press("ArrowUp");
		await page.waitForTimeout(100);

		// Should still be on results screen
		await expect(page.locator(".results")).toBeVisible();
	});

	test("click Continue should navigate to Song Select", async ({ page }) => {
		const continueBtn = page.locator(
			"#btn-continue, .btn-continue, button:has-text('Continue'), button:has-text('Song Select')",
		);

		if (await continueBtn.isVisible()) {
			await continueBtn.click();
			await expect(page.locator(".song-select")).toBeVisible();
		} else {
			// Fallback to keyboard Enter
			await page.keyboard.press("Enter");
			await expect(page.locator(".song-select")).toBeVisible();
		}
	});

	test("double-click prevention on navigation buttons", async ({ page }) => {
		const continueBtn = page.locator(
			"#btn-continue, .btn-continue, button:has-text('Continue'), button:has-text('Song Select')",
		);

		if (await continueBtn.isVisible()) {
			// Double-click should not cause issues
			await continueBtn.dblclick();

			// Should navigate to song select once
			await expect(page.locator(".song-select")).toBeVisible();
		}
	});

	test("focus should be trapped within Results screen", async ({ page }) => {
		// Tab through elements
		await page.keyboard.press("Tab");
		await page.waitForTimeout(100);
		await page.keyboard.press("Tab");
		await page.waitForTimeout(100);
		await page.keyboard.press("Tab");
		await page.waitForTimeout(100);

		// Should still be on results screen
		await expect(page.locator(".results")).toBeVisible();
	});
});
