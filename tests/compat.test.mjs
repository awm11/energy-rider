// Compatibility tests against the classic Line Rider test tracks shipped with
// lr-core (https://github.com/conundrumer/lr-core/tree/master/fixtures).
import { readFileSync } from 'node:fs';
import { loadTrackJson } from '../src/engine/trackio.js';

const dir = new URL('./', import.meta.url);
let failed = 0;
function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name} ${extra}`);
  if (!cond) failed++;
}
function run(file, { shouldCrash = false }) {
  const { track, meta } = loadTrackJson(readFileSync(new URL(file, dir), 'utf8'));
  const t0 = performance.now();
  const r = track.getFrame(meta.duration);
  const crashAt = track.firstCrashFrame(meta.duration);
  const ms = (performance.now() - t0).toFixed(0);
  check(`${file}: ${shouldCrash ? 'crashes' : 'survives'} ${meta.duration} frames`, r.crashed === shouldCrash, `(first crash frame ${crashAt}, ${ms} ms)`);
  return track;
}
const tt = run('testTrack.track.json', {});
// Reference values from lr-core's spec (Flash-consistent): TAIL = SledBL, NOSE = SledBR
check('testTrack frame 416 tail x', tt.getFrame(416).body[1].x === 804.1054060579701, tt.getFrame(416).body[1].x);
check('testTrack frame 416 nose x', tt.getFrame(416).body[2].x === 813.3255772705486, tt.getFrame(416).body[2].x);
check('testTrack frame 417 tail x', tt.getFrame(417).body[1].x === 797.8845320873339, tt.getFrame(417).body[1].x);
check('testTrack frame 417 nose x', tt.getFrame(417).body[2].x === 810.0876743591476, tt.getFrame(417).body[2].x);
run('cycloid.track.json', {});
run('legacyTestTrack.track.json', {});
run('cripple.track.json', { shouldCrash: true });
process.exit(failed ? 1 : 0);
