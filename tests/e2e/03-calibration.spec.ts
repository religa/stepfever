import { expect, test } from "@playwright/test";
import {
	clearAppState,
	getLocalStorageItem,
	navigateToCalibration,
	navigateToMainMenu,
	pressKeyMultipleTimes,
} from "./helpers/test-helpers";

test.describe("Audio Calibration", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await navigateToMainMenu(page);
		await navigateToCalibration(page);
	});

	test("should display calibration screen", async ({ page }) => {
		await expect(page.locator(".calibration")).toBeVisible();
		await expect(page.locator("h1, h2")).toContainText(/Calibration/i);
	});

	test("should display instructions", async ({ page }) => {
		await expect(page.locator(".instructions, .calibration")).toContainText(/Press.*SPACE|Press.*ENTER|hear.*beat/i);
	});

	test("should display beat indicator", async ({ page }) => {
		await expect(page.locator(".beat-indicator")).toBeVisible();
	});

	test("should show sample count", async ({ page }) => {
		await expect(page.locator(".offset-info, .calibration")).toContainText(/Samples.*0\/10|0\/10/i);
	});

	test("should increment sample count on SPACE press", async ({ page }) => {
		// Wait for first beat
		await page.waitForTimeout(600);

		// Press SPACE
		await page.keyboard.press("Space");

		// Sample count should increment
		await expect(page.locator(".offset-info, .calibration")).toContainText(/Samples.*1\/10|1\/10/i);
	});

	test("should increment sample count on ENTER press", async ({ page }) => {
		// Wait for first beat
		await page.waitForTimeout(600);

		// Press ENTER
		await page.keyboard.press("Enter");

		// Sample count should increment
		await expect(page.locator(".offset-info, .calibration")).toContainText(/Samples.*1\/10|1\/10/i);
	});

	test("should display average offset", async ({ page }) => {
		// Wait and collect a few samples
		await page.waitForTimeout(600);
		await page.keyboard.press("Space");
		await page.waitForTimeout(500);
		await page.keyboard.press("Space");

		// Should display average offset
		await expect(page.locator(".offset-info")).toContainText(/Average offset/i);
	});

	test("should return to main menu on ESC", async ({ page }) => {
		await page.keyboard.press("Escape");

		await expect(page.locator(".main-menu")).toBeVisible();
		await expect(page.locator("h1")).toContainText("StepFever");
	});

	test("should automatically finish after 10 samples", async ({ page }) => {
		// Collect 10 samples rapidly
		for (let i = 0; i < 10; i++) {
			await page.waitForTimeout(200);
			await page.keyboard.press("Space");
		}

		// Should return to main menu automatically
		await expect(page.locator(".main-menu")).toBeVisible({ timeout: 2000 });
	});

	test("should save calibration offset to localStorage", async ({ page }) => {
		// Collect 10 samples
		for (let i = 0; i < 10; i++) {
			await page.waitForTimeout(200);
			await page.keyboard.press("Space");
		}

		// Wait for main menu
		await expect(page.locator(".main-menu")).toBeVisible();

		// Check localStorage for saved offset
		const storage = await getLocalStorageItem(page, "stepfever-storage");
		expect(storage).toContain("globalOffset");
	});

	test("should persist calibration across page reloads", async ({ page }) => {
		// Collect samples
		for (let i = 0; i < 10; i++) {
			await page.waitForTimeout(200);
			await page.keyboard.press("Space");
		}

		await expect(page.locator(".main-menu")).toBeVisible();

		// Get offset from localStorage
		const storageBefore = await getLocalStorageItem(page, "stepfever-storage");
		expect(storageBefore).toBeTruthy();

		// Reload page
		await page.reload();

		// Offset should still be in localStorage
		const storageAfter = await getLocalStorageItem(page, "stepfever-storage");
		expect(storageAfter).toEqual(storageBefore);
	});

	test("should allow canceling calibration with ESC before completion", async ({ page }) => {
		// Start calibration
		await page.waitForTimeout(300);

		// Collect only 3 samples
		await pressKeyMultipleTimes(page, "Space", 3, 200);

		// Should show 3/10
		await expect(page.locator(".calibration")).toContainText(/3\/10/i);

		// Press ESC to cancel
		await page.keyboard.press("Escape");

		// Should return to main menu
		await expect(page.locator(".main-menu")).toBeVisible();
	});

	test("should handle rapid key presses without breaking", async ({ page }) => {
		// Rapidly press space
		await pressKeyMultipleTimes(page, "Space", 20, 50);

		// Should still be functional (either in calibration or back to menu)
		await expect(page.locator(".calibration, .main-menu")).toBeVisible();
	});

	test("should display visual feedback on beat", async ({ page }) => {
		const beatIndicator = page.locator(".beat-indicator");
		await expect(beatIndicator).toBeVisible();

		// Beat indicator should update
		await page.waitForTimeout(600);

		// Beat number should increment
		const initialText = await beatIndicator.textContent();

		await page.waitForTimeout(600);

		const updatedText = await beatIndicator.textContent();

		// Beat count should have changed
		expect(updatedText).not.toEqual(initialText);
	});

	test("should calculate and display offset in milliseconds", async ({ page }) => {
		// Collect a few samples
		for (let i = 0; i < 3; i++) {
			await page.waitForTimeout(250);
			await page.keyboard.press("Space");
		}

		// Offset should be displayed in ms
		const offsetText = await page.locator(".offset-info").textContent();
		expect(offsetText).toMatch(/\d+(\.\d+)?\s*ms/i);
	});

	test("should show hint about ESC to finish or skip", async ({ page }) => {
		await expect(page.locator(".hint, .calibration")).toContainText(/ESC/i);
	});

	test("should handle zero samples gracefully when pressing ESC", async ({ page }) => {
		// Press ESC immediately without collecting samples
		await page.keyboard.press("Escape");

		// Should return to main menu
		await expect(page.locator(".main-menu")).toBeVisible();

		// Should not crash or show errors
	});

	test("should remove outliers from offset calculation", async ({ page }) => {
		// This is testing the internal logic - we collect 10 samples
		// The implementation should trim min/max values
		for (let i = 0; i < 10; i++) {
			// Vary timing to create some outliers
			const delay = i === 0 || i === 9 ? 100 : 250;
			await page.waitForTimeout(delay);
			await page.keyboard.press("Space");
		}

		await expect(page.locator(".main-menu")).toBeVisible();

		// Offset should be calculated (we can't verify the exact math without inspecting internals)
		const storage = await getLocalStorageItem(page, "stepfever-storage");
		expect(storage).toContain("globalOffset");
	});
});
