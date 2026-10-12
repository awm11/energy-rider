# Energy Rider

A Line Rider track editor for teaching **gravitational potential energy** and
**kinetic energy**. Students draw a track, send Bob down it, and watch his GPE
and KE change frame by frame.

The rider physics is a line-by-line port of
[linerider-advanced](https://github.com/jealouscloud/linerider-advanced), so
tracks behave exactly as they do there and on linerider.com.

## Running it

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev       # opens a local server, usually http://localhost:5173
npm run build     # makes a static site in dist/ that you can host anywhere
npm test          # physics compatibility tests (no install needed)
```

`dist/` works from any web server or school intranet folder (`base: './'` in
`vite.config.js`).

## What students can do

- Draw **blue** (normal), **red** (acceleration) and **green** (scenery) lines
  with the pencil or line tool, erase, undo/redo, pan and zoom.
- Play, pause, stop/rewind, step frame by frame, slow motion, scrub the
  timeline and set a flag to replay from.
- Save and open `.track.json` files (the same format as linerider.com and
  linerider-advanced).
- Add music that plays in time with Bob by uploading a song file (it is not saved in the track file).
- Export the run as a video (MP4 or WebM, depending on the browser), with the
  energy readout and the music included, and the floor and the energy graph
  each shown or hidden.
- **Menu → Show the whole track** frames every drawn line on screen, clear of
  the panels; **Show Bob** (F1) brings Bob back into view if you get lost.

Keyboard shortcuts follow linerider-advanced (Q pencil, W line, E eraser,
T hand, Y play, U stop, I flag, Space pause, Shift to flip a line, and so on).
They are listed under **Menu → Help and shortcuts**.

## The energy features

- **GPE and KE readouts** (top left), with a stacked bar showing GPE + KE =
  total, and an optional “show the working” line that substitutes the numbers
  into E<sub>p</sub> = m g h and E<sub>k</sub> = ½ m v².
- **The floor** (purple dashed line) is where h = 0 and GPE = 0. Drag its label
  to move it. GPE never goes negative: when Bob reaches the floor the run
  pauses and asks whether to lower it. Lowering it raises every GPE value by
  the same amount while leaving the *changes* in GPE untouched; choosing
  *Stop here* leaves Bob paused on the floor. Stepping, scrubbing and video
  export also stop at the floor.
- **Height marker and velocity arrow** on Bob, and a **height scale** in metres
  down the left edge.
- **Energy–time graph** of GPE, KE and total, with frames on red lines shaded,
  plus an energy account: start total, energy added by red lines, energy
  dissipated to the surroundings (heating and sound in bumps and crashes),
  total now.
- **Readings**: press *Record reading* (or Enter) to log t, h, v, GPE, KE and
  total; copy the table into a spreadsheet or download it as CSV.
- While drawing a straight line, a label shows its length, slope, height
  change and the change in Bob’s GPE along it.
- Bob’s mass can be changed (default 60 kg, sled included).

### How the numbers are worked out

Line Rider’s gravity is 0.175 px per frame² at 40 frames per second, which is
280 px/s². Setting that equal to g = 9.8 m/s² fixes the scale at
**1 m = 28.57 track pixels**. With that scale the game’s motion obeys real
kinematics, so on a smooth blue track GPE and KE trade off and the total stays
nearly constant.

- h is the height of Bob’s centre (the average of his ten contact points)
  above the floor.
- v is the speed of that centre, measured with a centred difference over the
  frames either side. For Line Rider’s Verlet integration this makes
  GPE + KE exactly constant in free fall, so any change in the total is real:
  red lines add energy, impacts and tight curves remove it.

## Physics port and how it was checked

`src/engine/` is a direct port of these linerider-advanced files, keeping the
order of every floating-point operation so results are bit-for-bit the same:

| Port | Original (C#) |
| --- | --- |
| `rider.js` | `Game/Physics/Rider.cs`, `SimulationPoint.cs`, `Bone.cs` |
| `constants.js` | `Game/Physics/RiderConstants.cs` |
| `lines.js` | `Game/Lines/StandardLine.cs`, `RedLine.cs`, `SceneryLine.cs` |
| `grid.js` | `Game/Physics/SimulationGrid*.cs`, `LineContainer.cs` (6.1 and 6.2 grids) |
| `track.js` | `Game/Track.cs`, line extensions from `Game/TrackWriter.cs` |
| `trackio.js` | `IO/json/JSONLoader.cs`, `JSONWriter.cs` |

`npm test` runs four classic Line Rider compatibility tracks (from
[lr-core](https://github.com/conundrumer/lr-core/tree/master/fixtures)) that
break if the grid, line order or extensions are even slightly wrong. The port
survives and crashes on the right frames, and matches the published sled
positions at frames 416 and 417 of the test track to every digit.

Not ported (not needed for the homework): the select/move tool, zoom
triggers, onion skinning, the iteration viewer and compressed track files.

## Project layout

```
src/
  engine/      physics port, energy maths, example track, .track.json IO
  editor/      editor class (tools, camera, playback, music), canvas
               drawing, energy graph, video export, file saving
  components/  React UI: toolbar, energy panel, timeline, graph/readings
               panel, dialogs
tests/         physics compatibility test and reference tracks
```

When this runs as a claude.ai artifact, files are saved through the viewer’s
download prompt (`window.claude.use('downloads')`); in a normal browser an
ordinary download link is used.

## Licence and credits

GPL-3.0-or-later, because the physics is derived from linerider-advanced
(© Noah Ablaseau and contributors, GPL-3.0). Bob’s drawing here is original
vector art. Line Rider was created by Boštjan Čadež. Reference tracks in
`tests/` are from lr-core by David Lu (MIT).
# energy-rider
