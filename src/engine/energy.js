// Energy calculations for Bob.
//
// Line Rider's gravity is 0.175 px per frame² at 40 frames per second,
// i.e. 0.175 × 40² = 280 px/s². Matching that to g = 9.8 m/s² fixes the
// scale: 1 m = 280 / 9.8 ≈ 28.57 track pixels. With this scale the
// simulated motion obeys real kinematics, so GPE and KE trade off correctly.
import { GRAVITY_Y, PHYSICS_RATE } from './constants.js';

export const G = 9.8; // N/kg
export const PX_PER_M = (GRAVITY_Y * PHYSICS_RATE * PHYSICS_RATE) / G; // ≈ 28.571

export function centre(rider) {
  let x = 0;
  let y = 0;
  const b = rider.body;
  for (let i = 0; i < b.length; i++) {
    x += b[i].x;
    y += b[i].y;
  }
  return { x: x / b.length, y: y / b.length };
}

function prevCentre(rider) {
  let x = 0;
  let y = 0;
  const b = rider.body;
  for (let i = 0; i < b.length; i++) {
    x += b[i].px;
    y += b[i].py;
  }
  return { x: x / b.length, y: y / b.length };
}

export function lowestY(rider) {
  let m = -Infinity;
  for (const p of rider.body) if (p.y > m) m = p.y;
  return m;
}

/**
 * Velocity of Bob's centre at frame n in px/frame, using the centred
 * difference (C[n+1] − C[n−1]) / 2. For Verlet integration this makes
 * GPE + KE exactly constant in free fall, so the total only changes when
 * something really adds or removes energy.
 */
export function velocityAt(track, n) {
  const next = centre(track.getFrame(n + 1));
  const prev = n > 0 ? centre(track.getFrame(n - 1)) : prevCentre(track.getFrame(0));
  return { x: (next.x - prev.x) / 2, y: (next.y - prev.y) / 2 };
}

export function energyAt(track, n, mass, floorY) {
  const rider = track.getFrame(n);
  const c = centre(rider);
  const vpx = velocityAt(track, n);
  const vx = (vpx.x * PHYSICS_RATE) / PX_PER_M;
  const vy = (vpx.y * PHYSICS_RATE) / PX_PER_M;
  const speed = Math.sqrt(vx * vx + vy * vy);
  const h = (floorY - c.y) / PX_PER_M;
  const gpe = mass * G * h;
  const ke = 0.5 * mass * speed * speed;
  return { frame: n, h, speed, vx, vy, gpe, ke, total: gpe + ke, cx: c.x, cy: c.y, crashed: rider.crashed };
}

/** Cached energy series for the graph. Invalidated when inputs change. */
export class EnergySeries {
  constructor() {
    this.key = '';
    this.data = [];
  }
  get(track, upTo, mass, floorY) {
    const key = track.changeCount + '|' + mass + '|' + floorY;
    if (key !== this.key) {
      this.key = key;
      this.data = [];
    }
    for (let i = this.data.length; i <= upTo; i++) {
      const e = energyAt(track, i, mass, floorY);
      // was Bob touching a red (booster) line during this frame?
      let boost = false;
      const hits = track.hits[i + 1] || track.hits[i];
      if (hits) for (const id of hits) if (track.lines.get(id)?.type === 1) boost = true;
      e.boost = boost;
      this.data.push(e);
    }
    return this.data;
  }
}

export function formatJ(j) {
  const a = Math.abs(j);
  if (a >= 1e6) return (j / 1e6).toFixed(2) + ' MJ';
  if (a >= 1e5) return (j / 1e3).toFixed(1) + ' kJ';
  return Math.round(j).toLocaleString('en-GB') + ' J';
}
