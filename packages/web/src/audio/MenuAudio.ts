import * as Tone from "tone";
import { usePreferences } from "../stores/preferencesStore";

let synth: Tone.Synth | null = null;

function getSynth(): Tone.Synth {
	if (!synth) {
		synth = new Tone.Synth({
			oscillator: { type: "sine" },
			envelope: { attack: 0.001, decay: 0.05, sustain: 0, release: 0.05 },
		}).toDestination();
	}
	return synth;
}

export const menuAudio = {
	async init(): Promise<void> {
		await Tone.start();
	},

	playNavigate(): void {
		if (!usePreferences.getState().menuSounds) return;
		getSynth().triggerAttackRelease("C5", "32n");
	},

	playSelect(): void {
		if (!usePreferences.getState().menuSounds) return;
		getSynth().triggerAttackRelease("E5", "16n");
	},

	playCancel(): void {
		if (!usePreferences.getState().menuSounds) return;
		getSynth().triggerAttackRelease("G4", "16n");
	},
};
