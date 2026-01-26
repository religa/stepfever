export interface Viewport {
	x: number;
	y: number;
	width: number;
	height: number;
	playerId: number;
}

export class LayoutManager {
	private canvasWidth: number;
	private canvasHeight: number;

	constructor(canvasWidth: number, canvasHeight: number) {
		if (canvasWidth <= 0 || canvasHeight <= 0) {
			throw new Error("Canvas dimensions must be positive");
		}
		this.canvasWidth = canvasWidth;
		this.canvasHeight = canvasHeight;
	}

	/**
	 * Calculate viewport layouts for 1-4 players
	 * All layouts use vertical splits to preserve vertical space for note scrolling
	 * Single player (1) uses fullscreen viewport
	 */
	calculateViewports(playerCount: number): Viewport[] {
		if (playerCount < 1 || playerCount > 4) {
			throw new Error("Player count must be 1-4");
		}

		switch (playerCount) {
			case 1:
				return this.layoutOnePlayer();
			case 2:
				return this.layoutTwoPlayers();
			case 3:
				return this.layoutThreePlayers();
			case 4:
				return this.layoutFourPlayers();
			default:
				throw new Error("Invalid player count");
		}
	}

	private layoutOnePlayer(): Viewport[] {
		// Fullscreen: single player uses entire canvas
		return [
			{
				x: 0,
				y: 0,
				width: this.canvasWidth,
				height: this.canvasHeight,
				playerId: 0,
			},
		];
	}

	private layoutTwoPlayers(): Viewport[] {
		// Vertical split: 50% width each, full height
		const halfWidth = this.canvasWidth / 2;

		return [
			{
				x: 0,
				y: 0,
				width: halfWidth,
				height: this.canvasHeight,
				playerId: 0,
			},
			{
				x: halfWidth,
				y: 0,
				width: halfWidth,
				height: this.canvasHeight,
				playerId: 1,
			},
		];
	}

	private layoutThreePlayers(): Viewport[] {
		// Vertical split: 33.3% width each, full height
		const thirdWidth = this.canvasWidth / 3;

		return [
			{
				x: 0,
				y: 0,
				width: thirdWidth,
				height: this.canvasHeight,
				playerId: 0,
			},
			{
				x: thirdWidth,
				y: 0,
				width: thirdWidth,
				height: this.canvasHeight,
				playerId: 1,
			},
			{
				x: thirdWidth * 2,
				y: 0,
				width: thirdWidth,
				height: this.canvasHeight,
				playerId: 2,
			},
		];
	}

	private layoutFourPlayers(): Viewport[] {
		// Vertical split: 25% width each, full height
		const quarterWidth = this.canvasWidth / 4;

		return [
			{
				x: 0,
				y: 0,
				width: quarterWidth,
				height: this.canvasHeight,
				playerId: 0,
			},
			{
				x: quarterWidth,
				y: 0,
				width: quarterWidth,
				height: this.canvasHeight,
				playerId: 1,
			},
			{
				x: quarterWidth * 2,
				y: 0,
				width: quarterWidth,
				height: this.canvasHeight,
				playerId: 2,
			},
			{
				x: quarterWidth * 3,
				y: 0,
				width: quarterWidth,
				height: this.canvasHeight,
				playerId: 3,
			},
		];
	}

	setCanvasSize(width: number, height: number): void {
		if (width <= 0 || height <= 0) {
			throw new Error("Canvas dimensions must be positive");
		}
		this.canvasWidth = width;
		this.canvasHeight = height;
	}
}
