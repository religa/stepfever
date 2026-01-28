import type { JudgmentResult, NoteState } from "@stepfever/core";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";

const COLUMN_WIDTH = 80;
const ARROW_SIZE = 64; // Arrow dimensions (64x64 to match SVG)
const RECEPTOR_Y = 100; // Receptors at the top
const DEFAULT_SCROLL_SPEED = 300; // Default pixels per beat (scrolling upward)

const COLUMN_COLORS = [0xf90202, 0x0066ff, 0x0066ff, 0xf90202]; // LDUR: red, blue, blue, red

const JUDGMENT_COLORS: Record<string, number> = {
	marvelous: 0x00ffff,
	perfect: 0xffff00,
	great: 0x00ff00,
	good: 0x0088ff,
	boo: 0x888888,
	miss: 0xff0000,
};

// Arrow directions for each column (Left, Down, Up, Right)
const ARROW_DIRECTIONS = ["left", "down", "up", "right"] as const;

/**
 * Object pool for Graphics objects to avoid GC pressure during gameplay.
 * Rhythm games need consistent frame rates, and object allocation/deallocation
 * can cause stutters.
 */
class GraphicsPool {
	private pool: Graphics[] = [];
	private initialSize: number;

	constructor(initialSize = 32) {
		this.initialSize = initialSize;
		// Pre-allocate graphics objects
		for (let i = 0; i < initialSize; i++) {
			this.pool.push(new Graphics());
		}
	}

	/**
	 * Acquire a Graphics object from the pool.
	 * Creates a new one if pool is empty.
	 */
	acquire(): Graphics {
		if (this.pool.length > 0) {
			return this.pool.pop()!;
		}
		// Pool exhausted, create new (will be returned to pool later)
		return new Graphics();
	}

	/**
	 * Release a Graphics object back to the pool.
	 * Resets all state for clean reuse.
	 */
	release(graphic: Graphics): void {
		graphic.clear();
		graphic.visible = false;
		// Reset transform properties to prevent "dirty" objects
		graphic.alpha = 1;
		graphic.rotation = 0;
		graphic.scale.set(1);
		graphic.tint = 0xffffff;
		this.pool.push(graphic);
	}

	/**
	 * Destroy all pooled graphics (call on renderer cleanup)
	 */
	destroy(): void {
		for (const graphic of this.pool) {
			graphic.destroy();
		}
		this.pool = [];
	}

	/**
	 * Get pool statistics for debugging
	 */
	getStats(): { pooled: number; initialSize: number } {
		return { pooled: this.pool.length, initialSize: this.initialSize };
	}
}

export interface Viewport {
	x: number;
	y: number;
	width: number;
	height: number;
}

export interface RendererOptions {
	viewport?: Viewport;
	scale?: number;
	playerId?: number;
	songName?: string;
	speedModifierText?: string;
}

/**
 * Draw a stylized arrow in the given direction.
 * Based on Untitled.svg design with 64x64 coordinate space.
 */
function drawArrow(
	graphics: Graphics,
	direction: (typeof ARROW_DIRECTIONS)[number],
	width: number,
	height: number,
	fillColor: number,
	_strokeColor?: number,
): void {
	const centerX = width / 2;
	const centerY = height / 2;

	// SVG uses 64x64 viewBox, scale to fit
	const scale = Math.min(width, height) / 64;

	// Transform helper (SVG coords are 0-64, centered at 32,32)
	const tx = (x: number) => centerX + (x - 32) * scale;
	const ty = (y: number) => centerY + (y - 32) * scale;

	graphics.clear();

	// Arrow path from Untitled.svg (rounded coordinates, pointing UP)
	const basePath: [number, number][] = [
		[56, 32],
		[56, 38],
		[52, 42],
		[46, 42],
		[40, 36],
		[40, 52],
		[36, 56],
		[28, 56],
		[24, 52],
		[24, 36],
		[18, 42],
		[12, 42],
		[8, 38],
		[8, 32],
		[32, 8],
	];

	// Rotate point around center (32, 32)
	const rotatePoint = (x: number, y: number, angle: number): [number, number] => {
		const cos = Math.cos(angle);
		const sin = Math.sin(angle);
		const dx = x - 32;
		const dy = y - 32;
		return [32 + dx * cos - dy * sin, 32 + dx * sin + dy * cos];
	};

	const rotations: Record<string, number> = {
		up: 0,
		right: Math.PI / 2,
		down: Math.PI,
		left: -Math.PI / 2,
	};

	const angle = rotations[direction] ?? 0;
	const path = basePath.map(([x, y]) => rotatePoint(x, y, angle));

	// Helper to draw the arrow path
	const drawPath = () => {
		const firstPoint = path[0];
		if (firstPoint) {
			graphics.moveTo(tx(firstPoint[0]), ty(firstPoint[1]));
		}
		for (let i = 1; i < path.length; i++) {
			const point = path[i];
			if (point) {
				graphics.lineTo(tx(point[0]), ty(point[1]));
			}
		}
		graphics.closePath();
	};

	// GLOW EFFECT - soft colored glow around the arrow
	graphics.beginPath();
	drawPath();
	graphics.stroke({ color: fillColor, width: 10 * scale, alpha: 0.4 });

	// Main arrow shape
	graphics.beginPath();
	drawPath();
	graphics.fill({ color: fillColor });
	graphics.stroke({ color: 0x000000, width: 4 * scale });
}

export class Renderer {
	private app: Application;
	private noteField!: Container;
	private receptors: Graphics[] = [];
	private noteGraphics: Map<NoteState, Graphics> = new Map();
	private graphicsPool: GraphicsPool = new GraphicsPool(64); // Pre-allocate for ~2 screens of notes
	private judgmentText!: Text;
	private comboText!: Text;
	private accuracyText!: Text;
	private playerIdText?: Text;
	private songInfoContainer?: Container;
	private songNameText?: Text;
	private speedText?: Text;
	private progressBar?: Graphics;
	private progressBarBg?: Graphics;

	private judgmentTimeout?: ReturnType<typeof setTimeout>;
	private songInfoTimeout?: ReturnType<typeof setTimeout>;

	private viewport: Viewport;
	private playerId: number;
	private songName?: string;
	private speedModifierText?: string;

	// Scroll speed cache (pixels per second → pixels per beat)
	private scrollSpeed: number = DEFAULT_SCROLL_SPEED;
	private cachedBpm = 120;
	private cachedPixelsPerSecond = 0;

	// Column press state for receptor flash
	private columnPressed: boolean[] = [false, false, false, false];

	constructor(
		private canvas: HTMLCanvasElement,
		options: RendererOptions = {},
	) {
		this.app = new Application();
		this.viewport = options.viewport || {
			x: 0,
			y: 0,
			width: canvas.width,
			height: canvas.height,
		};
		this.playerId = options.playerId || 0;
		if (options.songName) {
			this.songName = options.songName;
		}
		if (options.speedModifierText) {
			this.speedModifierText = options.speedModifierText;
		}
	}

	async init(): Promise<void> {
		await this.app.init({
			canvas: this.canvas,
			width: this.viewport.width,
			height: this.viewport.height,
			backgroundColor: 0x1a1a2e,
			backgroundAlpha: 0.7, // Semi-transparent to show background image
		});

		// Create UI first (judgment/combo text) so they render BEHIND notes
		this.createUI();

		// Note field added after UI, so notes render ON TOP of judgment/combo
		this.noteField = new Container();
		this.app.stage.addChild(this.noteField);

		this.createReceptors();
	}

	/**
	 * Set viewport for split-screen rendering
	 */
	setViewport(x: number, y: number, width: number, height: number): void {
		this.viewport = { x, y, width, height };

		// Update PixiJS renderer viewport
		this.app.renderer.resize(width, height);

		// Recalculate UI positions
		this.updateUIPositions();

		// Recalculate receptor positions
		this.updateReceptorPositions();
	}

	/**
	 * Get a readonly copy of the current viewport
	 */
	getViewport(): Readonly<Viewport> {
		return { ...this.viewport };
	}

	/**
	 * Get just the viewport height (common use case for visibility calculations)
	 */
	getViewportHeight(): number {
		return this.viewport.height;
	}

	/**
	 * Update UI element positions based on viewport size
	 * For vertical splits, width is the limiting factor
	 */
	private updateUIPositions(): void {
		const scaleFactor = this.viewport.width / 800;

		// Judgment/combo in center of screen (rendered behind notes via z-order)
		if (this.judgmentText) {
			this.judgmentText.x = this.viewport.width / 2;
			this.judgmentText.y = this.viewport.height * 0.4;
			this.judgmentText.style.fontSize = Math.max(16, 32 * scaleFactor);
		}

		if (this.comboText) {
			this.comboText.x = this.viewport.width / 2;
			this.comboText.y = this.viewport.height * 0.5;
			this.comboText.style.fontSize = Math.max(12, 24 * scaleFactor);
		}

		// Update accuracy text position
		if (this.accuracyText) {
			this.accuracyText.x = this.viewport.width - 20;
			this.accuracyText.y = 20;
			this.accuracyText.style.fontSize = Math.max(10, 18 * scaleFactor);
		}

		// Update progress bar for new viewport width
		if (this.progressBarBg) {
			this.progressBarBg.clear();
			this.progressBarBg.rect(0, 0, this.viewport.width, 4);
			this.progressBarBg.fill({ color: 0x333333 });
		}
		if (this.progressBar) {
			this.progressBar.clear();
			this.progressBar.rect(0, 0, this.viewport.width, 4);
			this.progressBar.fill({ color: 0x00ff88 });
			this.progressBar.width = 0; // Will be set correctly on next frame
		}

		// Add player number indicator for multiplayer
		if (this.playerId > 0 || (this.viewport.width < 800 && this.playerId === 0)) {
			if (!this.playerIdText) {
				this.playerIdText = new Text({
					text: `P${this.playerId + 1}`,
					style: new TextStyle({
						fontSize: Math.max(10, 16 * scaleFactor),
						fill: 0xffffff,
						fontFamily: "monospace",
					}),
				});
				this.playerIdText.anchor.set(0.5);
				this.app.stage.addChild(this.playerIdText);
			}
			this.playerIdText.x = this.viewport.width / 2;
			this.playerIdText.y = 20;
			this.playerIdText.style.fontSize = Math.max(10, 16 * scaleFactor);
		}
	}

	/**
	 * Update receptor positions based on viewport width
	 * Called when viewport changes to re-center receptors
	 */
	private updateReceptorPositions(): void {
		const startX = (this.viewport.width - COLUMN_WIDTH * 4) / 2;
		for (let col = 0; col < 4; col++) {
			const receptor = this.receptors[col];
			if (receptor) {
				receptor.x = startX + col * COLUMN_WIDTH;
			}
		}
	}

	/**
	 * Update scroll speed based on current BPM and pixels per second
	 * Caches the conversion to avoid recalculating every frame
	 */
	updateScrollSpeed(pixelsPerSecond: number, currentBpm: number): void {
		// Only recalculate if BPM or speed changed
		if (this.cachedPixelsPerSecond !== pixelsPerSecond || this.cachedBpm !== currentBpm) {
			this.cachedPixelsPerSecond = pixelsPerSecond;
			this.cachedBpm = currentBpm;

			// Guard against invalid BPM values
			if (!Number.isFinite(currentBpm) || currentBpm <= 0) {
				this.scrollSpeed = DEFAULT_SCROLL_SPEED;
				return;
			}

			// Convert pixels per second to pixels per beat
			// pixels/sec ÷ (beats/sec) = pixels/beat
			const beatsPerSecond = currentBpm / 60;
			this.scrollSpeed = pixelsPerSecond / beatsPerSecond;
		}
	}

	/**
	 * Calculate Y position for a note based on beat difference
	 */
	private calculateNoteY(beatDiff: number): number {
		return RECEPTOR_Y + beatDiff * this.scrollSpeed;
	}

	private createReceptors(): void {
		const startX = (this.viewport.width - COLUMN_WIDTH * 4) / 2;

		for (let col = 0; col < 4; col++) {
			const receptor = new Graphics();
			const direction = ARROW_DIRECTIONS[col];
			const color = COLUMN_COLORS[col];
			if (direction !== undefined && color !== undefined) {
				drawArrow(receptor, direction, ARROW_SIZE, ARROW_SIZE, 0x444444, color);
			}
			receptor.x = startX + col * COLUMN_WIDTH + (COLUMN_WIDTH - ARROW_SIZE) / 2;
			receptor.y = RECEPTOR_Y - ARROW_SIZE / 2;
			this.receptors.push(receptor);
			this.noteField.addChild(receptor);
		}
	}

	private createUI(): void {
		const scaleFactor = this.viewport.width / 800;
		const style = new TextStyle({
			fill: 0xffffff,
			fontSize: Math.max(16, 32 * scaleFactor),
			fontFamily: "monospace",
		});

		// Judgment and combo text centered on screen, rendered BEHIND notes (z-order set in init)
		this.judgmentText = new Text({ text: "", style });
		this.judgmentText.anchor.set(0.5);
		this.judgmentText.x = this.viewport.width / 2;
		this.judgmentText.y = this.viewport.height * 0.4;
		this.app.stage.addChild(this.judgmentText);

		this.comboText = new Text({
			text: "",
			style: new TextStyle({
				fill: 0xffffff,
				fontSize: Math.max(12, 24 * scaleFactor),
				fontFamily: "monospace",
			}),
		});
		this.comboText.anchor.set(0.5);
		this.comboText.x = this.viewport.width / 2;
		this.comboText.y = this.viewport.height * 0.5;
		this.app.stage.addChild(this.comboText);

		this.accuracyText = new Text({
			text: "",
			style: new TextStyle({
				fill: 0xffffff,
				fontSize: Math.max(10, 18 * scaleFactor),
				fontFamily: "monospace",
			}),
		});
		this.accuracyText.anchor.set(1, 0);
		this.accuracyText.x = this.viewport.width - 20;
		this.accuracyText.y = 20;
		this.app.stage.addChild(this.accuracyText);

		// Create song info display (shown for first 3 seconds)
		if (this.songName || this.speedModifierText) {
			this.songInfoContainer = new Container();
			this.songInfoContainer.x = this.viewport.width / 2;
			this.songInfoContainer.y = this.viewport.height * 0.5;

			if (this.songName) {
				this.songNameText = new Text({
					text: this.songName,
					style: new TextStyle({
						fill: 0xffffff,
						fontSize: Math.max(20, 36 * scaleFactor),
						fontFamily: "monospace",
						fontWeight: "bold",
					}),
				});
				this.songNameText.anchor.set(0.5);
				this.songInfoContainer.addChild(this.songNameText);
			}

			if (this.speedModifierText) {
				this.speedText = new Text({
					text: this.speedModifierText,
					style: new TextStyle({
						fill: 0xaaaaaa,
						fontSize: Math.max(14, 24 * scaleFactor),
						fontFamily: "monospace",
					}),
				});
				this.speedText.anchor.set(0.5);
				this.speedText.y = this.songName ? 45 : 0;
				this.songInfoContainer.addChild(this.speedText);
			}

			this.app.stage.addChild(this.songInfoContainer);

			// Fade out after 3 seconds
			this.songInfoTimeout = setTimeout(() => {
				if (this.songInfoContainer) {
					this.songInfoContainer.visible = false;
				}
			}, 3000);
		}

		// Create progress bar at the top
		this.progressBarBg = new Graphics();
		this.progressBarBg.rect(0, 0, this.viewport.width, 4);
		this.progressBarBg.fill({ color: 0x333333 });
		this.app.stage.addChild(this.progressBarBg);

		// Create progress bar with full width, scale via width property
		this.progressBar = new Graphics();
		this.progressBar.rect(0, 0, this.viewport.width, 4);
		this.progressBar.fill({ color: 0x00ff88 });
		this.progressBar.width = 0; // Start at 0, will be scaled
		this.app.stage.addChild(this.progressBar);

		// Call updateUIPositions to handle player ID text
		this.updateUIPositions();
	}

	/**
	 * Update progress bar (0-1)
	 */
	updateProgress(progress: number): void {
		if (this.progressBar) {
			this.progressBar.width = this.viewport.width * Math.max(0, Math.min(1, progress));
		}
	}

	/**
	 * Set column press state for receptor flash effect
	 * Redraws receptor with brighter fill color on press (tint would darken due to multiplicative blending)
	 */
	setColumnPressed(column: number, pressed: boolean): void {
		if (column >= 0 && column < 4) {
			this.columnPressed[column] = pressed;
			const receptor = this.receptors[column];
			if (receptor) {
				// Redraw receptor with brighter fill color on press
				// Note: Can't use tint because it's multiplicative (0x444444 * 0xCCCCCC = darker!)
				const direction = ARROW_DIRECTIONS[column];
				const strokeColor = COLUMN_COLORS[column];
				const fillColor = pressed ? 0x888888 : 0x444444;

				if (direction !== undefined && strokeColor !== undefined) {
					drawArrow(receptor, direction, ARROW_SIZE, ARROW_SIZE, fillColor, strokeColor);
				}
			}
		}
	}

	render(visibleNotes: NoteState[], currentBeat: number, combo: number, accuracy: number): void {
		// Guard against render() being called before init() completes
		if (!this.noteField) return;

		// Set viewport clipping for split-screen rendering
		// Note: Direct GL access varies by renderer type (WebGL/WebGPU)
		// Viewport clipping is handled by PixiJS internally when we resize the renderer
		// in setViewport() method

		const startX = (this.viewport.width - COLUMN_WIDTH * 4) / 2;

		// Release graphics for notes no longer visible (return to pool instead of destroying)
		for (const [state, graphic] of this.noteGraphics) {
			if (!visibleNotes.includes(state)) {
				this.noteField.removeChild(graphic);
				this.graphicsPool.release(graphic);
				this.noteGraphics.delete(state);
			}
		}

		// Update/create note graphics
		for (const state of visibleNotes) {
			if (state.hit || state.missed) {
				// Release hit/missed notes back to pool
				const graphic = this.noteGraphics.get(state);
				if (graphic) {
					this.noteField.removeChild(graphic);
					this.graphicsPool.release(graphic);
					this.noteGraphics.delete(state);
				}
				continue;
			}

			const beatDiff = state.note.beat - currentBeat;
			const y = this.calculateNoteY(beatDiff); // Notes start below and scroll upward

			let graphic = this.noteGraphics.get(state);
			if (!graphic) {
				// Acquire from pool instead of creating new
				graphic = this.graphicsPool.acquire();
				graphic.visible = true;
				const direction = ARROW_DIRECTIONS[state.note.column];
				const color = COLUMN_COLORS[state.note.column] ?? 0xffffff;
				if (direction !== undefined) {
					drawArrow(graphic, direction, ARROW_SIZE, ARROW_SIZE, color);
				}
				this.noteGraphics.set(state, graphic);
				this.noteField.addChild(graphic);
			}

			graphic.x = startX + state.note.column * COLUMN_WIDTH + (COLUMN_WIDTH - ARROW_SIZE) / 2;
			graphic.y = y - ARROW_SIZE / 2;
		}

		// Update combo
		this.comboText.text = combo > 0 ? `${combo} COMBO` : "";

		// Update accuracy
		this.accuracyText.text = `${accuracy.toFixed(2)}%`;
	}

	showJudgment(result: JudgmentResult): void {
		this.judgmentText.text = result.judgment.toUpperCase();
		this.judgmentText.style.fill = JUDGMENT_COLORS[result.judgment] ?? 0xffffff;

		// Clear previous timeout
		if (this.judgmentTimeout) {
			clearTimeout(this.judgmentTimeout);
		}

		// Hide after 500ms
		this.judgmentTimeout = setTimeout(() => {
			this.judgmentText.text = "";
		}, 500);
	}

	updateCombo(combo: number): void {
		this.comboText.text = combo > 0 ? `${combo} COMBO` : "";
	}

	destroy(): void {
		if (this.judgmentTimeout) {
			clearTimeout(this.judgmentTimeout);
		}
		if (this.songInfoTimeout) {
			clearTimeout(this.songInfoTimeout);
		}
		if (this.playerIdText) {
			this.playerIdText.destroy();
		}
		if (this.songInfoContainer) {
			this.songInfoContainer.destroy({ children: true });
		}
		if (this.progressBar) {
			this.progressBar.destroy();
		}
		if (this.progressBarBg) {
			this.progressBarBg.destroy();
		}
		// Clear references - don't manually destroy active graphics as app.destroy(true) handles them
		this.noteGraphics.clear();
		// Destroy pooled graphics that aren't children of app.stage
		this.graphicsPool.destroy();
		this.receptors = [];
		this.app.destroy(true);
	}
}
