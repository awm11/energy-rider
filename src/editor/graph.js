// Energy–time graph drawn on its own canvas.
import { COLORS, FONT_NUM, FONT_UI } from './render.js';

function niceStep(range, target) {
  const raw = range / target;
  const mag = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  for (const m of [1, 2, 2.5, 5, 10]) if (m * mag >= raw) return m * mag;
  return 10 * mag;
}

/**
 * series: energy samples (frame 0..n). frame: playhead. span: frames shown.
 */
export function drawGraph(canvas, series, frame, { span }) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (!w || !h) return;
  if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  plotGraph(ctx, w, h, series, frame, { span });
}

/**
 * Draw the graph into a w × h box at the context's current origin. The axes
 * are scaled to the whole series; lines are drawn only up to frame `upTo`
 * (default: all of it), so a video can reveal the graph as Bob rides.
 */
export function plotGraph(ctx, w, h, series, frame, { span, upTo = Infinity }) {
  const padL = 52,
    padR = 18,
    padT = 10,
    padB = 24;
  const gw = w - padL - padR;
  const gh = h - padT - padB;
  const n = Math.max(span, 40);

  let lo = 0,
    hi = 1;
  for (const e of series) {
    hi = Math.max(hi, e.total, e.gpe, e.ke);
    lo = Math.min(lo, e.gpe, e.total);
  }
  const stepY = niceStep(hi - lo, 4);
  hi = Math.ceil(hi / stepY) * stepY;
  lo = Math.floor(lo / stepY) * stepY;
  const X = (f) => padL + (f / n) * gw;
  const Y = (v) => padT + gh - ((v - lo) / (hi - lo || 1)) * gh;

  // booster frames
  ctx.fillStyle = 'rgba(204,0,0,0.08)';
  const last = Math.min(series.length - 1, upTo);
  for (let i = 0; i <= last; i++) {
    if (series[i].boost) ctx.fillRect(X(i) - gw / n / 2, padT, Math.max(1, gw / n), gh);
  }

  // grid + y labels
  ctx.font = `500 10px ${FONT_NUM}`;
  ctx.textAlign = 'right';
  for (let v = lo; v <= hi + 1e-6; v += stepY) {
    const y = Math.round(Y(v)) + 0.5;
    ctx.strokeStyle = v === 0 ? 'rgba(29,34,48,0.35)' : 'rgba(29,34,48,0.08)';
    ctx.beginPath();
    ctx.moveTo(padL, y);
    ctx.lineTo(w - padR, y);
    ctx.stroke();
    ctx.fillStyle = COLORS.muted;
    const label = Math.abs(v) >= 10000 ? (v / 1000).toFixed(0) + 'k' : Math.round(v).toLocaleString('en-GB');
    ctx.fillText(label, padL - 6, y + 3.5);
  }
  // x labels (seconds)
  ctx.textAlign = 'center';
  const secs = n / 40;
  const stepX = niceStep(secs, 6);
  for (let s = 0; s <= secs + 1e-6; s += stepX) {
    const x = X(s * 40);
    ctx.fillStyle = COLORS.muted;
    ctx.fillText(s + ' s', x, h - 7);
  }
  ctx.save();
  ctx.translate(11, padT + gh / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = `600 9px ${FONT_UI}`;
  ctx.fillText('ENERGY (J)', 0, 0);
  ctx.restore();

  const plot = (key, color, width) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    for (let i = 0; i <= last; i++) {
      const x = X(i),
        y = Y(series[i][key]);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  };
  plot('gpe', COLORS.gpe, 1.75);
  plot('ke', COLORS.ke, 1.75);
  plot('total', COLORS.total, 2.25);

  // playhead
  if (frame <= n) {
    const x = Math.round(X(frame)) + 0.5;
    ctx.strokeStyle = 'rgba(29,34,48,0.5)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(x, padT);
    ctx.lineTo(x, padT + gh);
    ctx.stroke();
    ctx.setLineDash([]);
    const e = series[Math.min(frame, series.length - 1)];
    if (e) {
      for (const [k, c] of [
        ['gpe', COLORS.gpe],
        ['ke', COLORS.ke],
        ['total', COLORS.total],
      ]) {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x, Y(e[k]), 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}
