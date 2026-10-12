// The example track a student sees on first open. Built from smooth curves,
// joined end to end like pencil strokes so the line extensions connect.
import { LineType } from './constants.js';
import { RedLine, SceneryLine, StandardLine } from './lines.js';
import { Track } from './track.js';

// half-cosine ease from (x0,y0) to (x1,y1)
function ease(x0, y0, x1, y1, steps) {
  const pts = [];
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    const k = (1 - Math.cos(Math.PI * t)) / 2;
    pts.push([round(x0 + (x1 - x0) * t), round(y0 + (y1 - y0) * k)]);
  }
  return pts;
}
const round = (v) => Math.round(v * 100) / 100;

export const SAMPLE_FLOOR_Y = 350;

export function buildSampleTrack() {
  const track = new Track();
  track.setStart(0, 0);
  // [points, type] segments, each continuing from the previous end point
  const segs = [];
  let cur = [-30, 9];
  // one line roughly every 12 px, like a carefully drawn pencil stroke
  const add = (x1, y1, type = LineType.Blue) => {
    const pts = ease(cur[0], cur[1], x1, y1, Math.max(2, Math.round(Math.abs(x1 - cur[0]) / 12)));
    segs.push({ from: cur, pts, type });
    cur = pts[pts.length - 1];
  };
  add(70, 22);
  add(800, 300); // the big drop
  add(900, 302);
  add(1450, 205); // first hill (lower than the start)
  add(2000, 302);
  add(2100, 300);
  add(2190, 300, LineType.Red); // booster
  add(2840, 12); // as high as the start: too high to reach without the booster
  add(2990, 6);
  add(3640, 330); // second drop
  add(4090, 332);
  add(4790, -110); // end wall: Bob rolls back and forth
  for (const s of segs) {
    let [x0, y0] = s.from;
    for (const [x1, y1] of s.pts) {
      const line = s.type === LineType.Red ? new RedLine(x0, y0, x1, y1) : new StandardLine(x0, y0, x1, y1);
      track.addLine(line);
      x0 = x1;
      y0 = y1;
    }
  }
  // scenery: a few pine trees and a sign post
  const tree = (x, y, s) => {
    const pts = [
      [x - 6 * s, y],
      [x, y - 16 * s],
      [x + 6 * s, y],
      [x - 6 * s, y],
    ];
    for (let i = 0; i < pts.length - 1; i++) track.addLine(new SceneryLine(...pts[i], ...pts[i + 1]));
    track.addLine(new SceneryLine(x, y, x, y + 4 * s));
  };
  tree(840, 290, 1.4);
  tree(880, 292, 1.0);
  tree(2040, 290, 1.2);
  tree(3900, 320, 1.6);
  tree(3960, 322, 1.1);
  tree(4020, 321, 1.2);
  track.resetFrames();
  return track;
}
