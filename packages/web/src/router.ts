/**
 * URL Router for StepFever
 * Manages browser history and URL-based navigation
 */

type RouteConfig = {
	path: string;
	screen: string;
	requiresState?: boolean; // Guard: redirect if history.state missing
};

const routes: RouteConfig[] = [
	{ path: "/", screen: "main-menu" },
	{ path: "/single/songs", screen: "song-select" },
	{ path: "/single/game", screen: "gameplay" },
	{ path: "/single/results", screen: "results", requiresState: true },
	{ path: "/multi/setup", screen: "player-setup" },
	{ path: "/multi/songs", screen: "song-select" },
	{ path: "/multi/game", screen: "multiplayer-gameplay" },
	{ path: "/multi/results", screen: "multiplayer-results", requiresState: true },
	{ path: "/scores", screen: "recent-scores" },
	{ path: "/settings", screen: "settings" },
	{ path: "/settings/calibration", screen: "calibration" },
	{ path: "/settings/speed", screen: "speed-mod-select" },
	{ path: "/settings/gamepad", screen: "gamepad-settings" },
];

export class Router {
	private onNavigate: (screen: string, data?: unknown) => void;

	constructor(onNavigate: (screen: string, data?: unknown) => void) {
		this.onNavigate = onNavigate;
		window.addEventListener("popstate", () => this.handleRoute());
	}

	navigate(path: string, data?: unknown, replace = false): void {
		if (replace) {
			history.replaceState(data, "", path);
		} else {
			history.pushState(data, "", path);
		}
		this.handleRoute();
	}

	handleRoute(): void {
		const path = window.location.pathname;
		const route = routes.find((r) => r.path === path);

		if (!route) {
			// Unknown route - go home
			this.navigate("/", undefined, true);
			return;
		}

		// Guard: redirect if state required but missing
		// Use typeof check for test environment compatibility
		const state = typeof history !== "undefined" ? history.state : null;
		if (route.requiresState && !state) {
			const fallback = path.startsWith("/multi") ? "/multi/songs" : "/single/songs";
			this.navigate(fallback, undefined, true);
			return;
		}

		this.onNavigate(route.screen, state);
	}

	getPath(screen: string, isMultiplayer: boolean): string {
		// Handle screens that exist in both modes
		if (screen === "song-select") {
			return isMultiplayer ? "/multi/songs" : "/single/songs";
		}
		if (screen === "gameplay") {
			return "/single/game";
		}
		if (screen === "results") {
			return "/single/results";
		}
		if (screen === "multiplayer-gameplay") {
			return "/multi/game";
		}
		if (screen === "multiplayer-results") {
			return "/multi/results";
		}
		if (screen === "player-setup") {
			return "/multi/setup";
		}
		// Handle "options" as alias for "settings"
		if (screen === "options") {
			return "/settings";
		}

		return routes.find((r) => r.screen === screen)?.path ?? "/";
	}
}

/**
 * Helper to detect if current URL is in multiplayer mode
 */
export function isMultiplayerRoute(): boolean {
	return window.location.pathname.startsWith("/multi");
}
