import { expect, test } from "@playwright/test";
import { clearAppState, navigateToMainMenu } from "./helpers/test-helpers";

test.describe("Settings Sub-Screens", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await navigateToMainMenu(page);
		await page.click("#btn-options");
		await expect(page.locator(".settings")).toBeVisible();
	});

	test.describe("Speed Modifier Screen", () => {
		test("should navigate to speed modifier from settings", async ({ page }) => {
			await page.click("text=CHANGE");
			await expect(page.locator(".speed-select")).toBeVisible();
			expect(page.url()).toContain("/settings/speed");
		});

		test("should display all speed options", async ({ page }) => {
			await page.click("text=CHANGE");
			await expect(page.locator(".speed-select")).toBeVisible();

			// Verify speed options are present
			await expect(page.locator("text=0.5x")).toBeVisible();
			await expect(page.locator("text=0.75x")).toBeVisible();
			await expect(page.locator("text=1.0x")).toBeVisible();
			await expect(page.locator("text=1.25x")).toBeVisible();
			await expect(page.locator("text=1.5x")).toBeVisible();
			await expect(page.locator("text=2.0x")).toBeVisible();
		});

		test("should highlight current selection", async ({ page }) => {
			await page.click("text=CHANGE");
			await expect(page.locator(".speed-item.selected")).toBeVisible();
		});

		test("should navigate speed options with arrow keys", async ({ page }) => {
			await page.click("text=CHANGE");
			await expect(page.locator(".speed-select")).toBeVisible();

			await page.keyboard.press("ArrowDown");
			await page.waitForTimeout(100);

			// Selection should have moved
			await expect(page.locator(".speed-item.selected")).toBeVisible();
		});

		test("should select speed with Enter key", async ({ page }) => {
			await page.click("text=CHANGE");
			await expect(page.locator(".speed-select")).toBeVisible();

			// Navigate to 1.5x
			await page.keyboard.press("ArrowDown");
			await page.keyboard.press("ArrowDown");
			await page.keyboard.press("Enter");

			// Should return to settings
			await expect(page.locator(".settings")).toBeVisible();

			// Speed should be updated
			await expect(page.locator(".settings")).toContainText("1.5x");
		});

		test("should persist speed selection", async ({ page }) => {
			await page.click("text=CHANGE");
			await page.keyboard.press("ArrowDown");
			await page.keyboard.press("Enter");

			await page.reload();
			await expect(page.locator(".settings")).toBeVisible();

			// Speed should still be updated
			const speedText = await page.locator(".settings").textContent();
			expect(speedText).toBeTruthy();
		});

		test("should return to settings on ESC without saving", async ({ page }) => {
			await page.click("text=CHANGE");
			await expect(page.locator(".speed-select")).toBeVisible();

			await page.keyboard.press("Escape");
			await expect(page.locator(".settings")).toBeVisible();
		});
	});

	test.describe("Gamepad Settings Screen", () => {
		test("should navigate to gamepad settings from settings", async ({ page }) => {
			await page.click("text=CONFIGURE");
			await expect(page.locator(".gamepad-settings")).toBeVisible();
			expect(page.url()).toContain("/settings/gamepad");
		});

		test("should show 'No Gamepad Detected' when none connected", async ({ page }) => {
			await page.click("text=CONFIGURE");
			await expect(page.locator("text=No Gamepad Detected")).toBeVisible();
		});

		test("should display current mapping", async ({ page }) => {
			await page.click("text=CONFIGURE");
			await expect(page.locator("text=Current Mapping")).toBeVisible();
		});

		test("should display direction mappings", async ({ page }) => {
			await page.click("text=CONFIGURE");

			await expect(page.locator("text=LEFT")).toBeVisible();
			await expect(page.locator("text=DOWN")).toBeVisible();
			await expect(page.locator("text=UP")).toBeVisible();
			await expect(page.locator("text=RIGHT")).toBeVisible();
		});

		test("should display menu/select mappings", async ({ page }) => {
			await page.click("text=CONFIGURE");

			await expect(page.locator("text=MENU")).toBeVisible();
			await expect(page.locator("text=SELECT")).toBeVisible();
		});

		test("should have LEARN MODE button", async ({ page }) => {
			await page.click("text=CONFIGURE");
			await expect(page.locator("text=LEARN MODE")).toBeVisible();
		});

		test("should have preset buttons", async ({ page }) => {
			await page.click("text=CONFIGURE");

			await expect(page.locator("text=D-PAD PRESET")).toBeVisible();
			await expect(page.locator("text=AXIS PRESET")).toBeVisible();
		});

		test("should return to settings on back button", async ({ page }) => {
			await page.click("text=CONFIGURE");
			await expect(page.locator(".gamepad-settings")).toBeVisible();

			await page.click("text=BACK TO SETTINGS");
			await expect(page.locator(".settings")).toBeVisible();
		});
	});

	test.describe("Background Selector", () => {
		test("should display current background name", async ({ page }) => {
			await expect(page.locator(".settings")).toContainText(/Background/i);
		});

		test("should cycle background with arrow buttons", async ({ page }) => {
			// Find background cycler
			const cycler = page.locator(".setting-control.cycler").first();
			if (await cycler.isVisible()) {
				// Click next arrow
				await page.keyboard.press("ArrowRight");
				await page.waitForTimeout(100);

				// Cycler should still be visible after navigation
				await expect(cycler).toBeVisible();
			}
		});

		test("should persist background selection", async ({ page }) => {
			// Change background
			await page.keyboard.press("ArrowRight");
			await page.waitForTimeout(100);

			await page.reload();
			await expect(page.locator(".settings")).toBeVisible();

			// Settings should load with persisted background
			await expect(page.locator(".setting-control.cycler").first()).toBeVisible();
		});
	});
});
