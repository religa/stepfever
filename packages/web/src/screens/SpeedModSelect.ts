import type { SpeedModifier } from "@stepfever/core";
import { menuAudio } from "../audio/MenuAudio";
import { SpeedModSelector } from "../components/SpeedModSelector";
import { useAppStore } from "../stores/appStore";
import type { Screen } from "./ScreenManager";

export class SpeedModSelectScreen implements Screen {
	private container: HTMLElement | null = null;
	private onNavigate: (screen: string) => void;
	private selector: SpeedModSelector | null = null;
	private handleKeydown: ((e: KeyboardEvent) => void) | null = null;

	constructor(onNavigate: (screen: string) => void) {
		this.onNavigate = onNavigate;
	}

	mount(container: HTMLElement): void {
		this.container = container;

		const currentModifier = useAppStore.getState().speedModifier;

		this.selector = new SpeedModSelector({
			container,
			currentModifier,
			onSelect: (modifier: SpeedModifier | null) => {
				useAppStore.getState().setSpeedModifier(modifier);
				this.onNavigate("settings");
			},
		});

		this.selector.mount();

		// Setup keyboard handler for ESC
		this.handleKeydown = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				menuAudio.playCancel();
				this.onNavigate("settings");
			}
		};
		window.addEventListener("keydown", this.handleKeydown);
	}

	unmount(): void {
		// Cleanup keyboard handler
		if (this.handleKeydown) {
			window.removeEventListener("keydown", this.handleKeydown);
			this.handleKeydown = null;
		}

		if (this.selector) {
			this.selector.unmount();
			this.selector = null;
		}

		if (this.container) {
			this.container.innerHTML = "";
		}
	}
}
