import Phaser from 'phaser';
import { entityManager } from '../core/EntityManager';
import { stateManager } from '../core/StateManager';
import { events } from '../core/EventBus';
import { createMascot } from '../entities/Mascot';
import { drawAurora } from '../fx/aurora';
import { drawDiorama } from '../fx/diorama';
import { loadSave, storeSave } from '../systems/save';
import worldsData from '../content/worlds.json';

export class WorldScene extends Phaser.Scene {
  private bg!: Phaser.GameObjects.Graphics;
  private diorama!: Phaser.GameObjects.Graphics;
  private mascot: any;
  private lights: number = 0;
  private world: number = 0;

  constructor() {
    super('world');
  }

  create(): void {
    entityManager.clear();
    
    // Load saved state
    const save = loadSave();
    stateManager.setLights(save.lights);
    this.lights = stateManager.getLights();
    this.world = stateManager.getWorld();
    
    // Create graphics layers
    this.bg = this.add.graphics();
    this.diorama = this.add.graphics();
    
    // Create mascot
    const w = this.scale.width;
    const h = this.scale.height;
    this.mascot = createMascot(this, w * 0.2, h * 0.62);
    
    // Listen to state changes
    events.on('state:lights:changed', (lights: number) => {
      this.lights = lights;
    });
    
    // Setup input
    this.setupInput();
    
    // Show world name
    const worldData = (worldsData.worlds as any[])[this.world];
    if (worldData) {
      const speech = this.add.text(w/2, h * 0.14, String(worldData.line), {
        fontFamily: 'Heebo',
        fontSize: '16px',
        color: '#FFF6EC'
      }).setOrigin(0.5);
      this.time.delayedCall(2600, () => speech.setVisible(false));
    }
  }

  private setupInput(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      const movement = this.mascot.getComponent('movement');
      if (!movement) return;

      const fx = pointer.x / this.scale.width;
      if (fx < 0.34) {
        movement.moveLeft();
      } else if (fx > 0.66) {
        movement.moveRight();
      } else {
        movement.jump();
      }
    });

    this.input.on('pointerup', () => {
      const movement = this.mascot.getComponent('movement');
      if (movement) {
        movement.stop();
      }
    });
  }

  update(time: number): void {
    const dt = this.game.loop.delta / 1000;
    const w = this.scale.width;
    const h = this.scale.height;
    const t = time * 0.001;
    
    // Update all entities
    entityManager.updateAll(dt);
    
    // Render background effects (the high-quality code we kept)
    drawAurora(this.bg, w, h, t, this.lights);
    drawDiorama(this.diorama, w, h, t, 0, this.lights);
  }
}
