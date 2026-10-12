import { useEffect, useRef, useState } from 'react';
import { PX_PER_M } from '../engine/energy.js';
import { saveFile, safeName } from '../editor/download.js';
import { useEditor, useEditorInstance } from '../editor/useEditor.js';
import { recordVideo, videoSupport } from '../editor/video.js';
import { CloseIcon } from './Icons.jsx';

export function Modal({ title, onClose, children, wide = false, labelledBy, focusDialog = false }) {
  const ed = useEditorInstance();
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    ed.modalOpen = true;
    const prev = document.activeElement;
    // focusDialog: focus the dialog itself, so Space or Enter can't press a button by accident
    const first = focusDialog
      ? ref.current
      : ref.current?.querySelector('[data-autofocus]') || ref.current?.querySelector('input, select, textarea, .dialog-body button, button');
    first?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape' && closeRef.current) {
        e.stopPropagation();
        closeRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      ed.modalOpen = false;
      window.removeEventListener('keydown', onKey);
      prev?.focus?.();
    };
  }, [ed]);
  const id = labelledBy || 'dlg-' + title.replace(/\W+/g, '-').toLowerCase();
  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={'dialog' + (wide ? ' is-wide' : '')} role="dialog" aria-modal="true" aria-labelledby={id} ref={ref} tabIndex={-1}>
        <header className="dialog-head">
          <h2 id={id}>{title}</h2>
          {onClose && (
            <button type="button" className="icon-btn" aria-label="Close" onClick={onClose}>
              <CloseIcon width={18} height={18} />
            </button>
          )}
        </header>
        <div className="dialog-body">{children}</div>
      </div>
    </div>
  );
}

export function FloorPrompt() {
  const ed = useEditorInstance();
  const prompt = useEditor((s) => s.floorPrompt);
  const mass = useEditor((s) => s.mass);
  if (!prompt) return null;
  return (
    <Modal title="Bob has reached the floor" onClose={() => ed.stopAtFloor()} focusDialog>
      <div className="floor-art" aria-hidden="true">
        <svg viewBox="0 0 320 70" width="100%" height="70">
          <line x1="0" y1="40" x2="320" y2="40" stroke="var(--gpe)" strokeWidth="2" strokeDasharray="8 6" />
          <text x="8" y="34" fill="var(--gpe)" fontSize="11" fontWeight="600">
            floor: h = 0 m, GPE = 0 J
          </text>
          <line x1="0" y1="62" x2="320" y2="62" stroke="var(--gpe)" strokeOpacity=".45" strokeWidth="2" strokeDasharray="8 6" />
          <text x="8" y="58" fill="var(--gpe)" fillOpacity=".7" fontSize="11">
            lowered floor
          </text>
          <path d="M250 12 L250 54" stroke="var(--ink)" strokeWidth="1.5" markerEnd="url(#ar)" />
          <defs>
            <marker id="ar" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="var(--ink)" />
            </marker>
          </defs>
        </svg>
      </div>
      <p>
        We measure Bob’s height <em>h</em> from the floor, so the floor is where his GPE is zero (E<sub>p</sub> = m g h). He can’t go any
        lower than the floor, so to let him carry on you need to lower it.
      </p>
      <p>
        Lowering the floor moves the zero point down. Bob’s GPE goes up by the same amount everywhere, but the <strong>changes</strong> in GPE
        stay exactly the same.
      </p>
      <div className="dialog-actions">
        <button type="button" className="btn btn-primary" onClick={() => ed.lowerFloor()}>
          Lower the floor
        </button>
        <button type="button" className="btn" onClick={() => ed.stopAtFloor()}>
          Stop here
        </button>
      </div>
      <p className="fine">Bob’s mass is {mass} kg. You can also drag the purple floor label to move it.</p>
    </Modal>
  );
}

export function ConfirmDialog({ title, children, confirmLabel, onConfirm, onCancel, onSaveFirst }) {
  return (
    <Modal title={title} onClose={onCancel}>
      {children}
      <div className="dialog-actions">
        {onSaveFirst && (
          <button type="button" className="btn" onClick={onSaveFirst}>
            Save my track first
          </button>
        )}
        <button type="button" className="btn btn-danger" onClick={onConfirm}>
          {confirmLabel}
        </button>
        <button type="button" className="btn btn-quiet" data-autofocus onClick={onCancel}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

export function MusicDialog({ onClose }) {
  const ed = useEditorInstance();
  const music = useEditor((s) => s.music);
  const inputRef = useRef(null);

  return (
    <Modal title="Music" onClose={onClose}>
      <p>Add a song and it will play in time with Bob, just like on linerider.com.</p>
      <div className="field-row">
        <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>
          Upload a song…
        </button>
        <input
          ref={inputRef}
          id="music-file"
          type="file"
          accept="audio/*,.mp3,.m4a,.ogg,.wav"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) ed.setMusic(f);
            e.target.value = '';
          }}
        />
      </div>
      {music && (
        <>
          <div className="music-now">
            <p className="music-name">
              Playing with Bob: <strong>{music.name}</strong>
            </p>
            <button type="button" className="btn btn-quiet" onClick={() => ed.setMusic(null)}>
              Remove music
            </button>
          </div>
          <label className="field" htmlFor="music-offset">
            <span>Start the song at</span>
            <span className="field-inline">
              <input
                id="music-offset"
                type="number"
                step="0.1"
                min="0"
                value={music.offset}
                onChange={(e) => ed.setMusicOffset(parseFloat(e.target.value) || 0)}
              />
              seconds into the song when Bob sets off
            </span>
          </label>
          <p className="fine">An uploaded song isn’t saved inside the track file. Add it again after opening a saved track.</p>
        </>
      )}
    </Modal>
  );
}

export function SettingsDialog({ onClose }) {
  const ed = useEditorInstance();
  const s = useEditor((st) => st);
  const toggles = [
    ['showHeight', 'Show Bob’s height above the floor'],
    ['showVelocity', 'Show Bob’s velocity arrow'],
    ['showRuler', 'Show the height scale (metres)'],
    ['colorPlayback', 'Keep line colours while Bob is riding'],
    ['snap', 'Snap new lines to the ends of other lines (hold S to switch)'],
  ];
  return (
    <Modal title="Track settings" onClose={onClose}>
      <label className="field" htmlFor="track-name">
        <span>Track name</span>
        <input id="track-name" type="text" maxLength={60} value={s.trackName} onChange={(e) => ed.changed({ trackName: e.target.value })} />
      </label>
      <label className="field" htmlFor="bob-mass">
        <span>Bob’s mass (with his sled)</span>
        <span className="field-inline">
          <input id="bob-mass" type="number" min="1" max="1000" value={s.mass} onChange={(e) => ed.setMass(parseFloat(e.target.value) || 1)} />
          kg
        </span>
      </label>
      <label className="check" htmlFor="zero-start">
        <input
          id="zero-start"
          type="checkbox"
          checked={ed.track.zeroStart}
          onChange={(e) => {
            ed.track.setZeroStart(e.target.checked);
            ed.changed();
          }}
        />
        <span>Bob starts completely still (no starting push)</span>
      </label>
      <fieldset className="checks">
        <legend>Display</legend>
        {toggles.map(([k, label]) => (
          <label key={k} className="check" htmlFor={'set-' + k}>
            <input id={'set-' + k} type="checkbox" checked={!!s[k]} onChange={(e) => ed.set({ [k]: e.target.checked })} />
            <span>{label}</span>
          </label>
        ))}
      </fieldset>
    </Modal>
  );
}

export function VideoDialog({ onClose }) {
  const ed = useEditorInstance();
  const st = useEditor((s) => s);
  const support = videoSupport();
  const defaultEnd = Math.max(st.maxFrame, 40 * 10);
  const [res, setRes] = useState('720');
  const [framing, setFraming] = useState('1');
  const [from, setFrom] = useState(st.flagFrame != null ? 'flag' : 'start');
  const [seconds, setSeconds] = useState(Math.round((defaultEnd / 40) * 10) / 10);
  const [hud, setHud] = useState(true);
  const [showFloor, setShowFloor] = useState(true);
  const [showGraph, setShowGraph] = useState(false);
  const [withMusic, setWithMusic] = useState(true);
  const [progress, setProgress] = useState(null);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const abortRef = useRef(null);

  const start = async () => {
    setError('');
    setDone('');
    const startFrame = from === 'flag' && st.flagFrame != null ? st.flagFrame : 0;
    let endFrame = startFrame + Math.max(1, Math.round(seconds * 40));
    const hit = ed.floorFrame(endFrame);
    if (hit >= 0) endFrame = Math.max(startFrame + 1, hit);
    const [w, h] = res === '1080' ? [1920, 1080] : res === '480' ? [854, 480] : [1280, 720];
    const ac = new AbortController();
    abortRef.current = ac;
    ed.pause();
    ed.set({ recording: true });
    setProgress(0);
    try {
      const out = await recordVideo(ed, {
        width: w,
        height: h,
        startFrame,
        endFrame,
        hud,
        showFloor,
        showGraph,
        zoomFactor: +framing,
        music: withMusic ? st.music : null,
        onProgress: setProgress,
        signal: ac.signal,
      });
      if (out) {
        const r = await saveFile(`${safeName(st.trackName)}.${out.ext}`, out.blob, out.blob.type);
        setDone(
          r === 'saved'
            ? `Video saved (${(out.blob.size / 1e6).toFixed(1)} MB, .${out.ext}).`
            : r === 'declined'
              ? 'Save cancelled.'
              : 'The video could not be saved.',
        );
      }
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      ed.set({ recording: false });
      setProgress(null);
    }
  };

  const recording = progress !== null;
  return (
    <Modal title="Export as video" onClose={recording ? undefined : onClose}>
      {!support ? (
        <p className="error">This browser can’t record video. Try Chrome, Edge or Firefox on a laptop or desktop.</p>
      ) : recording ? (
        <div className="rec">
          <p>
            <span className="rec-dot" /> Recording in real time. Keep this tab open and visible until it finishes.
          </p>
          <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
            <span style={{ width: `${progress * 100}%` }} />
          </div>
          <div className="dialog-actions">
            <button type="button" className="btn" onClick={() => abortRef.current?.abort()}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="field-grid">
            <label className="field" htmlFor="vid-res">
              <span>Size</span>
              <select id="vid-res" value={res} onChange={(e) => setRes(e.target.value)}>
                <option value="480">854 × 480</option>
                <option value="720">1280 × 720 (HD)</option>
                <option value="1080">1920 × 1080 (Full HD)</option>
              </select>
            </label>
            <label className="field" htmlFor="vid-from">
              <span>Start from</span>
              <select id="vid-from" value={from} onChange={(e) => setFrom(e.target.value)}>
                <option value="start">The beginning</option>
                <option value="flag" disabled={st.flagFrame == null}>
                  The flag{st.flagFrame != null ? ` (${(st.flagFrame / 40).toFixed(2)} s)` : ''}
                </option>
              </select>
            </label>
            <label className="field" htmlFor="vid-framing">
              <span>Camera</span>
              <select id="vid-framing" value={framing} onChange={(e) => setFraming(e.target.value)}>
                <option value="2">Close up on Bob</option>
                <option value="1">Same as my screen</option>
                <option value="0.5">Wide</option>
              </select>
            </label>
            <label className="field" htmlFor="vid-len">
              <span>Length (seconds)</span>
              <input id="vid-len" type="number" min="1" max="600" step="0.5" value={seconds} onChange={(e) => setSeconds(Math.max(1, +e.target.value || 1))} />
            </label>
          </div>
          <label className="check" htmlFor="vid-hud">
            <input id="vid-hud" type="checkbox" checked={hud} onChange={(e) => setHud(e.target.checked)} />
            <span>Show the energy readout, height and velocity in the video</span>
          </label>
          <label className="check" htmlFor="vid-floor">
            <input id="vid-floor" type="checkbox" checked={showFloor} onChange={(e) => setShowFloor(e.target.checked)} />
            <span>Show the floor</span>
          </label>
          <label className="check" htmlFor="vid-graph">
            <input id="vid-graph" type="checkbox" checked={showGraph} onChange={(e) => setShowGraph(e.target.checked)} />
            <span>Show the energy graph (GPE, KE and total, drawn in as Bob rides)</span>
          </label>
          <label className="check" htmlFor="vid-music">
            <input
              id="vid-music"
              type="checkbox"
              checked={withMusic && !!st.music}
              disabled={!st.music}
              onChange={(e) => setWithMusic(e.target.checked)}
            />
            <span>
              {st.music
                ? `Include music (${st.music.name})`
                : 'Include music (add a song from the menu first)'}
            </span>
          </label>
          <p className="fine">
            The video records in real time, so a {seconds}-second run takes {seconds} seconds. It ends early if Bob reaches the floor. It saves as{' '}
            {support.ext === 'mp4' ? 'an MP4' : 'a WebM'} file.
          </p>
          {error && <p className="error">{error}</p>}
          {done && <p className="ok">{done}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-primary" data-autofocus onClick={start}>
              Record video
            </button>
            <button type="button" className="btn btn-quiet" onClick={onClose}>
              Close
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

const KEYS = [
  ['Drawing', [
    ['Q', 'Pencil'],
    ['W', 'Line tool'],
    ['E', 'Eraser'],
    ['T', 'Hand: drag to move the view'],
    ['D', 'Move Bob’s starting point'],
    ['1 / 2 / 3', 'Blue (normal), red (acceleration), green (scenery)'],
    ['Tab', 'Red line strength ×1, ×2, ×3'],
    ['Shift while drawing', 'Flip the line, so Bob rides on the other side'],
    ['X while using the line tool', 'Lock the angle to 15° steps'],
    ['Hold S', 'Switch line snapping off or on'],
    ['Ctrl+Z / Ctrl+Y', 'Undo / redo'],
    ['Backspace', 'Delete the newest line'],
    ['Mouse wheel, Z / X', 'Zoom in / out'],
    ['Right or middle drag', 'Move the view'],
  ]],
  ['Playing', [
    ['Y', 'Play from the flag (or the start)'],
    ['Alt+Y', 'Play from the start, ignoring the flag'],
    ['Shift+Y', 'Play in slow motion'],
    ['Space', 'Pause / resume'],
    ['U', 'Stop and rewind'],
    ['I', 'Flag this moment'],
    ['← / →', 'Step one frame (1/40 s)'],
    ['Shift+← / →', 'Jump one second'],
    ['M', 'Slow motion on / off'],
    ['Enter', 'Record a reading'],
    ['Home / F1 / F2', 'Go to the start / Bob / the flag'],
  ]],
];

export function HelpDialog({ onClose }) {
  return (
    <Modal title="How Energy Rider works" onClose={onClose} wide>
      <div className="help">
        <section>
          <h3>Build a track</h3>
          <p>
            Draw lines for Bob to sled on. <span className="t-blue">Blue lines</span> are normal track.{' '}
            <span className="t-red">Red lines</span> push Bob along, adding energy. <span className="t-green">Green lines</span> are scenery:
            Bob goes straight through them. Lines have a riding side, so draw from left to right for a floor and right to left for a ceiling (or hold Shift).
          </p>
          <h3>The energy numbers</h3>
          <p>
            <strong className="t-gpe">GPE</strong> (gravitational potential energy) = m × g × h, where h is the height of Bob’s centre above the purple
            floor. <strong className="t-ke">KE</strong> (kinetic energy) = ½ × m × v², where v is Bob’s speed. Bob’s mass m is 60 kg unless you change it,
            and g = 9.8 N/kg.
          </p>
          <p>
            The game’s gravity is 0.175 pixels per frame², at 40 frames a second. Matching that to 9.8 m/s² sets the scale:{' '}
            <strong>1 metre = {PX_PER_M.toFixed(1)} pixels</strong>. Because of that, GPE and KE swap over correctly: on a smooth blue track the total
            stays almost constant. When it drops, energy has been dissipated to the surroundings in a bump or a crash. When it rises, a red line did work on Bob.
          </p>
          <h3>Ideas to try</h3>
          <ul>
            <li>Record readings at the top and bottom of a hill. Does the GPE lost equal the KE gained?</li>
            <li>Can Bob ever climb higher than where he started without a red line?</li>
            <li>Double Bob’s mass. What happens to his speed, and to his energy?</li>
            <li>Lower the floor. Which numbers change, and which differences stay the same?</li>
          </ul>
        </section>
        <section>
          {KEYS.map(([title, rows]) => (
            <div key={title} className="keys">
              <h3>{title}</h3>
              <table>
                <tbody>
                  {rows.map(([k, v]) => (
                    <tr key={k}>
                      <th scope="row">
                        <kbd>{k}</kbd>
                      </th>
                      <td>{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
          <p className="fine">
            The rider physics is a line-by-line port of{' '}
            <a href="https://github.com/jealouscloud/linerider-advanced" target="_blank" rel="noreferrer">
              linerider-advanced
            </a>{' '}
            (GPL-3.0), checked frame-for-frame against classic Line Rider test tracks. Tracks save as .track.json files that
            linerider.com and linerider-advanced can open. Line Rider was created by Boštjan Čadež.
          </p>
        </section>
      </div>
    </Modal>
  );
}
