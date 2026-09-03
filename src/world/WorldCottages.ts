/* ============================================================
 * WorldCottages — the games become PLACES (stage 11).
 *
 * Every zone island now carries a small wooden cottage: warm
 * walls, a roof painted in the zone's color, a glowing door and
 * window, a tiny chimney. The child sees, from across the garden,
 * where the games live — walking up to an island already opened
 * its shelf (onArrive); now the shelf has a visible front door.
 *
 * Cottage meshes are named `plat-mesh-cottage-<zone>` so the tap
 * contract (WorldInput.pickKind accepts the `plat-mesh-` prefix)
 * walks the child to the island like a platform tap does.
 *
 * Zero assets, shared materials, merged per cottage, no animation
 * (the lanterns already glow; the cottages are calm).
 * ============================================================ */

import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial';
import { Color3 } from '@babylonjs/core/Maths/math.color';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode';
import { Mesh } from '@babylonjs/core/Meshes/mesh';
import type { Scene } from '@babylonjs/core/scene';
import { ZONES } from '../data/garden';
import { WORLD_ISLANDS } from './WorldLayout';

const hex = (s: string): Color3 => Color3.FromHexString(s);

export interface CottageHandle {
  /** the cottage roof materials by zone (the shelf's doorway tint) */
  dispose(): void;
}

export function buildCottages(scene: Scene): CottageHandle {
  const root = new TransformNode('cottages-root', scene);

  const wallMat = new StandardMaterial('ct-wall', scene);
  wallMat.diffuseColor = hex('#f0e0c0');
  wallMat.specularColor = new Color3(0.05, 0.045, 0.035);
  const doorMat = new StandardMaterial('ct-door', scene);
  doorMat.diffuseColor = hex('#8a5a33');
  doorMat.specularColor = new Color3(0.03, 0.03, 0.02);
  const chimneyMat = new StandardMaterial('ct-chimney', scene);
  chimneyMat.diffuseColor = hex('#9a978f');
  chimneyMat.specularColor = new Color3(0.04, 0.04, 0.04);
  const glowMat = new StandardMaterial('ct-glow', scene);
  glowMat.diffuseColor = hex('#fff3b0');
  glowMat.emissiveColor = hex('#ffd76a').scale(0.85);
  glowMat.specularColor = new Color3(0.05, 0.05, 0.02);
  const shared = [wallMat, doorMat, chimneyMat, glowMat];
  const roofMats: StandardMaterial[] = [];
  const allMeshes: Mesh[] = [];

  /* each cottage sits on the island edge FACING the previous island
     (the side the child arrives from) — journey-shaped, not scattered */
  for (let i = 0; i < ZONES.length; i++) {
    const zone = ZONES[i];
    const island = WORLD_ISLANDS.find((p) => p.zone === zone.id);
    if (!island) continue;

    /* approach direction: toward the previous island (or the center) */
    let ax = -island.x;
    let az = -island.z;
    if (i > 0) {
      const prev = WORLD_ISLANDS[i - 1];
      ax = prev.x - island.x;
      az = prev.z - island.z;
    }
    const alen = Math.hypot(ax, az) || 1;
    /* stand at the rim on the approach side, a touch inward */
    const off = island.radius - 0.85;
    const cx = island.x + (ax / alen) * off;
    const cz = island.z + (az / alen) * off;
    const faceYaw = Math.atan2(-ax / alen, -az / alen); /* door faces the walker */

    const parts: Mesh[] = [];
    const push = (m: Mesh): void => {
      parts.push(m);
      allMeshes.push(m);
    };

    const walls = MeshBuilder.CreateBox(`ct-${zone.id}-walls`, { width: 0.95, height: 0.62, depth: 0.8 }, scene);
    walls.position.set(cx, 0.31, cz);
    push(walls);

    /* the zone-colored roof: a squashed octahedron cone reads as a
       soft prism from every angle a child sees it */
    const roofMat = new StandardMaterial(`ct-${zone.id}-roof`, scene);
    const tint = Color3.FromHexString(zone.uiColor);
    roofMat.diffuseColor = Color3.Lerp(tint, hex('#79c356'), 0.2);
    roofMat.specularColor = new Color3(0.06, 0.05, 0.05);
    roofMats.push(roofMat);
    const roof = MeshBuilder.CreateCylinder(`ct-${zone.id}-roof`, { diameterTop: 0.04, diameterBottom: 1.15, height: 0.5, tessellation: 4 }, scene);
    roof.position.set(cx, 0.87, cz);
    roof.rotation.y = Math.PI / 4 + faceYaw;
    roof.material = roofMat;
    push(roof);

    const door = MeshBuilder.CreateBox(`ct-${zone.id}-door`, { width: 0.26, height: 0.4, depth: 0.05 }, scene);
    door.position.set(cx, 0.2, cz);
    door.material = doorMat;
    /* move the door to the approach face */
    door.position.x += (ax / alen) * 0.41;
    door.position.z += (az / alen) * 0.41;
    door.rotation.y = faceYaw;
    push(door);

    const windowGlow = MeshBuilder.CreateBox(`ct-${zone.id}-win`, { width: 0.18, height: 0.18, depth: 0.04 }, scene);
    windowGlow.position.set(cx - (az / alen) * 0.4 + (ax / alen) * 0.41, 0.4, cz + (ax / alen) * 0.4 + (az / alen) * 0.41);
    windowGlow.rotation.y = faceYaw;
    windowGlow.material = glowMat;
    push(windowGlow);

    const chimney = MeshBuilder.CreateBox(`ct-${zone.id}-chm`, { width: 0.14, height: 0.3, depth: 0.14 }, scene);
    chimney.position.set(cx + (az / alen) * 0.28, 0.95, cz - (ax / alen) * 0.28);
    chimney.material = chimneyMat;
    push(chimney);

    /* merge into ONE pickable mesh named like a platform — a tap on
       the cottage walks the child onto its island (pickKind rule) */
    const merged = Mesh.MergeMeshes(parts, true, false, undefined, false, true);
    if (merged) {
      merged.name = `plat-mesh-cottage-${zone.id}`;
      merged.parent = root;
      merged.isPickable = true;
      merged.position.setAll(0);
    } else {
      for (const m of parts) m.isPickable = true;
    }
  }

  return {
    dispose() {
      for (const m of allMeshes) m.dispose();
      root.dispose(false, true);
      for (const m of shared) m.dispose();
      for (const m of roofMats) m.dispose();
    },
  };
}
