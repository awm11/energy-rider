import { useEffect, useRef, useState } from 'react';
import { formatJ } from '../engine/energy.js';
import { saveFile, safeName } from '../editor/download.js';
import { useEditor, useEditorInstance } from '../editor/useEditor.js';
import { CloseIcon } from './Icons.jsx';

function Accounting() {
  const ed = useEditorInstance();
  const frame = useEditor((s) => s.frame);
  useEditor((s) => s.rev);
  const series = ed.energySeries(frame);
  if (!series.length) return null;
  const start = series[0].total;
  const now = series[Math.min(frame, series.length - 1)].total;
  let boost = 0;
  for (let i = 1; i <= frame && i < series.length; i++) if (series[i].boost) boost += series[i].total - series[i - 1].total;
  const away = start + boost - now;
  return (
    <>
    <dl className="acct">
      <div>
        <dt>Start total</dt>
        <dd>{formatJ(start)}</dd>
      </div>
      <div className="is-boost">
        <dt>Added by red lines</dt>
        <dd>{boost < 0.5 ? formatJ(0) : '+' + formatJ(boost)}</dd>
      </div>
      <div className="is-away">
        <dt>Dissipated to surroundings</dt>
        <dd>{Math.abs(away) < 0.5 ? formatJ(0) : (away > 0 ? '−' : '+') + formatJ(Math.abs(away))}</dd>
      </div>
      <div className="is-now">
        <dt>Total now</dt>
        <dd>{formatJ(now)}</dd>
      </div>
    </dl>
    <p className="acct-note">Dissipated to surroundings: energy transferred by heating and sound, mostly in bumps and crashes.</p>
    </>
  );
}

function GraphView() {
  const ed = useEditorInstance();
  const ref = useRef(null);
  useEffect(() => {
    ed.graphCanvas = ref.current;
    ed.dirty = true;
    return () => {
      if (ed.graphCanvas === ref.current) ed.graphCanvas = null;
    };
  }, [ed]);
  return (
    <>
      <div className="legend" aria-hidden="true">
        <span className="lg lg-gpe">GPE</span>
        <span className="lg lg-ke">KE</span>
        <span className="lg lg-total">Total</span>
        <span className="lg lg-boost">on a red line</span>
      </div>
      <canvas ref={ref} className="graph" role="img" aria-label="Graph of GPE, KE and total energy against time" />
      <Accounting />
    </>
  );
}

function toRows(readings) {
  return readings.map((r, i) => [
    i + 1,
    r.t.toFixed(2),
    r.h.toFixed(2),
    r.v.toFixed(2),
    Math.round(r.gpe),
    Math.round(r.ke),
    Math.round(r.total),
  ]);
}
const HEAD = ['#', 'time (s)', 'height (m)', 'speed (m/s)', 'GPE (J)', 'KE (J)', 'total (J)'];

function LogView() {
  const ed = useEditorInstance();
  const readings = useEditor((s) => s.readings);
  const name = useEditor((s) => s.trackName);
  const mass = useEditor((s) => s.mass);
  const [copied, setCopied] = useState('');

  const copy = async () => {
    const text = [HEAD, ...toRows(readings)].map((r) => r.join('\t')).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied('Copied. Paste into a spreadsheet.');
    } catch {
      setCopied('Copy did not work here. Use Download CSV instead.');
    }
    setTimeout(() => setCopied(''), 3500);
  };
  const download = async () => {
    const lines = [`# ${name}, Bob's mass ${mass} kg, g = 9.8 N/kg`, HEAD.join(','), ...toRows(readings).map((r) => r.join(','))];
    const res = await saveFile(`${safeName(name)}-readings.csv`, lines.join('\n'), 'text/csv');
    if (res === 'failed') setCopied('The file could not be saved.');
  };

  if (!readings.length) {
    return (
      <div className="log-empty">
        <p>
          <strong>No readings yet.</strong> Pause Bob at an interesting moment (top of a hill, bottom of a dip) and press{' '}
          <em>Record reading</em> or <kbd>Enter</kbd>.
        </p>
        <p>Compare GPE and KE at each point. Where did the energy go?</p>
      </div>
    );
  }
  return (
    <>
      <div className="log-scroll">
        <table className="log">
          <thead>
            <tr>
              <th>#</th>
              <th>t (s)</th>
              <th>h (m)</th>
              <th>v (m/s)</th>
              <th className="c-gpe">GPE (J)</th>
              <th className="c-ke">KE (J)</th>
              <th>Total (J)</th>
              <th>
                <span className="sr-only">Delete</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {readings.map((r, i) => (
              <tr key={r.id}>
                <td>{i + 1}</td>
                <td>
                  <button type="button" className="link-btn" title="Jump to this moment" onClick={() => ed.setFrame(r.frame)}>
                    {r.t.toFixed(2)}
                  </button>
                </td>
                <td>{r.h.toFixed(2)}</td>
                <td>{r.v.toFixed(2)}</td>
                <td>{Math.round(r.gpe).toLocaleString('en-GB')}</td>
                <td>{Math.round(r.ke).toLocaleString('en-GB')}</td>
                <td>{Math.round(r.total).toLocaleString('en-GB')}</td>
                <td>
                  <button type="button" className="row-del" aria-label={`Delete reading ${i + 1}`} onClick={() => ed.removeReading(r.id)}>
                    <CloseIcon width={14} height={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="log-actions">
        <button type="button" className="btn" onClick={copy}>
          Copy table
        </button>
        <button type="button" className="btn" onClick={download}>
          Download CSV
        </button>
        <button type="button" className="btn btn-quiet" onClick={() => ed.clearReadings()}>
          Clear
        </button>
      </div>
      {copied && <p className="log-msg">{copied}</p>}
    </>
  );
}

export function SidePanel() {
  const ed = useEditorInstance();
  const panel = useEditor((s) => s.panel);
  if (!panel) return null;
  return (
    <aside className="side" aria-label={panel === 'graph' ? 'Energy graph' : 'Readings'}>
      <header className="side-head">
        <h2>{panel === 'graph' ? 'Energy over time' : 'Readings'}</h2>
        <button type="button" className="icon-btn" aria-label="Close panel" onClick={() => ed.set({ panel: null })}>
          <CloseIcon width={16} height={16} />
        </button>
      </header>
      {panel === 'graph' ? <GraphView /> : <LogView />}
    </aside>
  );
}
