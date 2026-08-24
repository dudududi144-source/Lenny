import { events, EVENTS } from './EventBus';

export interface WorldState {
  lights: number;
  emotion: 'calm' | 'joy' | 'frustrated';
  world: number;
}

const MAX_LIGHTS = 10;
const MIN_LIGHTS = 0;

class StateManagerClass {
  private state: WorldState = {
    lights: 0,
    emotion: 'calm',
    world: 0,
  };

  get(): WorldState {
    return { ...this.state };
  }

  getLights(): number {
    return this.state.lights;
  }

  getEmotion(): WorldState['emotion'] {
    return this.state.emotion;
  }

  getWorld(): number {
    return this.state.world;
  }

  setLights(value: number): void {
    const oldValue = this.state.lights;
    this.state.lights = Math.max(MIN_LIGHTS, Math.min(MAX_LIGHTS, Math.floor(value)));
    if (oldValue !== this.state.lights) {
      events.emit(EVENTS.STATE_LIGHTS_CHANGED, this.state.lights, oldValue);
    }
  }

  addLight(): number {
    this.setLights(this.state.lights + 1);
    return this.state.lights;
  }

  setEmotion(emotion: WorldState['emotion']): void {
    const oldValue = this.state.emotion;
    this.state.emotion = emotion;
    if (oldValue !== emotion) {
      events.emit(EVENTS.STATE_EMOTION_CHANGED, emotion, oldValue);
    }
  }

  setWorld(world: number): void {
    const oldValue = this.state.world;
    this.state.world = world;
    if (oldValue !== world) {
      events.emit(EVENTS.STATE_WORLD_CHANGED, world, oldValue);
    }
  }

  getWarmth(): number {
    return this.state.lights / MAX_LIGHTS;
  }

  isComplete(): boolean {
    return this.state.lights >= MAX_LIGHTS;
  }

  reset(): void {
    this.state = { lights: 0, emotion: 'calm', world: 0 };
    events.emit('state:reset');
  }
}

export const stateManager = new StateManagerClass();

// Backward compatibility - keep the old interface working
export const state = stateManager.get();
export function setLights(n: number) { stateManager.setLights(n); }
export function setEmotion(e: WorldState['emotion']) { stateManager.setEmotion(e); }
export function setWorld(w: number) { stateManager.setWorld(w); }
export function subscribe(f: () => void) { return events.on(EVENTS.STATE_LIGHTS_CHANGED, f); }
