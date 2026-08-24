import Phaser from 'phaser';
import { Entity, Component, entityManager } from '../core/EntityManager';
import { events } from '../core/EventBus';

export class MascotMovementComponent implements Component {
  x: number;
  y: number;
  velocityX: number = 0;
  velocityY: number = 0;
  baseY: number;
  gravity: number = 900;

  constructor(startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
    this.baseY = startY;
  }

  update(dt: number): void {
    this.velocityY += this.gravity * dt;
    this.x += this.velocityX * dt;
    this.y += this.velocityY * dt;

    this.y = Math.min(this.baseY, this.y);
    if (this.y >= this.baseY) {
      this.velocityY = 0;
    }

    events.emit('mascot:position:changed', this.x, this.y);
  }

  jump(): void {
    this.velocityY = -260;
  }

  moveLeft(): void {
    this.velocityX = -240;
  }

  moveRight(): void {
    this.velocityX = 240;
  }

  stop(): void {
    this.velocityX = 0;
  }
}

export class MascotRenderComponent implements Component {
  private graphics: Phaser.GameObjects.Graphics;
  private x: number = 0;
  private y: number = 0;
  private emotion: string = 'calm';

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics();
    
    events.on('mascot:position:changed', (x: number, y: number) => {
      this.x = x;
      this.y = y;
    });

    events.on('state:emotion:changed', (emotion: string) => {
      this.emotion = emotion;
    });
  }

  update(dt: number): void {
    this.graphics.clear();
    this.drawMascot();
  }

  private drawMascot(): void {
    const g = this.graphics;
    const col = this.getColorForEmotion();
    
    // Body
    g.fillStyle(col, 1);
    g.fillCircle(this.x, this.y - 20, 14); // head
    g.fillRect(this.x - 10, this.y - 8, 20, 30); // body
    
    // Face expression
    this.drawExpression(g);
  }

  private getColorForEmotion(): number {
    switch (this.emotion) {
      case 'joy': return 0xffd76a;
      case 'frustrated': return 0xf2549a;
      default: return 0x8d5a3b;
    }
  }

  private drawExpression(g: Phaser.GameObjects.Graphics): void {
    const eyeY = this.y - 24;
    const mouthY = this.y - 14;
    
    // Eyes
    g.fillStyle(0xffffff, 1);
    g.fillCircle(this.x - 5, eyeY, 3);
    g.fillCircle(this.x + 5, eyeY, 3);
    
    // Mouth based on emotion
    g.lineStyle(2, 0x000000, 1);
    if (this.emotion === 'joy') {
      g.beginPath();
      g.arc(this.x, mouthY, 5, 0, Math.PI, false);
      g.strokePath();
    } else if (this.emotion === 'frustrated') {
      g.beginPath();
      g.arc(this.x, mouthY + 10, 5, Math.PI, Math.PI * 2, false);
      g.strokePath();
    } else {
      g.beginPath();
      g.moveTo(this.x - 5, mouthY);
      g.lineTo(this.x + 5, mouthY);
      g.strokePath();
    }
  }
}

export function createMascot(scene: Phaser.Scene, startX: number, startY: number): Entity {
  const mascot = entityManager.createEntity('mascot');
  mascot.addComponent('movement', new MascotMovementComponent(startX, startY));
  mascot.addComponent('render', new MascotRenderComponent(scene));
  return mascot;
}
