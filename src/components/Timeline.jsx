import { useEffect, useRef } from 'react';
import { useEditor, useEditorInstance } from '../editor/useEditor.js';
import { ChartIcon, FitIcon, RecordIcon, StepBackIcon, StepFwdIcon, TableIcon, ZoomInIcon, ZoomOutIcon } from './Icons.jsx';

function clock(frame) {
  const t = frame / 40;
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export function Timeline() {
  const ed = useEditorInstance();
  const frame = useEditor((s) => s.frame);
  const maxFrame = useEditor((s) => s.maxFrame);
  const flagFrame = useEditor((s) => s.flagFrame);
  const speed = useEditor((s) => s.speed);
  const zoom = useEditor((s) => s.zoom);
  const panel = useEditor((s) => s.panel);
  const length = Math.max(400, Math.ceil((Math.max(maxFrame, frame) + 120) / 40) * 40);
  const ref = useRef(null);
  // panels above the timeline sit on top of it, whatever height it wraps to
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => document.documentElement.style.setProperty('--tl-h', el.offsetHeight + 'px'));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div className="timeline" role="group" aria-label="Timeline" ref={ref}>
      <div className="tl-left">
        <button type="button" className="icon-btn" title="Back one frame (←)" aria-label="Back one frame" onClick={() => ed.step(-1)}>
          <StepBackIcon width={16} height={16} />
        </button>
        <div className="tl-clock" aria-live="off">
          <span className="tl-time">{clock(frame)}</span>
          <span className="tl-frame">frame {frame}</span>
        </div>
        <button type="button" className="icon-btn" title="Forward one frame (→)" aria-label="Forward one frame" onClick={() => ed.step(1)}>
          <StepFwdIcon width={16} height={16} />
        </button>
      </div>
      <div className="tl-track">
        <input
          id="timeline-scrub"
          type="range"
          min="0"
          max={length}
          step="1"
          value={frame}
          aria-label="Timeline position"
          onChange={(e) => {
            if (ed.state.playing) ed.pause();
            ed.setFrame(+e.target.value);
          }}
        />
        <div className="tl-ticks" aria-hidden="true">
          <span className="tl-played" style={{ width: `${(maxFrame / length) * 100}%` }} />
          {flagFrame != null && <span className="tl-flag" style={{ left: `${(flagFrame / length) * 100}%` }} />}
        </div>
      </div>
      <div className="tl-right">
        <label className="speed" title="Playback speed (M toggles slow motion)">
          <span className="sr-only">Playback speed</span>
          <select id="speed-select" value={speed} onChange={(e) => {
              ed.setSpeed(+e.target.value);
              e.target.blur();
            }}>
            <option value={0.1}>0.1×</option>
            <option value={0.25}>0.25×</option>
            <option value={0.5}>0.5×</option>
            <option value={1}>1×</option>
            <option value={2}>2×</option>
          </select>
        </label>
        <button type="button" className="pill-btn" title="Record the energy values at this moment (Enter)" onClick={() => ed.addReading()}>
          <RecordIcon width={16} height={16} />
          <span>Record reading</span>
        </button>
        <div className="seg" role="group" aria-label="Side panel">
          <button
            type="button"
            className={'seg-btn' + (panel === 'graph' ? ' is-on' : '')}
            aria-pressed={panel === 'graph'}
            title="Energy graph"
            onClick={() => ed.set({ panel: panel === 'graph' ? null : 'graph' })}
          >
            <ChartIcon width={16} height={16} />
            <span>Graph</span>
          </button>
          <button
            type="button"
            className={'seg-btn' + (panel === 'log' ? ' is-on' : '')}
            aria-pressed={panel === 'log'}
            title="Recorded readings"
            onClick={() => ed.set({ panel: panel === 'log' ? null : 'log' })}
          >
            <TableIcon width={16} height={16} />
            <span>Readings</span>
          </button>
        </div>
        <div className="zoom" role="group" aria-label="Zoom">
          <button type="button" className="icon-btn" title="Zoom out (X)" aria-label="Zoom out" onClick={() => ed.zoomBy(0.8)}>
            <ZoomOutIcon width={16} height={16} />
          </button>
          <span className="zoom-val">{Math.round(zoom * 100)}%</span>
          <button type="button" className="icon-btn" title="Zoom in (Z)" aria-label="Zoom in" onClick={() => ed.zoomBy(1.25)}>
            <ZoomInIcon width={16} height={16} />
          </button>
          <button type="button" className="icon-btn" title="Show the whole track" aria-label="Show the whole track" onClick={() => ed.zoomToFit()}>
            <FitIcon width={16} height={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
