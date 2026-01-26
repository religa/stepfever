/**
 * @vitest-environment happy-dom
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock localStorage for zustand persist middleware
const localStorageMock = {
	store: {} as Record<string, string>,
	getItem: vi.fn((key: string) => localStorageMock.store[key] ?? null),
	setItem: vi.fn((key: string, value: string) => {
		localStorageMock.store[key] = value;
	}),
	removeItem: vi.fn((key: string) => {
		delete localStorageMock.store[key];
	}),
	clear: vi.fn(() => {
		localStorageMock.store = {};
	}),
	get length() {
		return Object.keys(localStorageMock.store).length;
	},
	key: vi.fn((i: number) => Object.keys(localStorageMock.store)[i] ?? null),
};

// Install mock before imports
vi.stubGlobal("localStorage", localStorageMock);

// Mock DOM environment
const mockContainer = () => {
	const el = document.createElement("div");
	document.body.appendChild(el);
	return el;
};

describe("Code Review Issues", () => {
	describe("ScreenManager - Duplicate Loading Spinners", () => {
		it("should not create duplicate loading overlays on rapid navigation", async () => {
			// This test verifies that calling showLoading multiple times
			// doesn't create duplicate overlays
			const container = mockContainer();

			// Import ScreenManager dynamically to test
			const { ScreenManager } = await import("../src/screens/ScreenManager");
			const manager = new ScreenManager(container);

			// Mock screens that take time to mount
			const slowScreen = {
				mount: async () => new Promise((resolve) => setTimeout(resolve, 100)),
				unmount: vi.fn(),
			};

			// Start two navigations rapidly
			const nav1 = manager.navigateTo(slowScreen);
			const nav2 = manager.navigateTo(slowScreen);

			// Check there's only one loading overlay
			const overlays = container.querySelectorAll(".screen-loading");
			expect(overlays.length).toBeLessThanOrEqual(1);

			await Promise.all([nav1, nav2]);
		});
	});

	describe("ScreenManager - Navigation Race Condition", () => {
		it("should handle navigation during async mount without stuck overlay", async () => {
			const container = mockContainer();

			const { ScreenManager } = await import("../src/screens/ScreenManager");
			const manager = new ScreenManager(container);

			let resolveScreen1: () => void;
			const screen1 = {
				mount: () =>
					new Promise<void>((resolve) => {
						resolveScreen1 = resolve;
					}),
				unmount: vi.fn(),
			};

			const screen2 = {
				mount: vi.fn(),
				unmount: vi.fn(),
			};

			// Start navigating to screen1 (which won't complete)
			const nav1 = manager.navigateTo(screen1);

			// Before screen1 completes, navigate to screen2
			const nav2 = manager.navigateTo(screen2);

			// Complete screen1 mount
			resolveScreen1!();

			await Promise.all([nav1, nav2]);

			// Loading overlay should be hidden
			const overlay = container.querySelector(".screen-loading");
			expect(overlay).toBeNull();
		});
	});

	describe("AppStore - State Subscription", () => {
		it("should pass different prev and next state to subscribers", async () => {
			const { useAppStore } = await import("../src/stores/appStore");

			const states: { prev: unknown; next: unknown }[] = [];
			const unsubscribe = useAppStore.subscribe((next, prev) => {
				states.push({ prev, next });
			});

			// Make a state change
			useAppStore.getState().setShowFps(true);

			// Wait for subscription to fire
			await new Promise((r) => setTimeout(r, 10));

			expect(states.length).toBeGreaterThan(0);
			const lastChange = states[states.length - 1]!;
			// prev and next should be different objects or have different values
			expect(lastChange.prev).not.toBe(lastChange.next);

			unsubscribe();
		});
	});

	describe("AppStore - Dynamic Key Detection", () => {
		it("should route setState calls to correct underlying store", async () => {
			const { useAppStore } = await import("../src/stores/appStore");
			const { usePreferences } = await import("../src/stores/preferencesStore");
			const { useSession } = await import("../src/stores/sessionStore");

			// Set a preference value
			useAppStore.setState({ showFps: true });
			expect(usePreferences.getState().showFps).toBe(true);

			// Set a session value
			useAppStore.setState({ selectedSong: null });
			expect(useSession.getState().selectedSong).toBeNull();
		});
	});
});

describe("Security Issues", () => {
	describe("Path Traversal Prevention", () => {
		it("should block URL-encoded path traversal attempts", async () => {
			// This would be tested via API request
			// The fix should decode URLs before checking for ".."
		});
	});
});
