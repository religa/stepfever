import type { Locator, Page } from "@playwright/test";
import { expect } from "@playwright/test";

/**
 * Navigation-specific test helpers for StepFever E2E tests
 */

/**
 * Click menu item by accessible name (preferred over ID)
 */
export async function clickMenuButton(page: Page, name: string): Promise<void> {
	await page.getByRole("button", { name }).click();
}

/**
 * Navigate to specific item using arrow keys
 */
export async function navigateWithArrows(
	page: Page,
	direction: "up" | "down" | "left" | "right",
	count: number,
): Promise<void> {
	const key = `Arrow${direction.charAt(0).toUpperCase() + direction.slice(1)}`;
	for (let i = 0; i < count; i++) {
		await page.keyboard.press(key);
	}
}

/**
 * Verify element is in viewport (for scroll testing)
 */
export async function expectInViewport(locator: Locator): Promise<void> {
	await expect(locator).toBeInViewport();
}

/**
 * Verify keyboard focus is on element
 */
export async function expectFocused(locator: Locator): Promise<void> {
	await expect(locator).toBeFocused();
}

/**
 * Wait for URL to match pattern (better than waitForTimeout)
 */
export async function waitForRoute(page: Page, pattern: RegExp): Promise<void> {
	await page.waitForURL(pattern);
}

/**
 * Verify no accessibility violations on current page
 */
export async function expectNoA11yViolations(page: Page): Promise<void> {
	const AxeBuilder = (await import("@axe-core/playwright")).default;
	const results = await new AxeBuilder({ page }).analyze();
	expect(results.violations).toEqual([]);
}

/**
 * Navigate to multiplayer setup
 */
export async function navigateToMultiplayerSetup(page: Page): Promise<void> {
	await page.click("#btn-multiplayer");
	await page.waitForSelector(".player-setup, .multiplayer-setup");
}

/**
 * Navigate to settings screen
 */
export async function navigateToSettings(page: Page): Promise<void> {
	await page.click("#btn-options");
	await page.waitForSelector(".settings, .options");
}

/**
 * Get current URL path without query params
 */
export async function getCurrentPath(page: Page): Promise<string> {
	const url = new URL(page.url());
	return url.pathname;
}

/**
 * Set up player state to avoid name prompts
 */
export async function setupPlayerState(page: Page, playerName = "TestPlayer"): Promise<void> {
	await page.evaluate((name) => {
		localStorage.setItem(
			"stepfever-preferences",
			JSON.stringify({
				state: { playerName: name, globalOffset: 0, showFps: false },
				version: 0,
			}),
		);
	}, playerName);
}

/**
 * Navigate directly to a URL and wait for page load
 */
export async function navigateToUrl(page: Page, path: string): Promise<void> {
	await page.goto(path);
	await page.waitForLoadState("networkidle");
}

/**
 * Wait for screen transition to complete
 */
export async function waitForScreenTransition(page: Page, screenSelector: string): Promise<void> {
	await page.waitForSelector(screenSelector, { state: "visible" });
}

/**
 * Perform browser back navigation
 */
export async function goBack(page: Page): Promise<void> {
	await page.goBack();
}

/**
 * Perform browser forward navigation
 */
export async function goForward(page: Page): Promise<void> {
	await page.goForward();
}
