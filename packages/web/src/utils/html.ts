/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param unsafe - The untrusted string to escape
 * @returns The escaped string safe for insertion into HTML
 */
export function escapeHtml(unsafe: string | number | undefined | null): string {
	if (unsafe === undefined || unsafe === null) {
		return "";
	}

	const str = String(unsafe);

	const htmlEscapeMap: Record<string, string> = {
		"&": "&amp;",
		"<": "&lt;",
		">": "&gt;",
		'"': "&quot;",
		"'": "&#x27;",
		"/": "&#x2F;",
	};

	return str.replace(/[&<>"'/]/g, (char) => htmlEscapeMap[char] ?? char);
}
