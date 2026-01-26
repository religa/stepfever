/**
 * EventRegistry provides centralized event listener management with guaranteed cleanup.
 *
 * Usage:
 *   const events = new EventRegistry();
 *   events.on(window, "keydown", handleKeyDown);
 *   events.on(document, "click", handleClick);
 *   // Later, clean up all listeners at once:
 *   events.dispose();
 */

type EventCleanup = () => void;

export class EventRegistry {
	private cleanups: EventCleanup[] = [];

	/**
	 * Register an event listener on a Window target.
	 * The listener will be automatically removed when dispose() is called.
	 */
	on<K extends keyof WindowEventMap>(
		target: Window,
		event: K,
		handler: (e: WindowEventMap[K]) => void,
		options?: boolean | AddEventListenerOptions,
	): void;

	/**
	 * Register an event listener on a Document target.
	 * The listener will be automatically removed when dispose() is called.
	 */
	on<K extends keyof DocumentEventMap>(
		target: Document,
		event: K,
		handler: (e: DocumentEventMap[K]) => void,
		options?: boolean | AddEventListenerOptions,
	): void;

	/**
	 * Register an event listener on an HTMLElement target.
	 * The listener will be automatically removed when dispose() is called.
	 */
	on<K extends keyof HTMLElementEventMap>(
		target: HTMLElement,
		event: K,
		handler: (e: HTMLElementEventMap[K]) => void,
		options?: boolean | AddEventListenerOptions,
	): void;

	/**
	 * Generic implementation for all targets.
	 */
	on(
		target: Window | Document | HTMLElement,
		event: string,
		handler: EventListener,
		options?: boolean | AddEventListenerOptions,
	): void {
		target.addEventListener(event, handler, options);
		this.cleanups.push(() => {
			target.removeEventListener(event, handler, options);
		});
	}

	/**
	 * Remove all registered event listeners.
	 * Safe to call multiple times.
	 */
	dispose(): void {
		for (const cleanup of this.cleanups) {
			cleanup();
		}
		this.cleanups = [];
	}

	/**
	 * Returns the number of registered listeners.
	 * Useful for debugging.
	 */
	get size(): number {
		return this.cleanups.length;
	}
}
