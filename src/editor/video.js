// Export a run as a video using MediaRecorder. The run is played in real
// time onto an off-screen canvas (with the energy readout drawn in) and the
// music, if any, is mixed into the recording.
import { PHYSICS_RATE } from '../engine/constants.js';
import { centre, energyAt } from '../engine/energy.js';
import { plotGraph } from './graph.js';
import {
  COLORS,
  FONT_UI,
  drawEnergyOverlays,
  drawFloor,
  drawFloorLabel,
  drawLines,
  drawRider,
  drawRuler,
  drawVideoHud,
  makeView,
  roundRect,
} from './render.js';

export function videoSupport() {
  if (typeof MediaRecorder === 'undefined' || !HTMLCanvasElement.prototype.captureStream) return null;
  const types = [
    ['video/mp4;codecs=avc1.42E01E,mp4a.40.2', 'mp4'],
    ['video/mp4;codecs=avc1', 'mp4'],
    ['video/mp4', 'mp4'],
    ['video/webm;codecs=vp9,opus', 'webm'],
    ['video/webm;codecs=vp8,opus', 'webm'],
    ['video/webm', 'webm'],
  ];
  for (const [t, ext] of types) if (MediaRecorder.isTypeSupported(t)) return { mime: t, ext };
  return { mime: '', ext: 'webm' };
}

/**
 * opts: { width, height, startFrame, endFrame, hud, showFloor, showGraph, music, onProgress, signal, zoomFactor }
 * Resolves with { blob, ext } (or null if cancelled).
 */
export async function recordVideo(editor, opts) {
  const support = videoSupport();
  if (!support) throw new Error('This browser cannot record video. Try Chrome, Edge or Firefox on a computer.');
  const { width, height, startFrame, endFrame, hud, music, onProgress, signal, zoomFactor = 1, showFloor = true, showGraph = false } = opts;
  // the whole run's energies, worked out before recording so frames don't stall
  const series = showGraph ? editor.energySeries(endFrame).slice(0, endFrame + 1) : null;
  const span = Math.max(endFrame, 40);
  const s = editor.state;
  const track = editor.track;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // camera: same world height as the editor view, following Bob
  const zoom = Math.min(24, editor.cam.zoom * (height / Math.max(200, editor.view.h)) * zoomFactor);
  const c0 = centre(track.getFrame(startFrame));
  const cam = { x: c0.x, y: c0.y, zoom };
  const follow = (f) => {
    const c = centre(track.getFrame(f));
    const bx = (width * 0.18) / zoom,
      by = (height * 0.18) / zoom;
    if (c.x - cam.x > bx) cam.x += c.x - cam.x - bx;
    if (cam.x - c.x > bx) cam.x -= cam.x - c.x - bx;
    if (c.y - cam.y > by) cam.y += c.y - cam.y - by;
    if (cam.y - c.y > by) cam.y -= cam.y - c.y - by;
  };
  const uiScale = height / 720;
  const draw = (f) => {
    follow(f);
    // world drawn at full resolution, overlays at uiScale
    const wv = makeView(cam, width, height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.paper;
    ctx.fillRect(0, 0, width, height);
    const vz = makeView({ ...cam, zoom: zoom / uiScale }, width / uiScale, height / uiScale);
    if (showFloor) drawFloor(ctx, vz, s.floorY, { dpr: uiScale });
    ctx.setTransform(wv.z, 0, 0, wv.z, wv.ox, wv.oy);
    drawLines(ctx, track, wv, { playing: true, colorPlayback: s.colorPlayback });
    drawRider(ctx, track.getFrame(f), 1);
    const e = energyAt(track, f, s.mass, s.floorY);
    if (hud) {
      drawEnergyOverlays(ctx, vz, e, s.floorY, { height: s.showHeight, velocity: s.showVelocity, dpr: uiScale });
      if (s.showRuler) drawRuler(ctx, vz, s.floorY, uiScale);
      if (showFloor) drawFloorLabel(ctx, vz, s.floorY, { dpr: uiScale, left: s.showRuler ? 58 : 12 });
      drawVideoHud(ctx, e, {
        mass: s.mass,
        scale: uiScale,
        time: f / PHYSICS_RATE,
        label: s.trackName.slice(0, 22),
        offsetX: s.showRuler ? 46 : 0,
      });
    }
    if (showGraph) drawGraphPanel(f);
  };

  // energy–time graph in the bottom-right corner, drawn in as Bob rides
  const drawGraphPanel = (f) => {
    const W = 1280 * (width / height / (16 / 9)); // layout width at the 720-high scale
    const gw = 400,
      gh = 230,
      x = W - gw - 16,
      y = 720 - gh - 16;
    ctx.save();
    ctx.setTransform(uiScale, 0, 0, uiScale, 0, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.93)';
    roundRect(ctx, x, y, gw, gh, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(29,34,48,0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();
    // legend
    ctx.font = `600 12px ${FONT_UI}`;
    let lx = x + 14;
    for (const [name, col] of [
      ['GPE', COLORS.gpe],
      ['KE', COLORS.ke],
      ['Total', COLORS.total],
    ]) {
      ctx.fillStyle = col;
      ctx.fillRect(lx, y + 15, 14, 3);
      ctx.fillText(name, lx + 19, y + 20);
      lx += 19 + ctx.measureText(name).width + 16;
    }
    ctx.translate(x + 4, y + 30);
    plotGraph(ctx, gw - 12, gh - 36, series, f, { span, upTo: f });
    ctx.restore();
  };

  draw(startFrame);
  const stream = canvas.captureStream(0);
  const vtrack = stream.getVideoTracks()[0];
  const requestFrame = () => {
    if (vtrack && typeof vtrack.requestFrame === 'function') vtrack.requestFrame();
  };

  let audioCtx = null;
  let audioEl = null;
  if (music && music.url) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      audioEl = new Audio();
      audioEl.src = music.url;
      audioEl.crossOrigin = 'anonymous';
      const src = audioCtx.createMediaElementSource(audioEl);
      const dest = audioCtx.createMediaStreamDestination();
      src.connect(dest);
      src.connect(audioCtx.destination);
      for (const t of dest.stream.getAudioTracks()) stream.addTrack(t);
      await new Promise((res) => {
        if (audioEl.readyState >= 1) return res();
        audioEl.addEventListener('loadedmetadata', res, { once: true });
        audioEl.addEventListener('error', res, { once: true });
        setTimeout(res, 3000);
      });
    } catch (e) {
      console.warn('Music could not be added to the video', e);
    }
  }

  const rec = new MediaRecorder(stream, support.mime ? { mimeType: support.mime, videoBitsPerSecond: 8_000_000 } : {});
  const chunks = [];
  rec.ondataavailable = (ev) => ev.data && ev.data.size && chunks.push(ev.data);
  const stopped = new Promise((res) => (rec.onstop = res));
  rec.start(250);

  const total = endFrame - startFrame;
  let cancelled = false;
  await new Promise((resolve) => {
    const t0 = performance.now();
    let last = -1;
    const startAudio = () => {
      if (!audioEl) return;
      const t = startFrame / PHYSICS_RATE + (music.offset || 0);
      if (t >= 0) {
        try {
          audioEl.currentTime = t;
        } catch {
          /* ignore */
        }
        audioEl.play().catch(() => {});
      }
    };
    startAudio();
    const tick = () => {
      if (signal?.aborted) {
        cancelled = true;
        return resolve();
      }
      const f = startFrame + Math.floor(((performance.now() - t0) / 1000) * PHYSICS_RATE);
      if (f !== last) {
        // render every frame we skipped too, so the camera stays consistent
        for (let i = Math.max(last + 1, startFrame); i <= Math.min(f, endFrame); i++) follow(i);
        draw(Math.min(f, endFrame));
        requestFrame();
        last = f;
        onProgress?.((Math.min(f, endFrame) - startFrame) / Math.max(1, total));
        // music that starts later than frame 0
        if (audioEl && audioEl.paused && music.offset < 0 && f / PHYSICS_RATE + music.offset >= 0) startAudio();
      }
      if (f > endFrame) return resolve();
      // setTimeout keeps going if the browser throttles animation frames
      setTimeout(tick, 1000 / 60);
    };
    tick();
  });
  rec.stop();
  await stopped;
  audioEl?.pause();
  audioCtx?.close().catch(() => {});
  for (const t of stream.getTracks()) t.stop();
  if (cancelled) return null;
  return { blob: new Blob(chunks, { type: support.mime || 'video/webm' }), ext: support.ext };
}
