/* ============================================================
 * WorldBalloon — the vista ride (stage 13).
 *
 * The owner asked for נוף: a way to SEE the wide world, not only
 * walk it. A small hot-air balloon waits at the edge of the home
 * meadow; a child who walks to it rises over the whole continent,
 * circles past the far regions, and lands back where she took off.
 *
 * ETHICS unchanged:
 *   - the ride is a VIEW, never a gate: walking everywhere stays
 *     possible and free; the balloon cannot carry the child INTO
 *     a locked island (the circle sweeps above the ring and lands
 *     at the pad it left)
 *   - flights over zones count as NOTHING: no visits, no arrivals
 *     mid-air — honesty of the ledger survives the ride
 *   - the child is always in control: the ride is calm, ends by
 *     itself, and every tap/key is ignored only while airborne
 *
 * The path math is pure and exported so the tests can pin the
 * journey: it leaves the pad and returns to the pad, exactly.
 * ============================================================ */

import {
  MeshBuilder,
  Mesh,
  Scene,
  StandardMaterial,
  Color3,
} from '@babylonjs/core';

/* ---------- the pure journey ---------- */

/** A full flight lasts this long — a real journey, not a flash. */
export const RIDE_MS = 30_000;

/** The cruise altitude over the continent (world units) — 14-C: the
 *  regions stand 340-450u out; the basket must climb over their hills. */
export const RIDE_ALT = 112;

/** The cruise ring radius — threaded between the region ring and
 *  the mountain horizon (14-C geography: the six regions span
 *  210-570u from the hub, so the ring sweeps right over them). */
export const RIDE_RADIUS = 460;

/** How far around the world one flight sweeps — exactly two full
    calm turns, so the ending angle comes home to the pad's angle. */
const SWEEP = Math.PI * 4;

const smooth = (k: number): number => {
  const x = Math.max(0, Math.min(1, k));
  return x * x * (3 - 2 * x);
};

/** rise → hold → fall, exactly 0 at both ends (pure). */
function bell(k: number): number {
  if (k <= 0.22) return smooth(k / 0.22);
  if (k >= 0.78) return smooth((1 - k) / 0.22);
  return 1;
}

export interface BalloonPose {
  x: number;
  z: number;
  /** height ABOVE the terrain-following ground at (x,z) */
  alt: number;
  /** heading of travel (radians, atan2 convention) */
  facing: number;
}

/**
 * The flight path: from the pad, a spiral out to the cruise ring,
 * ~1.4 calm turns over the regions, a spiral back — and the basket
 * touches the same pad it left. Pure: same inputs, same flight.
 */
export function balloonPose(k: number, padX: number, padZ: number): BalloonPose {
  const t = Math.max(0, Math.min(1, k));
  const r0 = Math.hypot(padX, padZ);
  const theta0 = Math.atan2(padZ, padX);

  const sweep = SWEEP * smooth(t);
  const theta = theta0 + sweep;

  /* radius: out to the cruise ring, hold, home again */
  const b = bell(t);
  const r = r0 + (RIDE_RADIUS - r0) * b;

  /* altitude: the same bell, softened — up over the hills, down soft */
  const alt = RIDE_ALT * (b * 0.92 + 0.08 * Math.sin(Math.PI * t));

  return {
    x: Math.cos(theta) * r,
    z: Math.sin(theta) * r,
    alt,
    facing: theta + Math.PI / 2, /* tangent of the circle */
  };
}

/** True once per ride-start request (cleared on read by the world). */
export interface WorldBalloonHandle {
  /** per-frame: bob at the pad, or fly the ride. No allocs steady-state. */
  update(now: number, dt: number, rideK: number | null): void;
  /** standard+ only: a gentle canopy sway while parked (weak keeps today's bob). */
  setSway(on: boolean): void;
  /** the pad a child walks to (also the landing spot). */
  pad(): { x: number; z: number };
  /** distance-squared from the fox to the pad (cheap proximity test). */
  padDistSq(x: number, z: number): number;
  /** the balloon meshes, for the distance culling pass. */
  meshes(): readonly Mesh[];
  dispose(): void;
}

/** Build the balloon + its landing pad near the given meadow spot. */
export function createWorldBalloon(scene: Scene, padX: number, padZ: number): WorldBalloonHandle {
  const rootY = 0;

  /* ---------- the landing pad — a round wooden deck ----------
     Named `balloon-…` like every part of the balloon: a tap on the
     deck is ONE errand with ONE destination — the pad's exact
     center — never a snapped point beside it (the resolveWalkTarget
     keep-out once parked the fox 2 units short and the flight never
     came; the deck now speaks for itself). */
  const pad = MeshBuilder.CreateDisc('balloon-pad-deck', { radius: 2.2, tessellation: 26 }, scene);
  pad.rotation.x = Math.PI / 2;
  const plankMat = scene.getMaterialByName('rg-plank') as StandardMaterial | null;
  if (plankMat) pad.material = plankMat;
  pad.isPickable = true;

  /* the pad ring — a painted promise this deck goes somewhere */
  const rim = MeshBuilder.CreateTorus('balloon-pad-rim', { diameter: 4.5, thickness: 0.1, tessellation: 26 }, scene);
  rim.scaling.y = 0.35;
  rim.position.y = 0.06;
  const rimMat = new StandardMaterial('balloon-rim-mat', scene);
  rimMat.emissiveColor = Color3.FromHexString('#ffd76a');
  rimMat.diffuseColor = Color3.Black();
  rimMat.specularColor = Color3.Black();
  rimMat.disableLighting = true;
  rimMat.alpha = 0.6;
  rim.material = rimMat;
  rim.isPickable = false;
  rim.parent = pad;

  /* ---------- the balloon itself (14-C: a hero of the ladder —
     canopy ~6.4u, the whole rig reads from across the meadow) ---------- */
  const balloon = new Mesh('balloon-root', scene);
  balloon.isPickable = false;

  const canopy = MeshBuilder.CreateSphere('balloon-canopy', { diameter: 6.4, segments: 12 }, scene);
  canopy.scaling.y = 1.18;
  canopy.position.y = 8.6;
  canopy.material = defaultBalloonMat(scene);
  /* every part of the balloon is a button for "fly": pickable under
     the `balloon-` name contract (WorldInput resolves it to the deck) */
  canopy.isPickable = true;
  canopy.parent = balloon;

  const ropeMat = plankMat;
  for (let i = 0; i < 4; i += 1) {
    const ang = (i / 4) * Math.PI * 2;
    const rope = MeshBuilder.CreateCylinder(
      `balloon-rope-${i}`,
      { height: 3.0, diameter: 0.06, tessellation: 5 },
      scene,
    );
    rope.position.set(Math.cos(ang) * 1.0, 5.35, Math.sin(ang) * 1.0);
    rope.rotation.z = Math.cos(ang) * 0.16;
    rope.rotation.x = -Math.sin(ang) * 0.16;
    if (ropeMat) {
      rope.material = ropeMat;
    } else {
      rope.material = defaultRopeMat(scene);
    }
    rope.isPickable = true;
    rope.parent = balloon;
  }

  const basket = MeshBuilder.CreateBox('balloon-basket', { width: 2.0, height: 1.35, depth: 2.0 }, scene);
  basket.position.y = 3.35;
  basket.material = ropeMat ?? defaultRopeMat(scene);
  basket.isPickable = true;
  basket.parent = balloon;

  /* the burner's warm glow — the balloon reads alive from afar */
  const flame = MeshBuilder.CreateSphere('balloon-flame', { diameter: 0.75, segments: 6 }, scene);
  flame.position.y = 4.7;
  flame.material = defaultFlameMat(scene);
  flame.isPickable = true;
  flame.parent = balloon;

  balloon.position.set(padX, rootY, padZ);

  /* ---------- state ---------- */

  /* stage 15-D: the atmosphere tiers add a slow canopy tilt while the
     balloon waits at the pad — it reads as wind, not wobble. Weak tier
     (and every flight) keeps the exact historical motion. */
  let sway = false;

  const handle: WorldBalloonHandle = {
    update(now, _dt, rideK) {
      if (rideK !== null) {
        const p = balloonPose(rideK, padX, padZ);
        balloon.position.set(p.x, 0, p.z);
        /* the terrain rides with the land; the basket clears the hills */
        balloon.position.y = p.alt - 3.1;
        balloon.rotation.y = -p.facing;
        return;
      }
      /* idle: the balloon breathes at the pad, tugging upward softly */
      const t = now / 1000;
      balloon.position.set(padX, rootY + Math.sin(t * 0.9) * 0.12, padZ);
      balloon.rotation.y = Math.sin(t * 0.23) * 0.3;
      if (sway) {
        balloon.rotation.z = Math.sin(t * 0.47) * 0.045;
        balloon.rotation.x = Math.cos(t * 0.36) * 0.03;
      }
    },
    setSway(on: boolean): void {
      sway = on;
      if (!on) {
        balloon.rotation.x = 0;
        balloon.rotation.z = 0;
      }
    },
    pad: () => ({ x: padX, z: padZ }),
    padDistSq: (x, z) => (x - padX) * (x - padX) + (z - padZ) * (z - padZ),
    meshes: () => [pad, rim, canopy, basket, flame],
    dispose(): void {
      balloon.dispose(false, true);
      pad.dispose(false, true);
    },
  };

  return handle;
}

/* ---------- shared-material fallbacks (the world builds them first;
   the fallbacks keep the balloon honest in isolation tests) ---------- */

function defaultRopeMat(scene: Scene): StandardMaterial {
  const m = scene.getMaterialByName('balloon-rope-mat') as StandardMaterial | null;
  if (m) return m;
  const mat = new StandardMaterial('balloon-rope-mat', scene);
  mat.diffuseColor = Color3.FromHexString('#8a5a33');
  mat.specularColor = new Color3(0.03, 0.03, 0.03);
  return mat;
}

function defaultBalloonMat(scene: Scene): StandardMaterial {
  const m = scene.getMaterialByName('balloon-canopy-mat') as StandardMaterial | null;
  if (m) return m;
  const mat = new StandardMaterial('balloon-canopy-mat', scene);
  mat.diffuseColor = Color3.FromHexString('#e8b04b');
  mat.emissiveColor = Color3.FromHexString('#5a3c14').scale(0.6);
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  return mat;
}

function defaultFlameMat(scene: Scene): StandardMaterial {
  const m = scene.getMaterialByName('balloon-flame-mat') as StandardMaterial | null;
  if (m) return m;
  const mat = new StandardMaterial('balloon-flame-mat', scene);
  mat.emissiveColor = Color3.FromHexString('#ffd76a');
  mat.diffuseColor = Color3.Black();
  mat.disableLighting = true;
  return mat;
}

