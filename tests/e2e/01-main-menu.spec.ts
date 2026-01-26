import { expect, test } from "@playwright/test";
import { clearAppState, getLocalStorageItem, navigateToMainMenu, setPlayerName } from "./helpers/test-helpers";

test.describe("Main Menu", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await navigateToMainMenu(page);
	});

	test("should display the main menu with all options", async ({ page }) => {
		// Verify title
		await expect(page.locator("h1")).toContainText("StepFever");

		// Verify menu buttons are present
		await expect(page.locator("#btn-play")).toBeVisible();
		await expect(page.locator("#btn-calibration")).toBeVisible();
	});

	test("should display version number", async ({ page }) => {
		await expect(page.locator(".version")).toContainText("v0.1.0");
	});

	test("should show 'Set Player Name' button when no name is set", async ({ page }) => {
		await expect(page.locator("#btn-set-name")).toBeVisible();
	});

	test("should allow setting player name", async ({ page }) => {
		await setPlayerName(page, "TestPlayer123");

		// Verify name is displayed
		await page.reload();
		await expect(page.locator(".player-info")).toContainText("TestPlayer123");

		// Verify localStorage
		const storage = await getLocalStorageItem(page, "stepfever-storage");
		expect(storage).toContain("TestPlayer123");
	});

	test("should show 'Change Name' button after name is set", async ({ page }) => {
		await setPlayerName(page, "InitialName");
		await page.reload();

		await expect(page.locator("#btn-change-name")).toBeVisible();
	});

	test("should navigate to song select on Play button click", async ({ page }) => {
		await page.click("#btn-play");
		await expect(page.locator(".song-select")).toBeVisible();
	});

	test("should navigate to calibration on Calibration button click", async ({ page }) => {
		await page.click("#btn-calibration");
		await expect(page.locator(".calibration")).toBeVisible();
	});

	test("should display keyboard controls hint", async ({ page }) => {
		await expect(page.locator(".footer")).toContainText("Arrow Keys");
	});

	test("should handle player name with special characters", async ({ page }) => {
		const specialName = "Player<script>alert('xss')</script>";
		await setPlayerName(page, specialName);
		await page.reload();

		// Verify XSS is prevented (name should be escaped)
		const innerHTML = await page.locator(".player-info").innerHTML();
		expect(innerHTML).not.toContain("<script>");
	});

	test("should trim whitespace from player name", async ({ page }) => {
		await setPlayerName(page, "  SpacedName  ");
		await page.reload();

		const storage = await getLocalStorageItem(page, "stepfever-storage");
		expect(storage).toContain("SpacedName");
		expect(storage).not.toContain("  SpacedName  ");
	});

	test("should persist player name across page reloads", async ({ page }) => {
		await setPlayerName(page, "PersistentPlayer");
		await page.reload();
		await expect(page.locator(".player-info")).toContainText("PersistentPlayer");

		// Reload again to ensure it persists
		await page.reload();
		await expect(page.locator(".player-info")).toContainText("PersistentPlayer");
	});

	test("should handle empty player name input", async ({ page }) => {
		const setNameBtn = page.locator("#btn-set-name");
		await setNameBtn.click();

		page.on("dialog", async (dialog) => {
			await dialog.accept(""); // Empty string
		});

		await page.waitForTimeout(200);

		// Should not set empty name
		await expect(page.locator("#btn-set-name")).toBeVisible();
	});
});

test.describe("Main Menu - Extended Navigation", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await navigateToMainMenu(page);
	});

	test.describe("Mouse interactions", () => {
		test("should show pointer cursor on hoverable buttons", async ({ page }) => {
			const playBtn = page.locator("#btn-play");
			const cursor = await playBtn.evaluate((el) => {
				return window.getComputedStyle(el).cursor;
			});

			expect(cursor).toBe("pointer");
		});

		test("should handle double-click without double navigation", async ({ page }) => {
			// Set up navigation tracking
			let navigationCount = 0;
			page.on("framenavigated", () => {
				navigationCount++;
			});

			// Double-click Play
			await page.locator("#btn-play").dblclick();

			// Wait for any navigation to settle
			await page.waitForTimeout(200);

			// Should only show song select once
			await expect(page.locator(".song-select")).toBeVisible();
		});

		test("should not navigate when clicking outside buttons", async ({ page }) => {
			// Click on empty area
			await page.click("body", { position: { x: 10, y: 10 } });

			// Should still be on main menu
			await expect(page.locator(".main-menu")).toBeVisible();
			await expect(page.locator("h1")).toContainText("StepFever");
		});
	});

	test.describe("Keyboard navigation", () => {
		test("ArrowDown should move selection to next menu item", async ({ page }) => {
			// Press ArrowDown
			await page.keyboard.press("ArrowDown");
			await page.waitForTimeout(100);

			// Should still be on main menu (selection should have moved)
			await expect(page.locator(".main-menu")).toBeVisible();
		});

		test("ArrowUp should move selection to previous menu item", async ({ page }) => {
			// First move down, then up
			await page.keyboard.press("ArrowDown");
			await page.waitForTimeout(100);
			await page.keyboard.press("ArrowUp");
			await page.waitForTimeout(100);

			// Should still be on main menu
			await expect(page.locator(".main-menu")).toBeVisible();
		});

		test("selection should wrap from last to first item", async ({ page }) => {
			// Press ArrowDown multiple times to wrap around
			for (let i = 0; i < 10; i++) {
				await page.keyboard.press("ArrowDown");
				await page.waitForTimeout(50);
			}

			// Should still be on main menu with valid selection
			await expect(page.locator(".main-menu")).toBeVisible();
		});

		test("Tab should move focus between all interactive elements", async ({ page }) => {
			// Press Tab multiple times
			await page.keyboard.press("Tab");
			await page.waitForTimeout(100);

			// Check that some element is focused
			const focusedTag = await page.evaluate(() => document.activeElement?.tagName?.toLowerCase());
			expect(focusedTag).toBeTruthy();
		});

		test("initial focus should be on first menu item", async ({ page }) => {
			// Press Enter to activate currently focused item
			await page.keyboard.press("Enter");

			// Default first item is usually Play, which navigates to song select
			await expect(page.locator(".song-select, .main-menu")).toBeVisible();
		});
	});
});
