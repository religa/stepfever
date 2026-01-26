import type { SpeedModifier } from "@stepfever/core";
import { SPEED_PRESETS } from "@stepfever/core";
import { menuAudio } from "../audio/MenuAudio";
import { escapeHtml } from "../utils/html";
import { getMenuAction } from "../utils/input";

export interface SpeedModSelectorOptions {
	container: HTMLElement;
	currentModifier: SpeedModifier | null;
	onSelect: (modifier: SpeedModifier | null) => void;
}

/**
 * SpeedModSelector - UI component for selecting speed modifiers
 */
export class SpeedModSelector {
	private container: HTMLElement;
	private currentModifier: SpeedModifier | null;
	private onSelect: (modifier: SpeedModifier | null) => void;
	private elements: HTMLElement[] = [];
	private keyHandler?: (e: KeyboardEvent) => void;
	private selectedIndex = 0; // 0 = Default, 1+ = presets
	private presetKeys: string[];

	constructor(options: SpeedModSelectorOptions) {
		this.container = options.container;
		this.currentModifier = options.currentModifier;
		this.onSelect = options.onSelect;
		this.presetKeys = Object.keys(SPEED_PRESETS);

		// Find current index (0 = Default, 1+ = presets)
		if (this.currentModifier) {
			const currentKey = this.findPresetKey(this.currentModifier);
			if (currentKey) {
				const index = this.presetKeys.indexOf(currentKey);
				if (index >= 0) {
					this.selectedIndex = index + 1; // Offset by 1 for Default option
				}
			}
		}
	}

	mount(): void {
		this.render();
		this.attachListeners();
	}

	unmount(): void {
		this.detachListeners();
		this.container.innerHTML = "";
		this.elements = [];
	}

	private findPresetKey(modifier: SpeedModifier): string | null {
		for (const [key, preset] of Object.entries(SPEED_PRESETS)) {
			if (preset.type === modifier.type) {
				if (preset.type === "xmod" && modifier.type === "xmod") {
					if (preset.multiplier === modifier.multiplier) {
						return key;
					}
				} else if (preset.type === "cmod" && modifier.type === "cmod") {
					if (preset.pixelsPerSecond === modifier.pixelsPerSecond) {
						return key;
					}
				}
			}
		}
		return null;
	}

	private render(): void {
		this.container.innerHTML = `
			<div class="speed-mod-selector">
				<h3>Speed Modifier</h3>
				<div class="speed-mod-list" id="speed-mod-list"></div>
				<p class="hint">↑/↓: Navigate | Enter: Select | Esc: Back</p>
			</div>
		`;

		const listContainer = this.container.querySelector("#speed-mod-list");
		if (!listContainer) return;

		this.elements = [];

		// Add "Default (1.0x)" option
		const defaultItem = document.createElement("div");
		defaultItem.className = "speed-mod-item";
		defaultItem.textContent = "Default (1.0x)";
		if (this.currentModifier === null) {
			defaultItem.classList.add("selected");
		}
		if (this.selectedIndex === 0) {
			defaultItem.classList.add("active");
		}
		listContainer.appendChild(defaultItem);
		this.elements.push(defaultItem);

		// Add presets
		this.presetKeys.forEach((key, index) => {
			const preset = SPEED_PRESETS[key];
			if (!preset) return;

			const item = document.createElement("div");
			item.className = "speed-mod-item";

			const label = key;
			const description =
				preset.type === "xmod"
					? `${Number.parseFloat(preset.multiplier.toFixed(2))}x speed`
					: `${preset.pixelsPerSecond} px/s`;

			item.innerHTML = `
				<span class="speed-mod-label">${escapeHtml(label)}</span>
				<span class="speed-mod-description">${escapeHtml(description)}</span>
			`;

			// Highlight current selection
			const currentKey = this.currentModifier ? this.findPresetKey(this.currentModifier) : null;
			if (currentKey === key) {
				item.classList.add("selected");
			}

			// Highlight active (keyboard navigation)
			// selectedIndex 0 = Default, 1 = first preset, etc.
			if (this.selectedIndex === index + 1) {
				item.classList.add("active");
			}

			listContainer.appendChild(item);
			this.elements.push(item);
		});

		this.updateActive();
	}

	private updateActive(): void {
		this.elements.forEach((el, index) => {
			// selectedIndex is 0-based for presets, -1 for default
			if (index === this.selectedIndex) {
				el.classList.add("active");
			} else {
				el.classList.remove("active");
			}
		});
	}

	private attachListeners(): void {
		this.keyHandler = (e: KeyboardEvent) => {
			const action = getMenuAction(e.key);
			if (!action) return;

			e.preventDefault();
			switch (action) {
				case "UP":
					menuAudio.playNavigate();
					// 0 = Default, so min is 0
					this.selectedIndex = Math.max(0, this.selectedIndex - 1);
					this.updateActive();
					break;
				case "DOWN":
					menuAudio.playNavigate();
					// Max is presetKeys.length (Default + all presets)
					this.selectedIndex = Math.min(this.presetKeys.length, this.selectedIndex + 1);
					this.updateActive();
					break;
				case "CONFIRM":
					menuAudio.playSelect();
					this.selectCurrent();
					break;
				// BACK is handled by parent screen (SpeedModSelectScreen)
			}
		};

		window.addEventListener("keydown", this.keyHandler);

		// Click handlers for items
		this.elements.forEach((el, index) => {
			el.addEventListener("click", () => {
				menuAudio.playSelect();
				this.selectedIndex = index;
				this.updateActive();
				this.selectCurrent();
			});
		});
	}

	private detachListeners(): void {
		if (this.keyHandler) {
			window.removeEventListener("keydown", this.keyHandler);
		}
	}

	private selectCurrent(): void {
		if (this.selectedIndex === 0) {
			// Default selected
			this.onSelect(null);
			return;
		}

		// selectedIndex 1+ maps to preset indices 0+
		const key = this.presetKeys[this.selectedIndex - 1];
		const preset = key ? SPEED_PRESETS[key] : null;
		if (preset) {
			this.onSelect(preset);
		}
	}
}
