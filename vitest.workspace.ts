import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
	{
		test: {
			name: "core",
			root: "./packages/core",
			environment: "node",
			exclude: ["**/node_modules/**", "**/e2e/**"],
		},
	},
	{
		test: {
			name: "web",
			root: "./packages/web",
			environment: "happy-dom",
			globals: true,
			exclude: ["**/node_modules/**", "**/e2e/**"],
		},
	},
]);
