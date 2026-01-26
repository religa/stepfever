import { describe, expect, it } from "vitest";

// Test the getDifficultyClass utility
describe("Difficulty Color Classes", () => {
	it("returns correct class for standard difficulties", async () => {
		const { getDifficultyClass } = await import("../src/utils/difficulty");

		expect(getDifficultyClass("beginner")).toBe("diff-beginner");
		expect(getDifficultyClass("easy")).toBe("diff-easy");
		expect(getDifficultyClass("medium")).toBe("diff-medium");
		expect(getDifficultyClass("hard")).toBe("diff-hard");
		expect(getDifficultyClass("challenge")).toBe("diff-challenge");
		expect(getDifficultyClass("expert")).toBe("diff-expert");
		expect(getDifficultyClass("edit")).toBe("diff-edit");
	});

	it("maps difficulty aliases correctly", async () => {
		const { getDifficultyClass } = await import("../src/utils/difficulty");

		// basic → easy
		expect(getDifficultyClass("basic")).toBe("diff-easy");
		// another → medium
		expect(getDifficultyClass("another")).toBe("diff-medium");
		// difficult → hard
		expect(getDifficultyClass("difficult")).toBe("diff-hard");
	});

	it("normalizes case", async () => {
		const { getDifficultyClass } = await import("../src/utils/difficulty");

		expect(getDifficultyClass("BEGINNER")).toBe("diff-beginner");
		expect(getDifficultyClass("Easy")).toBe("diff-easy");
		expect(getDifficultyClass("BASIC")).toBe("diff-easy");
		expect(getDifficultyClass("Challenge")).toBe("diff-challenge");
	});

	it("handles unknown difficulties gracefully", async () => {
		const { getDifficultyClass } = await import("../src/utils/difficulty");

		expect(getDifficultyClass("custom")).toBe("diff-custom");
		expect(getDifficultyClass("novice")).toBe("diff-novice");
		expect(getDifficultyClass("insane")).toBe("diff-insane");
	});
});

// Test MenuAudio module structure
describe("Menu Audio", () => {
	it("exports the expected interface", async () => {
		const { menuAudio } = await import("../src/audio/MenuAudio");

		expect(menuAudio).toBeDefined();
		expect(typeof menuAudio.init).toBe("function");
		expect(typeof menuAudio.playNavigate).toBe("function");
		expect(typeof menuAudio.playSelect).toBe("function");
		expect(typeof menuAudio.playCancel).toBe("function");
	});
});

// Test preferencesStore has menuSounds
describe("Preferences Store - Menu Sounds", () => {
	it("has menuSounds setting defined", async () => {
		const { usePreferences } = await import("../src/stores/preferencesStore");
		const state = usePreferences.getState();

		// Check that menuSounds exists (might be false from localStorage persisted state)
		expect(typeof state.menuSounds).toBe("boolean");
		expect(typeof state.setMenuSounds).toBe("function");
	});
});
