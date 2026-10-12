import { LineType } from '../engine/constants.js';
import { useEditor, useEditorInstance } from '../editor/useEditor.js';
import {
  EraserIcon,
  FlagIcon,
  HandIcon,
  LineIcon,
  MenuIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  RedoIcon,
  ResumeIcon,
  StartIcon,
  StopIcon,
  UndoIcon,
} from './Icons.jsx';

const TOOLS = [
  { id: 'pencil', label: 'Pencil', key: 'Q', Icon: PencilIcon },
  { id: 'line', label: 'Line', key: 'W', Icon: LineIcon },
  { id: 'eraser', label: 'Eraser', key: 'E', Icon: EraserIcon },
  { id: 'pan', label: 'Hand (move the view)', key: 'T', Icon: HandIcon },
  { id: 'start', label: "Move Bob's start", key: 'D', Icon: StartIcon },
];

const SWATCH = [
  { type: LineType.Blue, label: 'Normal line', hint: 'Bob rides on it', key: '1', cls: 'sw-blue' },
  { type: LineType.Red, label: 'Acceleration line', hint: 'gives Bob extra energy', key: '2', cls: 'sw-red' },
  { type: LineType.Scenery, label: 'Scenery line', hint: 'decoration only', key: '3', cls: 'sw-green' },
];

export function Toolbar({ onMenu, menuOpen, children }) {
  const ed = useEditorInstance();
  const tool = useEditor((s) => s.tool);
  const lineType = useEditor((s) => s.lineType);
  const mult = useEditor((s) => s.redMultiplier);
  const playing = useEditor((s) => s.playing);
  const frame = useEditor((s) => s.frame);
  const flagFrame = useEditor((s) => s.flagFrame);
  const canUndo = useEditor((s) => s.canUndo);
  const canRedo = useEditor((s) => s.canRedo);
  const showSwatch = tool === 'pencil' || tool === 'line';

  return (
    <div className="toolbar-wrap">
      <div className="toolbar" role="toolbar" aria-label="Track editor">
        <div className="tb-group" role="group" aria-label="Tools">
          {TOOLS.map(({ id, label, key, Icon }) => (
            <button
              key={id}
              type="button"
              className={'tb-btn' + (tool === id ? ' is-on' : '')}
              aria-pressed={tool === id}
              title={`${label} (${key})`}
              aria-label={label}
              onClick={() => ed.setTool(id)}
            >
              <Icon />
            </button>
          ))}
        </div>
        <span className="tb-sep" />
        <div className="tb-group" role="group" aria-label="Playback">
          <button type="button" className="tb-btn tb-play" title={flagFrame != null ? 'Play from the flag (Y)' : 'Play from the start (Y)'} aria-label="Play" onClick={() => ed.play()}>
            <PlayIcon />
          </button>
          <button
            type="button"
            className={'tb-btn' + (!playing && frame > 0 ? ' is-soft' : '')}
            title={playing ? 'Pause (Space)' : 'Resume (Space)'}
            aria-label={playing ? 'Pause' : 'Resume'}
            onClick={() => ed.togglePause()}
          >
            {playing ? <PauseIcon /> : <ResumeIcon />}
          </button>
          <button type="button" className="tb-btn" title="Stop and rewind (U)" aria-label="Stop" onClick={() => ed.stop()}>
            <StopIcon />
          </button>
          <button
            type="button"
            className={'tb-btn' + (flagFrame != null ? ' is-flag' : '')}
            title="Flag this moment (I). Play starts from the flag."
            aria-label="Flag"
            onClick={() => ed.toggleFlag()}
          >
            <FlagIcon />
          </button>
        </div>
        <span className="tb-sep" />
        <div className="tb-group" role="group" aria-label="History">
          <button type="button" className="tb-btn" title="Undo (Ctrl+Z)" aria-label="Undo" disabled={!canUndo} onClick={() => ed.undo()}>
            <UndoIcon />
          </button>
          <button type="button" className="tb-btn" title="Redo (Ctrl+Y)" aria-label="Redo" disabled={!canRedo} onClick={() => ed.redo()}>
            <RedoIcon />
          </button>
          <button
            type="button"
            className={'tb-btn' + (menuOpen ? ' is-on' : '')}
            title="Menu: save, open, music, video"
            aria-label="Menu"
            aria-expanded={menuOpen}
            onClick={onMenu}
          >
            <MenuIcon />
          </button>
        </div>
      </div>
      {showSwatch && (
        <div className="swatch" role="group" aria-label="Line type">
          {SWATCH.map(({ type, label, hint, key, cls }) => (
            <button
              key={type}
              type="button"
              className={`sw ${cls}` + (lineType === type ? ' is-on' : '')}
              aria-pressed={lineType === type}
              title={`${label}: ${hint} (${key})`}
              onClick={() => ed.setLineType(type)}
            >
              <span className="sw-dot" />
              <span className="sw-label">{label.split(' ')[0]}</span>
              {type === LineType.Red && lineType === LineType.Red && (
                <span
                  className="sw-mult"
                  role="button"
                  tabIndex={0}
                  title="Strength of the red line (Tab)"
                  onClick={(e) => {
                    e.stopPropagation();
                    ed.cycleMultiplier();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') ed.cycleMultiplier();
                  }}
                >
                  ×{mult}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
      {children}
    </div>
  );
}
