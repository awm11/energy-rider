// Canvas drawing for the track, Bob, the floor and the energy overlays.
import {
  BodyButt,
  BodyFootLeft,
  BodyFootRight,
  BodyHandLeft,
  BodyHandRight,
  BodyShoulder,
  LineType,
  SledBL,
  SledBR,
  SledTL,
  SledTR,
} from '../engine/constants.js';
import { PX_PER_M, formatJ } from '../engine/energy.js';

export const COLORS = {
  paper: '#ffffff',
  blue: '#0066ff',
  red: '#cc0000',
  green: '#00cc00',
  ink: '#1d2230',
  muted: '#6b7280',
  gpe: '#7c3aed',
  ke: '#e8590c',
  total: '#1d2230',
  floor: '#7c3aed',
  floorFill: 'rgba(124,58,237,0.06)',
  flag: '#e11d48',
};

export const FONT_UI = '"Bricolage Grotesque", system-ui, -apple-system, "Segoe UI", sans-serif';
export const FONT_NUM = '"IBM Plex Mono", ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace';

/** Camera helper: cam = {x, y, zoom} where (x,y) is the world point at the centre. */
export function makeView(cam, w, h) {
  const z = cam.zoom;
  const ox = w / 2 - cam.x * z;
  const oy = h / 2 - cam.y * z;
  return {
    z,
    w,
    h,
    toScreen: (x, y) => [x * z + ox, y * z + oy],
    toWorld: (sx, sy) => [(sx - ox) / z, (sy - oy) / z],
    left: (0 - ox) / z,
    right: (w - ox) / z,
    top: (0 - oy) / z,
    bottom: (h - oy) / z,
    apply: (ctx) => ctx.setTransform(z, 0, 0, z, ox, oy),
    ox,
    oy,
  };
}

function lineColor(line, playing, colorPlayback) {
  if (playing && !colorPlayback) return '#000000';
  if (line.type === LineType.Scenery) return COLORS.green;
  return line.type === LineType.Red ? COLORS.red : COLORS.blue;
}

export function drawLines(ctx, track, view, { playing = false, colorPlayback = true, hits = null } = {}) {
  const pad = 20;
  const { left, right, top, bottom } = view;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const scenery = [];
  const phys = [];
  for (const l of track.lines.values()) {
    if (Math.max(l.x1, l.x2) < left - pad || Math.min(l.x1, l.x2) > right + pad) continue;
    if (Math.max(l.y1, l.y2) < top - pad || Math.min(l.y1, l.y2) > bottom + pad) continue;
    (l.physical ? phys : scenery).push(l);
  }
  // scenery first, then physics lines on top
  for (const l of scenery) {
    ctx.strokeStyle = lineColor(l, playing, colorPlayback);
    ctx.lineWidth = 2 * (l.width || 1);
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
  }
  for (const l of phys) {
    ctx.strokeStyle = lineColor(l, playing, colorPlayback);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(l.x1, l.y1);
    ctx.lineTo(l.x2, l.y2);
    ctx.stroke();
    if (hits && hits.has(l.id)) {
      ctx.strokeStyle = 'rgba(255,200,0,0.55)';
      ctx.lineWidth = 4;
      ctx.stroke();
    }
    if (l.type === LineType.Red && (!playing || colorPlayback) && view.z > 0.6) drawRedDecor(ctx, l);
  }
}

// small arrowheads showing which way the red line pushes Bob
function drawRedDecor(ctx, l) {
  const len = l.distance;
  const ux = l.dx / len;
  const uy = l.dy / len;
  // acceleration direction
  const al = Math.hypot(l.accX, l.accY) || 1;
  const ax = l.accX / al;
  const ay = l.accY / al;
  // riding side is opposite the collision normal
  const sx = -l.nx;
  const sy = -l.ny;
  ctx.fillStyle = COLORS.red;
  const n = Math.max(1, Math.floor(len / 12));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n;
    const cx = l.x1 + l.dx * t + sx * 2.2;
    const cy = l.y1 + l.dy * t + sy * 2.2;
    ctx.beginPath();
    ctx.moveTo(cx + ax * 2.2, cy + ay * 2.2);
    ctx.lineTo(cx - ax * 1.4 + sx * 1.3, cy - ay * 1.4 + sy * 1.3);
    ctx.lineTo(cx - ax * 1.4 - sx * 0.3, cy - ay * 1.4 - sy * 0.3);
    ctx.closePath();
    ctx.fill();
  }
  void ux;
  void uy;
}

function seg(ctx, a, b) {
  ctx.beginPath();
  ctx.moveTo(a.x, a.y);
  ctx.lineTo(b.x, b.y);
  ctx.stroke();
}

/** Draw Bob and his sled (vector art, our own) at a rider state. */
export function drawRider(ctx, rider, alpha = 1) {
  const b = rider.body;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // scarf
  const sc = rider.scarf;
  if (sc && sc.length > 1 && Number.isFinite(sc[1].x)) {
    ctx.lineWidth = 1.6;
    for (let i = 0; i < sc.length - 1; i++) {
      ctx.strokeStyle = i % 2 === 0 ? '#d7263d' : '#ffffff';
      seg(ctx, sc[i], sc[i + 1]);
    }
  }

  const ink = '#111111';
  // far arm and leg (behind the sled)
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  seg(ctx, b[BodyShoulder], b[BodyHandRight]);
  seg(ctx, b[BodyButt], b[BodyFootRight]);

  // rope from hands to the sled's string point
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 0.35;
  if (!rider.crashed) {
    seg(ctx, b[BodyHandLeft], b[SledTR]);
    seg(ctx, b[BodyHandRight], b[SledTR]);
  }

  // sled
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = 1.1;
  const tl = b[SledTL],
    bl = b[SledBL],
    br = b[SledBR],
    tr = b[SledTR];
  if (rider.sledBroken) {
    seg(ctx, tl, bl);
    seg(ctx, br, tr);
    ctx.lineWidth = 0.9;
    seg(ctx, bl, { x: (bl.x + br.x) / 2 - 1, y: (bl.y + br.y) / 2 });
    seg(ctx, { x: (bl.x + br.x) / 2 + 1, y: (bl.y + br.y) / 2 }, br);
  } else {
    // runner with a curled nose
    ctx.beginPath();
    ctx.moveTo(tl.x, tl.y);
    ctx.lineTo(bl.x, bl.y);
    ctx.lineTo(br.x, br.y);
    ctx.quadraticCurveTo(br.x + (br.x - bl.x) * 0.2, br.y + (br.y - bl.y) * 0.2, tr.x, tr.y);
    ctx.stroke();
    // seat
    ctx.fillStyle = '#c98b4b';
    ctx.strokeStyle = '#7a4e22';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    const mx = (tl.x + bl.x) / 2,
      my = (tl.y + bl.y) / 2;
    const nx = (tr.x + br.x) / 2,
      ny = (tr.y + br.y) / 2;
    ctx.moveTo(mx, my);
    ctx.lineTo(nx, ny);
    ctx.lineTo(nx + (tr.x - nx) * 0.4, ny + (tr.y - ny) * 0.4);
    ctx.lineTo(mx + (tl.x - mx) * 0.6, my + (tl.y - my) * 0.6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }

  // torso
  const bu = b[BodyButt],
    sh = b[BodyShoulder];
  const tx = sh.x - bu.x,
    ty = sh.y - bu.y;
  const tl2 = Math.hypot(tx, ty) || 1;
  const ux = tx / tl2,
    uy = ty / tl2;
  const px = -uy,
    py = ux;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = ink;
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  const w = 1.9;
  ctx.moveTo(bu.x + px * w - ux * 0.6, bu.y + py * w - uy * 0.6);
  ctx.lineTo(sh.x + px * w, sh.y + py * w);
  ctx.lineTo(sh.x - px * w, sh.y - py * w);
  ctx.lineTo(bu.x - px * w - ux * 0.6, bu.y - py * w - uy * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // head + hat
  const hx = sh.x + ux * 2.9,
    hy = sh.y + uy * 2.9;
  ctx.beginPath();
  ctx.arc(hx, hy, 2.6, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.stroke();
  // eye on the side facing the sled's nose
  const fx = br.x - bl.x,
    fy = br.y - bl.y;
  const facing = px * fx + py * fy >= 0 ? 1 : -1;
  ctx.fillStyle = ink;
  ctx.beginPath();
  ctx.arc(hx + px * facing * 1.3 + ux * 0.4, hy + py * facing * 1.3 + uy * 0.4, 0.42, 0, Math.PI * 2);
  ctx.fill();
  // beanie
  ctx.fillStyle = '#d7263d';
  ctx.beginPath();
  ctx.arc(hx + ux * 0.7, hy + uy * 0.7, 2.5, Math.atan2(uy, ux) - Math.PI / 2, Math.atan2(uy, ux) + Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(hx + ux * 3.4, hy + uy * 3.4, 0.8, 0, Math.PI * 2);
  ctx.fill();

  // near arm and leg
  ctx.strokeStyle = ink;
  ctx.lineWidth = 1.5;
  seg(ctx, b[BodyShoulder], b[BodyHandLeft]);
  seg(ctx, b[BodyButt], b[BodyFootLeft]);
  ctx.restore();
}

/** Floor (GPE zero) line with hatching below. */
export function drawFloor(ctx, view, floorY, { dpr = 1, dragging = false } = {}) {
  const [, sy] = view.toScreen(0, floorY);
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = view.w;
  if (sy < view.h) {
    ctx.fillStyle = COLORS.floorFill;
    ctx.fillRect(0, Math.max(0, sy), w, view.h - Math.max(0, sy));
    // diagonal hatching
    ctx.strokeStyle = 'rgba(124,58,237,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const top = Math.max(0, sy);
    for (let x = -view.h; x < w; x += 14) {
      ctx.moveTo(x, view.h);
      ctx.lineTo(x + (view.h - top), top);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, w, view.h - top);
    ctx.clip();
    ctx.beginPath();
    for (let x = -view.h; x < w; x += 14) {
      ctx.moveTo(x, view.h);
      ctx.lineTo(x + (view.h - top), top);
    }
    ctx.stroke();
    ctx.restore();
  }
  ctx.strokeStyle = COLORS.floor;
  ctx.lineWidth = dragging ? 2.5 : 1.5;
  ctx.setLineDash([8, 6]);
  ctx.beginPath();
  ctx.moveTo(0, sy);
  ctx.lineTo(w, sy);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.restore();
}

/** The floor's label, which doubles as its drag handle. Returns its screen rect. */
export function drawFloorLabel(ctx, view, floorY, { dpr = 1, left = 64 } = {}) {
  const [, sy] = view.toScreen(0, floorY);
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const label = 'FLOOR  h = 0 m  ·  GPE = 0 J';
  ctx.font = `600 11px ${FONT_UI}`;
  const tw = ctx.measureText(label).width;
  const lx = left,
    lh = 22;
  const ly = Math.min(Math.max(sy - lh / 2, 4), view.h - lh - 4);
  ctx.fillStyle = COLORS.floor;
  roundRect(ctx, lx, ly, tw + 34, lh, 11);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  // grip dots
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(lx + 10, ly + 6 + i * 5, 1.2, 0, Math.PI * 2);
    ctx.arc(lx + 15, ly + 6 + i * 5, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillText(label, lx + 24, ly + 15);
  ctx.restore();
  return { x: lx, y: ly, w: tw + 34, h: lh };
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Height scale in metres above the floor, down the left edge. */
export function drawRuler(ctx, view, floorY, dpr = 1) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const pxPerM = PX_PER_M * view.z; // screen px per metre
  let step = 1;
  for (const s of [0.5, 1, 2, 5, 10, 20, 50, 100, 200, 500]) {
    step = s;
    if (s * pxPerM >= 36) break;
  }
  const [, fy] = view.toScreen(0, floorY);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillRect(0, 0, 46, view.h);
  ctx.strokeStyle = 'rgba(29,34,48,0.18)';
  ctx.beginPath();
  ctx.moveTo(46.5, 0);
  ctx.lineTo(46.5, view.h);
  ctx.stroke();
  ctx.font = `500 10px ${FONT_NUM}`;
  ctx.textAlign = 'right';
  const hTop = (fy - 0) / pxPerM;
  const hBot = (fy - view.h) / pxPerM;
  // heights are only measured above the floor
  const start = Math.max(0, Math.floor(hBot / step) * step);
  for (let m = start; m <= hTop + step; m += step) {
    const y = fy - m * pxPerM;
    const major = Math.abs(m / (step * 5) - Math.round(m / (step * 5))) < 1e-9 || step >= 5;
    ctx.strokeStyle = m === 0 ? COLORS.floor : 'rgba(29,34,48,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(major ? 34 : 40, Math.round(y) + 0.5);
    ctx.lineTo(46, Math.round(y) + 0.5);
    ctx.stroke();
    ctx.fillStyle = m === 0 ? COLORS.floor : m < 0 ? '#b42318' : COLORS.ink;
    const txt = (Math.abs(m) < 1e-9 ? 0 : +m.toFixed(1)) + '';
    ctx.fillText(txt, 32, y + 3.5);
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.muted;
  ctx.font = `600 9px ${FONT_UI}`;
  ctx.save();
  ctx.translate(11, view.h / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillText('HEIGHT ABOVE FLOOR (m)', 0, 0);
  ctx.restore();
  ctx.restore();
}

/** Dashed height marker from Bob's centre to the floor and a velocity arrow. */
export function drawEnergyOverlays(ctx, view, e, floorY, { height = true, velocity = true, dpr = 1 } = {}) {
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const [cx, cy] = view.toScreen(e.cx, e.cy);
  const [, fy] = view.toScreen(0, floorY);
  ctx.font = `600 11px ${FONT_NUM}`;
  if (height) {
    ctx.strokeStyle = COLORS.gpe;
    ctx.lineWidth = 1.25;
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, fy);
    ctx.stroke();
    ctx.setLineDash([]);
    // end ticks
    ctx.beginPath();
    ctx.moveTo(cx - 5, fy);
    ctx.lineTo(cx + 5, fy);
    ctx.stroke();
    const label = `h = ${e.h.toFixed(2)} m`;
    const midY = Math.min(Math.max((cy + fy) / 2, 14), view.h - 14);
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(ctx, cx + 7, midY - 9, tw + 10, 18, 4);
    ctx.fill();
    ctx.fillStyle = COLORS.gpe;
    ctx.fillText(label, cx + 12, midY + 4);
  }
  if (velocity && e.speed > 0.05) {
    // arrow length: distance travelled in 0.3 s, at least 18px
    const k = (0.3 * PX_PER_M * view.z) / 1;
    let ax = e.vx * k,
      ay = e.vy * k;
    const L = Math.hypot(ax, ay);
    if (L < 18) {
      ax *= 18 / L;
      ay *= 18 / L;
    }
    const ex = cx + ax,
      ey = cy + ay;
    ctx.strokeStyle = COLORS.ke;
    ctx.fillStyle = COLORS.ke;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    const ang = Math.atan2(ay, ax);
    ctx.beginPath();
    ctx.moveTo(ex + Math.cos(ang) * 4, ey + Math.sin(ang) * 4);
    ctx.lineTo(ex + Math.cos(ang + 2.5) * 9, ey + Math.sin(ang + 2.5) * 9);
    ctx.lineTo(ex + Math.cos(ang - 2.5) * 9, ey + Math.sin(ang - 2.5) * 9);
    ctx.closePath();
    ctx.fill();
    const label = `v = ${e.speed.toFixed(2)} m/s`;
    const tw = ctx.measureText(label).width;
    const lx = ex + (ax >= 0 ? 8 : -tw - 18);
    const ly = ey + (ay >= 0 ? 16 : -8);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    roundRect(ctx, lx, ly - 13, tw + 10, 18, 4);
    ctx.fill();
    ctx.fillStyle = COLORS.ke;
    ctx.fillText(label, lx + 5, ly);
  }
  ctx.restore();
}

/** Start marker (where Bob begins). */
export function drawStartMarker(ctx, track) {
  const x = track.startX,
    y = track.startY;
  ctx.save();
  ctx.strokeStyle = 'rgba(29,34,48,0.35)';
  ctx.lineWidth = 0.6;
  ctx.setLineDash([1.5, 1.5]);
  ctx.strokeRect(x - 3, y - 12, 24, 20);
  ctx.setLineDash([]);
  ctx.restore();
}

export function drawFlagIcon(ctx, x, y) {
  ctx.save();
  ctx.strokeStyle = COLORS.flag;
  ctx.fillStyle = COLORS.flag;
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x, y - 16);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(x, y - 16);
  ctx.lineTo(x + 8, y - 13);
  ctx.lineTo(x, y - 10);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

/** The energy readout drawn onto exported video frames. */
export function drawVideoHud(ctx, e, { mass, scale = 1, time = 0, label = '', offsetX = 0 }) {
  ctx.save();
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
  const x = 16 + offsetX,
    y = 16,
    w = 236,
    h = 128;
  ctx.fillStyle = 'rgba(255,255,255,0.93)';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(29,34,48,0.15)';
  ctx.lineWidth = 1;
  ctx.stroke();
  const rows = [
    ['GPE', e.gpe, COLORS.gpe],
    ['KE', e.ke, COLORS.ke],
    ['Total', e.total, COLORS.total],
  ];
  ctx.textBaseline = 'alphabetic';
  rows.forEach(([name, val, col], i) => {
    const ry = y + 28 + i * 24;
    ctx.fillStyle = col;
    ctx.fillRect(x + 14, ry - 10, 8, 8);
    ctx.font = `600 13px ${FONT_UI}`;
    ctx.fillStyle = COLORS.ink;
    ctx.fillText(name, x + 30, ry - 1);
    ctx.font = `600 15px ${FONT_NUM}`;
    ctx.textAlign = 'right';
    ctx.fillText(formatJ(val), x + w - 14, ry);
    ctx.textAlign = 'left';
  });
  ctx.font = `500 11px ${FONT_NUM}`;
  ctx.fillStyle = COLORS.muted;
  ctx.fillText(`h ${e.h.toFixed(2)} m   v ${e.speed.toFixed(2)} m/s   m ${mass} kg`, x + 14, y + h - 30);
  ctx.fillText(`t ${time.toFixed(2)} s`, x + 14, y + h - 13);
  if (label) {
    ctx.textAlign = 'right';
    ctx.fillText(label, x + w - 14, y + h - 13);
  }
  ctx.restore();
}
