// Port of linerider-advanced: src/Game/Physics/Rider.cs, SimulationPoint.cs,
// ImmutablePointCollection.cs, Bone.cs.
import {
  BONE_DEFS,
  BodyShoulder,
  CELL_SIZE,
  DEFAULT_RIDER,
  DEFAULT_SCARF,
  ENDURANCE_FACTOR,
  GRAVITY_X,
  GRAVITY_Y,
  SCARF_BONES,
  SledBL,
  SledTL,
  SledTR,
  BodyButt,
  pointFriction,
} from './constants.js';

// A simulation point: location (x,y), previous (px,py), momentum (mx,my),
// friction f. Rider states are treated as immutable; every step makes copies.
function pt(x, y, px, py, mx, my, f) {
  return { x, y, px, py, mx, my, f };
}

// SimulationPoint.Step
function step(p) {
  const mx = p.x - p.px + GRAVITY_X;
  const my = p.y - p.py + GRAVITY_Y;
  return pt(p.x + mx, p.y + my, p.x, p.y, mx, my, p.f);
}
// SimulationPoint.StepFriction
function stepFriction(p) {
  const mx = (p.x - p.px) * p.f + GRAVITY_X;
  const my = (p.y - p.py) * p.f + GRAVITY_Y;
  return pt(p.x + mx, p.y + my, p.x, p.y, mx, my, p.f);
}

/** Track.GenerateBones: rest lengths are measured from the actual start pose. */
export function generateBones(startX, startY) {
  const joints = DEFAULT_RIDER.map(([x, y]) => [x + startX, y + startY]);
  return BONE_DEFS.map(([a, b, breakable, onlyRepel]) => {
    const dx = joints[a][0] - joints[b][0];
    const dy = joints[a][1] - joints[b][1];
    let rest = Math.sqrt(dx * dx + dy * dy);
    if (onlyRepel) rest *= 0.5;
    return { joint1: a, joint2: b, rest, breakable, onlyRepel };
  });
}

/** Rider.Create */
export function createRider(startX, startY, momX, momY) {
  const body = DEFAULT_RIDER.map(([dx, dy], i) => {
    const cx = dx + startX;
    const cy = dy + startY;
    return pt(cx, cy, cx - momX, cy - momY, 0, 0, pointFriction(i));
  });
  const s0 = body[BodyShoulder];
  const scarf = [{ ...s0 }];
  for (const [dx, dy] of DEFAULT_SCARF) {
    const x = s0.x + dx;
    const y = s0.y + dy;
    scarf.push(pt(x, y, x, y, 0, 0, 0.9));
  }
  return { body, scarf, crashed: false, sledBroken: false };
}

// Rider.ProcessBones
function processBones(bones, body, state) {
  for (let i = 0; i < bones.length; i++) {
    const bone = bones[i];
    const a = body[bone.joint1];
    const b = body[bone.joint2];
    let dx = a.x - b.x;
    let dy = a.y - b.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    if (!bone.onlyRepel || len < bone.rest) {
      let scalar = ((len - bone.rest) / len) * 0.5;
      if (scalar === Infinity || scalar === -Infinity) scalar = 0;
      if (bone.breakable && (state.dead || scalar > bone.rest * ENDURANCE_FACTOR)) {
        state.dead = true;
        if (state.breaks) state.breaks.push(i);
      } else {
        dx *= scalar;
        dy *= scalar;
        a.x = a.x + -dx;
        a.y = a.y + -dy;
        b.x = b.x + dx;
        b.y = b.y + dy;
      }
    }
  }
}

// Rider.ProcessLines
function processLines(grid, body, collisions) {
  for (let i = 0; i < body.length; i++) {
    const p = body[i];
    const cellx = Math.floor(p.x / CELL_SIZE);
    const celly = Math.floor(p.y / CELL_SIZE);
    for (let x = -1; x <= 1; x++) {
      for (let y = -1; y <= 1; y++) {
        const cell = grid.getCell(cellx + x, celly + y);
        if (!cell) continue;
        for (let j = 0; j < cell.length; j++) {
          if (cell[j].interact(p) && collisions) collisions.add(cell[j].id);
        }
      }
    }
  }
}

// ---- scarf (cosmetic; ported for the look) ----
const F_RAD2DEG = Math.fround(57.2957764);
const F_DEG2RAD = Math.fround(0.0174532924);
const TAU = Math.PI * 2;
function normDeg(d) {
  d %= 360;
  if (d < 0) {
    d = d % -360;
    d = 360 + d;
  }
  return d;
}
function degFromVector(x, y) {
  let r = Math.atan2(y, x);
  r %= TAU;
  if (r < 0) {
    r = r % -TAU;
    r = TAU + r;
  }
  return normDeg(r * F_RAD2DEG);
}
function fastrand(seed) {
  seed = (Math.imul(214013, seed) + 2531011) | 0;
  return (seed >> 16) & 0x7fff;
}
function flutterScarf(scarf, frameid, momentum) {
  let baseoffset = frameid;
  baseoffset += Math.trunc(frameid / 20);
  const rate = 20 - Math.trunc(14 * Math.min(1, momentum / 100));
  const offset = baseoffset % rate;
  for (let i = 1; i < scarf.length; i++) {
    const scalar = (i - 1.0) / (scarf.length - 1);
    const radian = scalar * (Math.PI * 4) + offset;
    const deg = normDeg(degFromVector(scarf[i].x - scarf[i - 1].x, scarf[i].y - scarf[i - 1].y) + Math.cos(radian) * 90);
    const rad = deg * F_DEG2RAD;
    let fx = 2 * Math.cos(rad);
    let fy = 2 * Math.sin(rad);
    fx *= momentum / 100;
    fy *= momentum / 100;
    if (fastrand(frameid) % 4 === 0) {
      fx *= scalar * 2;
      fy *= scalar * 2;
    }
    scarf[i] = pt(scarf[i].x, scarf[i].y, scarf[i].px + fx, scarf[i].py + fy, scarf[i].mx, scarf[i].my, scarf[i].f);
  }
}
function processScarfBones(scarf) {
  for (const bone of SCARF_BONES) {
    const a = scarf[bone.joint1];
    const b = scarf[bone.joint2];
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const scalar = (len - bone.rest) / len;
    if (!Number.isFinite(scalar)) continue;
    b.x = b.x + dx * scalar;
    b.y = b.y + dy * scalar;
  }
}

/**
 * Rider.Simulate: advance one frame (6 iterations of bones + lines).
 * Returns a new rider state. `collisions` (optional Set) collects hit line ids.
 */
export function simulate(rider, grid, bones, frameid = 0, collisions = null, maxIteration = 6) {
  const body = rider.body.map(step);
  const state = { dead: rider.crashed };
  let sledBroken = rider.sledBroken;
  for (let i = 0; i < maxIteration; i++) {
    processBones(bones, body, state);
    processLines(grid, body, collisions);
  }
  if (maxIteration === 6) {
    const nosex = body[SledTR].x - body[SledTL].x;
    const nosey = body[SledTR].y - body[SledTL].y;
    const tailx = body[SledBL].x - body[SledTL].x;
    const taily = body[SledBL].y - body[SledTL].y;
    const headx = body[BodyShoulder].x - body[BodyButt].x;
    const heady = body[BodyShoulder].y - body[BodyButt].y;
    if (nosex * taily - nosey * tailx < 0 || nosex * heady - nosey * headx > 0) {
      state.dead = true;
      sledBroken = true;
    }
  }
  const scarf = rider.scarf.map(stepFriction);
  scarf[0] = { ...body[BodyShoulder] };
  const sm = scarf[0];
  flutterScarf(scarf, frameid, Math.sqrt(sm.mx * sm.mx + sm.my * sm.my));
  processScarfBones(scarf);
  return { body, scarf, crashed: state.dead, sledBroken };
}

/** Average of the contact points (used for centre of mass / camera). */
export function riderCenter(rider) {
  let x = 0;
  let y = 0;
  for (const p of rider.body) {
    x += p.x;
    y += p.y;
  }
  return { x: x / rider.body.length, y: y / rider.body.length };
}
