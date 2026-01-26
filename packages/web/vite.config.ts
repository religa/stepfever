import { createReadStream, existsSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { type Plugin, defineConfig } from "vite";
import { viteStaticCopy } from "vite-plugin-static-copy";

const CHARTS_DIR = resolve(__dirname, "../../charts");

/**
 * Custom plugin to serve chart files with proper URL decoding.
 * Vite's built-in static serving doesn't handle # in filenames correctly
 * because it interprets %23 as a URL fragment after decoding.
 */
function chartsServerPlugin(): Plugin {
	return {
		name: "charts-server",
		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				if (!req.url?.startsWith("/charts/")) {
					return next();
				}

				// Decode the URL path to get the actual file path
				const urlPath = decodeURIComponent(req.url.replace(/^\/charts/, ""));
				const filePath = join(CHARTS_DIR, urlPath);

				// Security: ensure the resolved path is within CHARTS_DIR
				if (!filePath.startsWith(CHARTS_DIR)) {
					res.statusCode = 403;
					res.end("Forbidden");
					return;
				}

				if (!existsSync(filePath) || !statSync(filePath).isFile()) {
					return next();
				}

				// Determine content type
				const ext = filePath.split(".").pop()?.toLowerCase();
				const contentTypes: Record<string, string> = {
					png: "image/png",
					jpg: "image/jpeg",
					jpeg: "image/jpeg",
					gif: "image/gif",
					webp: "image/webp",
					mp3: "audio/mpeg",
					ogg: "audio/ogg",
					wav: "audio/wav",
					m4a: "audio/mp4",
					sm: "text/plain",
					ssc: "text/plain",
				};

				res.setHeader("Content-Type", contentTypes[ext ?? ""] || "application/octet-stream");
				createReadStream(filePath).pipe(res);
			});
		},
	};
}

export default defineConfig({
	root: ".",
	build: {
		outDir: "dist",
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
			},
		},
	},
	plugins: [
		chartsServerPlugin(),
		viteStaticCopy({
			targets: [
				{
					src: "../../charts/*",
					dest: "charts",
				},
			],
		}),
	],
	server: {
		port: 5173,
		fs: {
			// Allow serving charts from root in dev mode
			allow: ["../.."],
		},
	},
	resolve: {
		alias: {
			"@": "/src",
		},
	},
});
