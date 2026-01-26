import type { JudgmentResult, NoteState } from "@stepfever/core";
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";

const COLUMN_WIDTH = 80;
const RECEPTOR_Y = 100; // Receptors at the top
const DEFAULT_SCROLL_SPEED = 300; // Default pixels per beat (scrolling upward)

const COLUMN_COLORS = [0xff0000, 0x0000ff, 0x0000ff, 0xff0000]; // LDUR

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
 * Draw a stylized arrow in the given direction
 */
function drawArrow(
	graphics: Graphics,
	direction: (typeof ARROW_DIRECTIONS)[number],
	width: number,
	height: number,
	fillColor: number,
	strokeColor?: number,
): void {
	const centerX = width / 2;
	const centerY = height / 2;
	const arrowSize = Math.min(width, height) * 0.8;

	graphics.clear();

	// Arrow shape varies by direction
	switch (direction) {
		case "left":
			// Point to the left
			graphics.moveTo(centerX - arrowSize / 2, centerY);
			graphics.lineTo(centerX + arrowSize / 4, centerY - arrowSize / 3);
			graphics.lineTo(centerX + arrowSize / 4, centerY - arrowSize / 6);
			graphics.lineTo(centerX + arrowSize / 2, centerY - arrowSize / 6);
			graphics.lineTo(centerX + arrowSize / 2, centerY + arrowSize / 6);
			graphics.lineTo(centerX + arrowSize / 4, centerY + arrowSize / 6);
			graphics.lineTo(centerX + arrowSize / 4, centerY + arrowSize / 3);
			graphics.lineTo(centerX - arrowSize / 2, centerY);
			break;
		case "right":
			// Point to the right
			graphics.moveTo(centerX + arrowSize / 2, centerY);
			graphics.lineTo(centerX - arrowSize / 4, centerY - arrowSize / 3);
			graphics.lineTo(centerX - arrowSize / 4, centerY - arrowSize / 6);
			graphics.lineTo(centerX - arrowSize / 2, centerY - arrowSize / 6);
			graphics.lineTo(centerX - arrowSize / 2, centerY + arrowSize / 6);
			graphics.lineTo(centerX - arrowSize / 4, centerY + arrowSize / 6);
			graphics.lineTo(centerX - arrowSize / 4, centerY + arrowSize / 3);
			graphics.lineTo(centerX + arrowSize / 2, centerY);
			break;
		case "up":
			// Point upward
			graphics.moveTo(centerX, centerY - arrowSize / 2);
			graphics.lineTo(centerX + arrowSize / 3, centerY + arrowSize / 4);
			graphics.lineTo(centerX + arrowSize / 6, centerY + arrowSize / 4);
			graphics.lineTo(centerX + arrowSize / 6, centerY + arrowSize / 2);
			graphics.lineTo(centerX - arrowSize / 6, centerY + arrowSize / 2);
			graphics.lineTo(centerX - arrowSize / 6, centerY + arrowSize / 4);
			graphics.lineTo(centerX - arrowSize / 3, centerY + arrowSize / 4);
			graphics.lineTo(centerX, centerY - arrowSize / 2);
			break;
		case "down":
			// Point downward
			graphics.moveTo(centerX, centerY + arrowSize / 2);
			graphics.lineTo(centerX + arrowSize / 3, centerY - arrowSize / 4);
			graphics.lineTo(centerX + arrowSize / 6, centerY - arrowSize / 4);
			graphics.lineTo(centerX + arrowSize / 6, centerY - arrowSize / 2);
			graphics.lineTo(centerX - arrowSize / 6, centerY - arrowSize / 2);
			graphics.lineTo(centerX - arrowSize / 6, centerY - arrowSize / 4);
			graphics.lineTo(centerX - arrowSize / 3, centerY - arrowSize / 4);
			graphics.lineTo(centerX, centerY + arrowSize / 2);
			break;
	}

	graphics.fill({ color: fillColor });
	if (strokeColor !== undefined) {
		graphics.stroke({ color: strokeColor, width: 3 });
	}
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
				drawArrow(receptor, direction, COLUMN_WIDTH - 4, 60, 0x444444, color);
			}
			receptor.x = startX + col * COLUMN_WIDTH;
			receptor.y = RECEPTOR_Y - 20; // Center the taller arrow
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
					drawArrow(receptor, direction, COLUMN_WIDTH - 4, 60, fillColor, strokeColor);
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
					drawArrow(graphic, direction, COLUMN_WIDTH - 4, 60, color);
				}
				this.noteGraphics.set(state, graphic);
				this.noteField.addChild(graphic);
			}

			graphic.x = startX + state.note.column * COLUMN_WIDTH;
			graphic.y = y - 20; // Center the taller arrow
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
