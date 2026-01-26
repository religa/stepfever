import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseSM } from "@stepfever/core";
import type { SongIndex, SongIndexDifficulty, SongIndexEntry } from "@stepfever/core";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CHARTS_DIR = join(__dirname, "../../../charts");
const OUTPUT_FILE = join(__dirname, "../src/generated/songs.json");

/**
 * Encode URL path segments to handle special characters like # that would
 * otherwise be interpreted as URL fragments/anchors.
 */
function encodeUrlPath(path: string): string {
	return path
		.split("/")
		.map((segment) => encodeURIComponent(segment))
		.join("/");
}

async function findChartFiles(dir: string): Promise<string[]> {
	const files = await readdir(dir);
	return files.filter((f) => f.endsWith(".ssc") || f.endsWith(".sm")).map((f) => join(dir, f));
}

async function findAudioFile(dir: string): Promise<string | undefined> {
	const files = await readdir(dir);
	const audioExts = [".mp3", ".ogg", ".wav", ".m4a"];
	const audio = files.find((f) => audioExts.some((ext) => f.toLowerCase().endsWith(ext)));
	return audio;
}

async function findBannerFile(dir: string, songTitle?: string): Promise<string | undefined> {
	const files = await readdir(dir);
	const imageExts = [".png", ".jpg", ".jpeg"];
	const isImage = (f: string) => imageExts.some((ext) => f.toLowerCase().endsWith(ext));

	// Priority 1: Look for files containing "bn" or "banner"
	let banner = files.find((f) => {
		const lower = f.toLowerCase();
		return (lower.includes("bn") || lower.includes("banner")) && isImage(f);
	});
	if (banner) return banner;

	// Priority 2: Look for files containing "jacket" (common in dance games)
	banner = files.find((f) => f.toLowerCase().includes("jacket") && isImage(f));
	if (banner) return banner;

	// Priority 3: Look for files matching song title (e.g., "Song Title.png")
	if (songTitle) {
		const titleLower = songTitle.toLowerCase();
		banner = files.find((f) => {
			const lower = f.toLowerCase();
			const nameWithoutExt = lower.replace(/\.(png|jpe?g)$/i, "");
			return nameWithoutExt === titleLower && isImage(f);
		});
		if (banner) return banner;
	}

	// Priority 4: Look for files matching folder name
	const folderName = basename(dir).toLowerCase();
	banner = files.find((f) => {
		const lower = f.toLowerCase();
		const nameWithoutExt = lower.replace(/\.(png|jpe?g)$/i, "");
		return nameWithoutExt === folderName && isImage(f);
	});
	if (banner) return banner;

	return undefined;
}

async function getAllChartFolders(baseDir: string): Promise<string[]> {
	const folders: string[] = [];

	async function scanDir(dir: string): Promise<void> {
		const entries = await readdir(dir);
		for (const entry of entries) {
			const fullPath = join(dir, entry);
			const stats = await stat(fullPath);
			if (!stats.isDirectory()) continue;

			// Check if this folder contains chart files
			const files = await readdir(fullPath);
			const hasChartFile = files.some((f) => f.endsWith(".ssc") || f.endsWith(".sm"));

			if (hasChartFile) {
				folders.push(fullPath);
			} else {
				// Recursively scan subdirectories
				await scanDir(fullPath);
			}
		}
	}

	await scanDir(baseDir);
	return folders;
}

async function buildSongIndex(): Promise<void> {
	const songs: SongIndexEntry[] = [];
	const errors: string[] = [];

	let folders: string[];
	try {
		folders = await getAllChartFolders(CHARTS_DIR);
	} catch {
		console.error(`Charts directory not found: ${CHARTS_DIR}`);
		process.exit(1);
	}

	if (folders.length === 0) {
		console.error("No chart folders found");
		process.exit(1);
	}

	for (const folderPath of folders) {
		const folder = basename(folderPath);
		// Create a relative ID based on the folder path relative to charts/
		const relPath = folderPath.substring(CHARTS_DIR.length + 1);
		const songId = relPath.replace(/\//g, "__"); // Use __ to preserve hierarchy in ID

		try {
			const chartFiles = await findChartFiles(folderPath);
			if (chartFiles.length === 0) {
				console.warn(`Warning: No chart file in ${folder}, skipping`);
				continue;
			}

			// Prefer .ssc over .sm
			const chartPath = chartFiles.find((f) => f.endsWith(".ssc")) ?? chartFiles[0];
			if (!chartPath) continue;

			const content = await readFile(chartPath, "utf-8");
			const chart = parseSM(content);

			const audioFile = await findAudioFile(folderPath);
			const songTitle = chart.metadata.title || folder;
			const bannerFile = await findBannerFile(folderPath, songTitle);

			// Calculate BPM (detect if variable)
			const bpms = chart.bpmChanges.map((b) => b.bpm);
			let bpm: SongIndexEntry["bpm"];
			if (bpms.length === 0) {
				console.warn(`Warning: No BPM data in ${folder}, using default 120`);
				bpm = 120;
			} else {
				const minBpm = Math.min(...bpms);
				const maxBpm = Math.max(...bpms);
				bpm = minBpm === maxBpm ? minBpm : { min: Math.round(minBpm), max: Math.round(maxBpm) };
			}

			const difficulties: SongIndexDifficulty[] = chart.difficulties.map((d) => ({
				name: d.name,
				level: d.meter,
				chartPath: encodeUrlPath(`/charts/${relPath}/${basename(chartPath)}`),
				noteCount: d.notes.length,
			}));

			const entry: SongIndexEntry = {
				id: songId,
				title: chart.metadata.title || folder,
				artist: chart.metadata.artist || "Unknown",
				bpm,
				difficulties,
			};

			if (chart.metadata.titleTranslit) {
				entry.titleTranslit = chart.metadata.titleTranslit;
			}
			if (chart.metadata.artistTranslit) {
				entry.artistTranslit = chart.metadata.artistTranslit;
			}
			if (bannerFile) {
				entry.banner = encodeUrlPath(`/charts/${relPath}/${bannerFile}`);
			}
			if (audioFile) {
				entry.audioFile = encodeUrlPath(`/charts/${relPath}/${audioFile}`);
			}

			songs.push(entry);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			errors.push(`${folder}: ${msg}`);
			console.error(`Error: Failed to parse ${folder}: ${msg}`);
		}
	}

	if (songs.length === 0) {
		console.error("No valid songs found. Aborting.");
		process.exit(1);
	}

	const index: SongIndex = {
		songs: songs.sort((a, b) => a.title.localeCompare(b.title)),
		generatedAt: new Date().toISOString(),
	};

	// Ensure output directory exists
	await mkdir(dirname(OUTPUT_FILE), { recursive: true });
	await writeFile(OUTPUT_FILE, JSON.stringify(index, null, 2));

	console.log(`Generated songs.json: ${songs.length} songs`);
	if (errors.length > 0) {
		console.warn(`${errors.length} songs failed to parse`);
	}
}

buildSongIndex();
