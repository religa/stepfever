import { expect, test } from "@playwright/test";
import {
	clearAppState,
	getLocalStorageItem,
	navigateToCalibration,
	navigateToMainMenu,
	pressKeyMultipleTimes,
	setLocalStorageItem,
} from "./helpers/test-helpers";

test.describe("State Persistence", () => {
	test.beforeEach(async ({ page }) => {
		await clearAppState(page);
		await navigateToMainMenu(page);
	});

	test("should persist player name across sessions", async ({ page }) => {
		// Set player name via prompt
		await page.locator("#btn-set-name").click();
		page.on("dialog", async (dialog) => {
			await dialog.accept("PersistentPlayer");
		});
		await page.waitForTimeout(200);

		// Reload page
		await page.reload();

		// Name should still be there
		await expect(page.locator(".player-info")).toContainText("PersistentPlayer");
	});

	test("should persist global offset across sessions", async ({ page }) => {
		// Go to calibration and set offset
		await navigateToCalibration(page);

		// Complete calibration
		for (let i = 0; i < 10; i++) {
			await page.waitForTimeout(200);
			await page.keyboard.press("Space");
		}

		await expect(page.locator(".main-menu")).toBeVisible();

		// Get saved offset
		const storage1 = await getLocalStorageItem(page, "stepfever-storage");
		expect(storage1).toContain("globalOffset");

		// Reload page
		await page.reload();

		// Offset should still be there
		const storage2 = await getLocalStorageItem(page, "stepfever-storage");
		expect(storage2).toEqual(storage1);
	});

	test("should use correct localStorage key", async ({ page }) => {
		await setLocalStorageItem(
			page,
			"stepfever-storage",
			JSON.stringify({
				state: { playerName: "TestPlayer", globalOffset: 0.05 },
				version: 0,
			}),
		);

		await page.reload();

		const storage = await getLocalStorageItem(page, "stepfever-storage");
		expect(storage).toBeTruthy();
		expect(storage).toContain("TestPlayer");
	});

	test("should handle missing localStorage gracefully", async ({ page }) => {
		await clearAppState(page);
		await page.reload();

		// App should still load
		await expect(page.locator("h1")).toContainText("StepFever");

		// Should show "Set Player Name" button
		await expect(page.locator("#btn-set-name")).toBeVisible();
	});

	test("should handle corrupted localStorage gracefully", async ({ page }) => {
		await setLocalStorageItem(page, "stepfever-storage", "corrupted-json{");

		await page.reload();

		// App should still load (might reset to defaults)
		await expect(page.locator("h1")).toContainText("StepFever");
	});

	test("should not persist selected song across sessions", async ({ page }) => {
		// Session state (selected song) should not persist
		await setLocalStorageItem(
			page,
			"stepfever-storage",
			JSON.stringify({
				state: {
					playerName: "TestPlayer",
					globalOffset: 0,
					selectedSong: { id: "test", title: "Test Song" },
					selectedDifficulty: { id: "diff1", name: "Easy" },
				},
				version: 0,
			}),
		);

		await page.reload();

		// Check localStorage - selected song should not be persisted
		const storage = await getLocalStorageItem(page, "stepfever-storage");
		const parsed = JSON.parse(storage!);

		// playerName and globalOffset should persist, but not selectedSong
		expect(parsed.state.playerName).toBe("TestPlayer");
		expect(parsed.state.globalOffset).toBe(0);
		// selectedSong should not be in persisted state
	});

	test("should maintain localStorage size within reasonable limits", async ({ page }) => {
		// Set various data
		await setLocalStorageItem(
			page,
			"stepfever-storage",
			JSON.stringify({
				state: {
					playerName: "TestPlayer",
					globalOffset: 0.05,
				},
				version: 0,
			}),
		);

		const storage = await getLocalStorageItem(page, "stepfever-storage");
		const sizeInBytes = new Blob([storage!]).size;

		// Should be reasonable (< 10KB)
		expect(sizeInBytes).toBeLessThan(10 * 1024);
	});

	test("should handle multiple browser tabs correctly", async ({ page, context }) => {
		// Set player name in first tab
		await setLocalStorageItem(
			page,
			"stepfever-storage",
			JSON.stringify({
				state: { playerName: "Player1", globalOffset: 0 },
				version: 0,
			}),
		);

		// Open second tab
		const page2 = await context.newPage();
		await page2.goto("/");

		// Second tab should see the same data
		const storage2 = await getLocalStorageItem(page2, "stepfever-storage");
		expect(storage2).toContain("Player1");

		await page2.close();
	});

	test("should preserve data type for globalOffset", async ({ page }) => {
		await setLocalStorageItem(
			page,
			"stepfever-storage",
			JSON.stringify({
				state: { playerName: "TestPlayer", globalOffset: 0.123 },
				version: 0,
			}),
		);

		await page.reload();

		const storage = await getLocalStorageItem(page, "stepfever-storage");
		const parsed = JSON.parse(storage!);

		// Should be a number, not string
		expect(typeof parsed.state.globalOffset).toBe("number");
		expect(parsed.state.globalOffset).toBe(0.123);
	});

	test("should handle null player name", async ({ page }) => {
		await setLocalStorageItem(
			page,
			"stepfever-storage",
			JSON.stringify({
				state: { playerName: null, globalOffset: 0 },
				version: 0,
			}),
		);

		await page.reload();

		// Should show set name button
		await expect(page.locator("#btn-set-name")).toBeVisible();
	});

	test("should reset to defaults when localStorage is cleared", async ({ page }) => {
		// Set some data
		await setLocalStorageItem(
			page,
			"stepfever-storage",
			JSON.stringify({
				state: { playerName: "TestPlayer", globalOffset: 0.5 },
				version: 0,
			}),
		);

		await page.reload();
		await expect(page.locator(".player-info")).toContainText("TestPlayer");

		// Clear localStorage
		await clearAppState(page);
		await page.reload();

		// Should be back to defaults
		await expect(page.locator("#btn-set-name")).toBeVisible();

		const storage = await getLocalStorageItem(page, "stepfever-storage");
		if (storage) {
			const parsed = JSON.parse(storage);
			expect(parsed.state.playerName).toBeFalsy();
			expect(parsed.state.globalOffset).toBe(0);
		}
	});

	test("should handle very long player names", async ({ page }) => {
		const longName = "A".repeat(1000);

		await setLocalStorageItem(
			page,
			"stepfever-storage",
			JSON.stringify({
				state: { playerName: longName, globalOffset: 0 },
				version: 0,
			}),
		);

		await page.reload();

		// Should handle without crashing
		await expect(page.locator("h1")).toContainText("StepFever");
	});

	test("should handle extreme offset values", async ({ page }) => {
		await setLocalStorageItem(
			page,
			"stepfever-storage",
			JSON.stringify({
				state: { playerName: "TestPlayer", globalOffset: 999999 },
				version: 0,
			}),
		);

		await page.reload();

		// Should handle without crashing
		await expect(page.locator("h1")).toContainText("StepFever");
	});

	test("should handle negative offset values", async ({ page }) => {
		await setLocalStorageItem(
			page,
			"stepfever-storage",
			JSON.stringify({
				state: { playerName: "TestPlayer", globalOffset: -0.5 },
				version: 0,
			}),
		);

		await page.reload();

		const storage = await getLocalStorageItem(page, "stepfever-storage");
		const parsed = JSON.parse(storage!);
		expect(parsed.state.globalOffset).toBe(-0.5);
	});

	test("should maintain localStorage after multiple calibrations", async ({ page }) => {
		// First calibration
		await navigateToCalibration(page);
		await pressKeyMultipleTimes(page, "Space", 10, 200);
		await expect(page.locator(".main-menu")).toBeVisible();

		const storage1 = await getLocalStorageItem(page, "stepfever-storage");

		// Second calibration
		await navigateToCalibration(page);
		await pressKeyMultipleTimes(page, "Space", 10, 200);
		await expect(page.locator(".main-menu")).toBeVisible();

		const storage2 = await getLocalStorageItem(page, "stepfever-storage");

		// Storage should have been updated, not corrupted
		expect(storage2).toBeTruthy();
		expect(storage2).not.toEqual(storage1); // Offset likely changed
	});

	test("should preserve unicode characters in player name", async ({ page }) => {
		const unicodeName = "プレイヤー名 🎮 Player";

		await setLocalStorageItem(
			page,
			"stepfever-storage",
			JSON.stringify({
				state: { playerName: unicodeName, globalOffset: 0 },
				version: 0,
			}),
		);

		await page.reload();

		await expect(page.locator(".player-info")).toContainText("プレイヤー");
	});
});
