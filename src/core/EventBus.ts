type EventCallback = (...args: any[]) => void;

class EventBusClass {
  private events: Map<string, Set<EventCallback>> = new Map();

  on(event: string, callback: EventCallback): () => void {
    if (!this.events.has(event)) {
      this.events.set(event, new Set());
    }
    this.events.get(event)!.add(callback);
    return () => this.events.get(event)?.delete(callback);
  }

  once(event: string, callback: EventCallback): () => void {
    const unsubscribe = this.on(event, (...args) => {
      callback(...args);
      unsubscribe();
    });
    return unsubscribe;
  }

  emit(event: string, ...args: any[]): void {
    this.events.get(event)?.forEach(callback => {
      try {
        callback(...args);
      } catch (e) {
        console.error(`Error in event listener for ${event}:`, e);
      }
    });
  }

  clear(event: string): void {
    this.events.delete(event);
  }

  clearAll(): void {
    this.events.clear();
  }
}

export const events = new EventBusClass();

export const EVENTS = {
  STATE_LIGHTS_CHANGED: 'state:lights:changed',
  STATE_EMOTION_CHANGED: 'state:emotion:changed',
  STATE_WORLD_CHANGED: 'state:world:changed',
  PUZZLE_OPENED: 'puzzle:opened',
  PUZZLE_SOLVED: 'puzzle:solved',
  PUZZLE_FAILED: 'puzzle:failed',
  MASCOT_POSITION: 'mascot:position:changed',
} as const;
