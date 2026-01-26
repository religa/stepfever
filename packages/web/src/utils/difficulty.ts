// Difficulty name to CSS class mapping
const ALIASES: Record<string, string> = {
	basic: "easy",
	another: "medium",
	difficult: "hard",
};

/**
 * Returns the CSS class for a difficulty name.
 * Maps aliases (basic→easy, another→medium, difficult→hard).
 * Sanitizes input to prevent CSS class injection.
 * Unknown names get `diff-{name}` and fall back to white via CSS.
 */
export function getDifficultyClass(name: string): string {
	const normalized = name.toLowerCase();
	const mapped = ALIASES[normalized] || normalized;
	// Sanitize: only allow lowercase letters, digits, hyphens, underscores
	const safe = mapped.replace(/[^a-z0-9_-]/g, "-").replace(/^-+|-+$/g, "");
	return `diff-${safe || "unknown"}`;
}
