import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for StepFever E2E tests
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: true, // Enable parallel execution (no DB in local-first mode)
	forbidOnly: !!process.env.CI,
	retries: process.env.CI ? 2 : 0,
	// workers defaults to half of available CPU cores
	reporter: [["html"], ["list"]],
	use: {
		baseURL: "http://localhost:5173",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		video: "retain-on-failure",
	},

	// Configure projects for different browsers
	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
		{
			name: "firefox",
			use: { ...devices["Desktop Firefox"] },
		},
		{
			name: "webkit",
			use: { ...devices["Desktop Safari"] },
		},
	],

	// Run dev server before tests
	webServer: {
		command: "cd packages/web && bun run dev",
		port: 5173,
		timeout: 120 * 1000,
		reuseExistingServer: !process.env.CI,
	},
});
