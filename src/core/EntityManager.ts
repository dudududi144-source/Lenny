export interface Component {
  update(dt: number): void;
}

export class Entity {
  id: string;
  components: Map<string, Component> = new Map();
  active: boolean = true;

  constructor(id: string) {
    this.id = id;
  }

  addComponent<T extends Component>(name: string, component: T): T {
    this.components.set(name, component);
    return component;
  }

  getComponent<T extends Component>(name: string): T | undefined {
    return this.components.get(name) as T | undefined;
  }

  removeComponent(name: string): void {
    this.components.delete(name);
  }

  update(dt: number): void {
    if (!this.active) return;
    for (const component of this.components.values()) {
      component.update(dt);
    }
  }
}

class EntityManagerClass {
  private entities: Map<string, Entity> = new Map();

  createEntity(id: string): Entity {
    const entity = new Entity(id);
    this.entities.set(id, entity);
    return entity;
  }

  getEntity(id: string): Entity | undefined {
    return this.entities.get(id);
  }

  removeEntity(id: string): void {
    this.entities.delete(id);
  }

  updateAll(dt: number): void {
    for (const entity of this.entities.values()) {
      entity.update(dt);
    }
  }

  clear(): void {
    this.entities.clear();
  }
}

export const entityManager = new EntityManagerClass();
