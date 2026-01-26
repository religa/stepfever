/**
 * Background management utilities
 * Loads and applies background images via CSS custom properties
 */

export interface BackgroundOption {
	id: string;
	name: string;
	file: string | null;
}

let backgroundsCache: BackgroundOption[] | null = null;

/**
 * Default fallback backgrounds when index.json fails or is invalid
 */
const FALLBACK_BACKGROUNDS: BackgroundOption[] = [
	{ id: "background1", name: "Default", file: "background1.png" },
	{ id: "none", name: "Solid Color", file: null },
];

/**
 * Sanitize a file path to prevent CSS injection and path traversal
 * Only allows alphanumeric characters, dots, underscores, and hyphens
 */
function sanitizeFilePath(file: string): string {
	return file.replace(/[^a-zA-Z0-9._-]/g, "");
}

/**
 * Load available backgrounds from index.json
 * Validates the response and falls back to defaults if invalid
 */
export async function loadBackgrounds(): Promise<BackgroundOption[]> {
	if (backgroundsCache) return backgroundsCache;

	try {
		const response = await fetch("/backgrounds/index.json");
		if (!response.ok) throw new Error("Failed to load backgrounds");
		const data = await response.json();

		// Validate that backgrounds is an array
		const backgrounds = Array.isArray(data?.backgrounds) ? data.backgrounds : null;
		if (!backgrounds) {
			throw new Error("Invalid backgrounds format");
		}

		backgroundsCache = backgrounds;
		return backgrounds;
	} catch {
		// Cache and return fallback to prevent repeated failed fetches
		backgroundsCache = FALLBACK_BACKGROUNDS;
		return backgroundsCache;
	}
}

/**
 * Apply a background to the document via CSS custom properties
 * Sanitizes file paths to prevent CSS injection attacks
 */
export function applyBackground(id: string, backgrounds: BackgroundOption[]): void {
	// Handle empty backgrounds array
	if (backgrounds.length === 0) {
		document.documentElement.style.setProperty("--bg-image", "none");
		document.documentElement.style.setProperty("--bg-overlay-opacity", "0");
		document.body.classList.add("bg-solid");
		return;
	}

	const bg = backgrounds.find((b) => b.id === id) ?? backgrounds[0];

	if (bg?.file) {
		// Sanitize file path to prevent CSS injection
		const safeFile = sanitizeFilePath(bg.file);
		document.documentElement.style.setProperty("--bg-image", `url('/backgrounds/${safeFile}')`);
		document.documentElement.style.setProperty("--bg-overlay-opacity", "0.5");
		document.body.classList.remove("bg-solid");
	} else {
		document.documentElement.style.setProperty("--bg-image", "none");
		document.documentElement.style.setProperty("--bg-overlay-opacity", "0");
		document.body.classList.add("bg-solid");
	}
}

/**
 * Clear the backgrounds cache (useful for testing)
 */
export function clearBackgroundsCache(): void {
	backgroundsCache = null;
}
