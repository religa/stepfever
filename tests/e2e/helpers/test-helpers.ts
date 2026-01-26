import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Common test helpers for StepFever E2E tests
 */

/**
 * Navigate to main menu and verify it loaded
 */
export async function navigateToMainMenu(page: Page): Promise<void> {
	await page.goto("/");
	await expect(page.locator("h1")).toContainText("StepFever");
}

/**
 * Set player name via the main menu
 */
export async function setPlayerName(page: Page, name: string): Promise<void> {
	const setNameBtn = page.locator("#btn-set-name, #btn-change-name").first();
	if (await setNameBtn.isVisible()) {
		// Set up dialog handler BEFORE clicking
		page.once("dialog", async (dialog) => {
			await dialog.accept(name);
		});
		await setNameBtn.click();
		// Wait for the dialog to be handled
		await page.waitForTimeout(100);
	}
}

/**
 * Navigate to song select screen
 */
export async function navigateToSongSelect(page: Page): Promise<void> {
	await page.click("#btn-play");
	await page.waitForSelector(".song-select, .song-list");
}

/**
 * Navigate to calibration screen
 */
export async function navigateToCalibration(page: Page): Promise<void> {
	await page.click("#btn-calibration");
	await page.waitForSelector(".calibration");
}

/**
 * Select a song by index
 */
export async function selectSong(page: Page, index = 0): Promise<void> {
	// Navigate to the correct song index
	for (let i = 0; i < index; i++) {
		await page.keyboard.press("ArrowDown");
		await page.waitForTimeout(50);
	}
}

/**
 * Select a difficulty by index
 */
export async function selectDifficulty(page: Page, index = 0): Promise<void> {
	// Navigate to the correct difficulty index
	for (let i = 0; i < index; i++) {
		await page.keyboard.press("ArrowRight");
		await page.waitForTimeout(50);
	}
}

/**
 * Start gameplay
 */
export async function startGameplay(page: Page): Promise<void> {
	await page.keyboard.press("Enter");
	await page.waitForSelector("#game-canvas", { timeout: 5000 });
}

/**
 * Wait for results screen to appear
 */
export async function waitForResults(page: Page, timeout = 30000): Promise<void> {
	await page.waitForSelector(".results, .grade", { timeout });
}

/**
 * Clear localStorage (reset app state)
 */
export async function clearAppState(page: Page): Promise<void> {
	// Navigate to the app first if not already there to ensure localStorage is available
	if (page.url() === "about:blank" || !page.url().includes("localhost")) {
		await page.goto("/");
	}
	await page.evaluate(() => {
		localStorage.clear();
	});
}

/**
 * Get localStorage value
 */
export async function getLocalStorageItem(page: Page, key: string): Promise<string | null> {
	return await page.evaluate((k) => localStorage.getItem(k), key);
}

/**
 * Set localStorage value
 */
export async function setLocalStorageItem(page: Page, key: string, value: string): Promise<void> {
	await page.evaluate(({ k, v }) => localStorage.setItem(k, v), { k: key, v: value });
}

/**
 * Press key multiple times
 */
export async function pressKeyMultipleTimes(page: Page, key: string, times: number, delay = 50): Promise<void> {
	for (let i = 0; i < times; i++) {
		await page.keyboard.press(key);
		await page.waitForTimeout(delay);
	}
}

/**
 * Verify judgment breakdown is visible with expected structure
 */
export async function verifyJudgmentBreakdown(page: Page): Promise<void> {
	const breakdown = page.locator(".judgment-breakdown");
	await expect(breakdown).toBeVisible();

	// Check for all judgment types
	const judgments = ["marvelous", "perfect", "great", "good", "boo", "miss"];
	for (const judgment of judgments) {
		await expect(breakdown.locator(`.judgment-item.${judgment}, .judgment-row.${judgment}`)).toBeVisible();
	}
}

/**
 * Verify score display
 */
export async function verifyScoreDisplay(page: Page): Promise<void> {
	await expect(page.locator(".grade")).toBeVisible();
	await expect(page.locator(".accuracy, .max-combo")).toBeVisible();
}

/**
 * Take a screenshot with a meaningful name
 */
export async function takeScreenshot(page: Page, name: string): Promise<void> {
	await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
}
