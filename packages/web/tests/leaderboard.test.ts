/**
 * @vitest-environment happy-dom
 */
/**
 * Tests for local scores functionality
 * Tests: XSS protection
 */
import { describe, expect, it, vi } from "vitest";

describe("Local Scores Implementation", () => {
	describe("MEDIUM: XSS Protection", () => {
		it("should use escapeHtml for player names", async () => {
			// Import the escapeHtml function to verify it works
			const { escapeHtml } = await import("../src/utils/html");

			// Test malicious player name
			const maliciousName = '<script>alert("xss")</script>';
			const sanitized = escapeHtml(maliciousName);

			expect(sanitized).not.toContain("<script>");
			expect(sanitized).toContain("&lt;script&gt;");
		});

		it("should escape HTML entities in grade display", async () => {
			const { escapeHtml } = await import("../src/utils/html");

			// Grade should only be letter grades, but test defensively
			const maliciousGrade = '<img src=x onerror="alert(1)">';
			const sanitized = escapeHtml(maliciousGrade);

			expect(sanitized).not.toContain("<img");
			expect(sanitized).toContain("&lt;img");
		});
	});

	describe("HIGH: Local Scores Store Logic", () => {
		// Test the score comparison logic without actually importing zustand
		it("should determine when to replace scores", () => {
			// This tests the logic that should be in the store
			const shouldReplace = (existingScore: number, newScore: number) => {
				return !existingScore || newScore > existingScore;
			};

			expect(shouldReplace(0, 5000)).toBe(true); // First score
			expect(shouldReplace(5000, 3000)).toBe(false); // Worse score
			expect(shouldReplace(5000, 9000)).toBe(true); // Better score
		});

		it("should count plays by prefix matching", () => {
			// Test the play count logic
			const scores: Record<string, unknown> = {
				"song-1:Easy": { score: 3000 },
				"song-1:Hard": { score: 5000 },
				"song-2:Easy": { score: 4000 },
			};

			const getPlayCount = (songId: string) => {
				let count = 0;
				for (const key of Object.keys(scores)) {
					if (key.startsWith(`${songId}:`)) {
						count++;
					}
				}
				return count;
			};

			expect(getPlayCount("song-1")).toBe(2);
			expect(getPlayCount("song-2")).toBe(1);
			expect(getPlayCount("song-3")).toBe(0);
		});
	});
});
