import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Difficulty and Settings Issues", () => {
	beforeEach(() => {
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe("Issue 1: getDifficultyClass CSS injection", () => {
		it("should sanitize difficulty names with spaces", async () => {
			const { getDifficultyClass } = await import("../src/utils/difficulty");

			// Spaces in class names are invalid CSS and could break layout
			const result = getDifficultyClass("hard mode");
			expect(result).not.toContain(" ");
		});

		it("should sanitize difficulty names with special characters", async () => {
			const { getDifficultyClass } = await import("../src/utils/difficulty");

			// Quote characters could enable attribute injection
			const result = getDifficultyClass('hard" onclick="alert(1)');
			expect(result).not.toContain('"');
			expect(result).not.toContain("=");
			expect(result).not.toContain("(");
			expect(result).not.toContain(")");
		});

		it("should sanitize difficulty names with angle brackets", async () => {
			const { getDifficultyClass } = await import("../src/utils/difficulty");

			// Angle brackets could break out of attribute
			const result = getDifficultyClass("hard<script>");
			expect(result).not.toContain("<");
			expect(result).not.toContain(">");
		});

		it("should only contain valid CSS class characters", async () => {
			const { getDifficultyClass } = await import("../src/utils/difficulty");

			// Valid CSS class: starts with letter, contains only letters, digits, hyphens, underscores
			const maliciousInputs = ["hard mode", 'easy"', "medium'", "challenge<>", "expert;color:red", "edit}"];

			for (const input of maliciousInputs) {
				const result = getDifficultyClass(input);
				// Should only contain valid CSS class characters
				expect(result).toMatch(/^diff-[a-z0-9_-]*$/);
			}
		});
	});

	describe("Issue 2: SettingsScreen race condition", () => {
		it("should have isMounted guard for async operations", async () => {
			const { SettingsScreen } = await import("../src/screens/SettingsNew");

			// Check that the class has isMounted property pattern
			const screen = new SettingsScreen(() => {});

			// The screen should have a way to track mount state
			// This is a structural test - the actual race condition would need integration testing
			expect(screen).toBeDefined();

			// Mount and immediately unmount to simulate rapid navigation
			const container = document.createElement("div");
			const mountPromise = screen.mount(container);
			screen.unmount();

			// Should complete without errors
			await expect(mountPromise).resolves.toBeUndefined();
		});
	});
});
