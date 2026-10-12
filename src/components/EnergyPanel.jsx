import { useState } from 'react';
import { G, formatJ } from '../engine/energy.js';
import { useEditor, useEditorInstance } from '../editor/useEditor.js';

const fmt = (v, d = 2) => v.toFixed(d);

export function EnergyPanel() {
  const ed = useEditorInstance();
  // re-render whenever the frame, track or energy reference changes
  useEditor((s) => s.frame);
  useEditor((s) => s.rev);
  const mass = useEditor((s) => s.mass);
  const maxFrame = useEditor((s) => s.maxFrame);
  const showWorking = useEditor((s) => s.showWorking);
  const [editingMass, setEditingMass] = useState(false);
  const [massDraft, setMassDraft] = useState('');
  const e = ed.energyNow();

  // bar scale: the largest total seen in this run (at least the current one)
  const series = ed.energySeries(Math.max(maxFrame, ed.state.frame));
  let scale = 1;
  for (const s of series) scale = Math.max(scale, s.total, s.ke, s.gpe);
  const gpeW = Math.max(0, e.gpe) / scale;
  const keW = Math.max(0, e.ke) / scale;
  const start = series[0]?.total ?? e.total;

  const commitMass = () => {
    const v = parseFloat(massDraft);
    if (Number.isFinite(v) && v > 0) ed.setMass(v);
    setEditingMass(false);
  };

  return (
    <section className="energy" aria-label="Bob's energy">
      <header className="energy-head">
        <h2>Bob’s energy</h2>
        {editingMass ? (
          <form
            className="mass-form"
            onSubmit={(ev) => {
              ev.preventDefault();
              commitMass();
            }}
          >
            <label htmlFor="mass-input">m =</label>
            <input
              id="mass-input"
              type="number"
              min="1"
              max="1000"
              step="1"
              autoFocus
              value={massDraft}
              onChange={(ev) => setMassDraft(ev.target.value)}
              onBlur={commitMass}
            />
            <span>kg</span>
          </form>
        ) : (
          <button
            type="button"
            className="chip"
            title="Change Bob's mass (him plus his sled)"
            onClick={() => {
              setMassDraft(String(mass));
              setEditingMass(true);
            }}
          >
            m = {mass} kg
          </button>
        )}
      </header>

      <div className="e-row is-gpe">
        <span className="e-key" />
        <span className="e-name">
          GPE <small>gravitational potential</small>
        </span>
        <span className="e-val">{formatJ(e.gpe)}</span>
      </div>
      {showWorking && (
        <p className="e-work">
          E<sub>p</sub> = m × g × h
          <br />= {mass} kg × {G} N/kg × {fmt(e.h)} m
        </p>
      )}
      <div className="e-row is-ke">
        <span className="e-key" />
        <span className="e-name">
          KE <small>kinetic</small>
        </span>
        <span className="e-val">{formatJ(e.ke)}</span>
      </div>
      {showWorking && (
        <p className="e-work">
          E<sub>k</sub> = ½ × m × v²
          <br />= 0.5 × {mass} kg × ({fmt(e.speed)} m/s)²
        </p>
      )}
      <div className="e-row is-total">
        <span className="e-key" />
        <span className="e-name">Total</span>
        <span className="e-val">{formatJ(e.total)}</span>
      </div>

      <div
        className="ebar"
        role="img"
        aria-label={`GPE ${formatJ(e.gpe)} plus KE ${formatJ(e.ke)} makes ${formatJ(e.total)}`}
      >
        <span className="ebar-gpe" style={{ width: `${gpeW * 100}%` }} />
        <span className="ebar-ke" style={{ width: `${keW * 100}%` }} />
        {start > 0 && <span className="ebar-start" style={{ left: `${Math.min(1, start / scale) * 100}%` }} title="Total energy at the start" />}
      </div>

      <dl className="e-meta">
        <div>
          <dt>height h</dt>
          <dd>{fmt(e.h)} m</dd>
        </div>
        <div>
          <dt>speed v</dt>
          <dd>{fmt(e.speed)} m/s</dd>
        </div>
        <div>
          <dt>time</dt>
          <dd>{fmt(ed.state.frame / 40)} s</dd>
        </div>
      </dl>
      {e.crashed && <p className="e-note is-crash">Bob has fallen off his sled.</p>}

      <button type="button" className="link-btn" onClick={() => ed.set({ showWorking: !showWorking })}>
        {showWorking ? 'Hide the working' : 'Show the working'}
      </button>
    </section>
  );
}
