import { useEffect, useMemo, useRef, useState } from 'react';
import { ConfirmDialog, FloorPrompt, HelpDialog, MusicDialog, SettingsDialog, VideoDialog } from './components/Dialogs.jsx';
import { EnergyPanel } from './components/EnergyPanel.jsx';
import {
  DownloadIcon,
  FileIcon,
  BobIcon,
  FitIcon,
  HelpIcon,
  MusicIcon,
  PlusIcon,
  SettingsIcon,
  UploadIcon,
  VideoIcon,
} from './components/Icons.jsx';
import { SidePanel } from './components/SidePanel.jsx';
import { Timeline } from './components/Timeline.jsx';
import { Toolbar } from './components/Toolbar.jsx';
import { Tooltip } from './components/Tooltip.jsx';
import { initDownloads, saveFile, safeName } from './editor/download.js';
import { Editor } from './editor/editor.js';
import { EditorContext, useEditor, useEditorInstance } from './editor/useEditor.js';

function Menu({ onClose, onAction }) {
  const ref = useRef(null);
  useEffect(() => {
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target) && !e.target.closest?.('[aria-label="Menu"]')) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    ref.current?.querySelector('button')?.focus();
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);
  const item = (id, Icon, label, hint) => (
    <button type="button" role="menuitem" className="menu-item" onClick={() => onAction(id)}>
      <Icon width={18} height={18} />
      <span className="menu-label">{label}</span>
      {hint && <span className="menu-hint">{hint}</span>}
    </button>
  );
  return (
    <div className="menu" role="menu" ref={ref}>
      {item('save', DownloadIcon, 'Save track (.json)')}
      {item('open', UploadIcon, 'Open a track…', '.track.json')}
      {item('new', PlusIcon, 'New track')}
      {item('example', FileIcon, 'Load the example track')}
      <hr />
      {item('music', MusicIcon, 'Music…')}
      {item('video', VideoIcon, 'Export as video…')}
      <hr />
      {item('fit', FitIcon, 'Show the whole track')}
      {item('bob', BobIcon, 'Show Bob', 'F1')}
      {item('settings', SettingsIcon, 'Track settings…')}
      {item('help', HelpIcon, 'Help and shortcuts')}
    </div>
  );
}

function Toast() {
  const toast = useEditor((s) => s.toast);
  if (!toast) return null;
  return (
    <div className={'toast' + (toast.kind === 'error' ? ' is-error' : '')} role="status" key={toast.id}>
      {toast.text}
    </div>
  );
}

function Stage() {
  const ed = useEditorInstance();
  const ref = useRef(null);
  const tool = useEditor((s) => s.tool);
  const recording = useEditor((s) => s.recording);
  useEffect(() => {
    ed.attach(ref.current);
    return () => ed.detach();
  }, [ed]);
  return (
    <canvas
      ref={ref}
      className={`stage tool-${tool}` + (recording ? ' is-recording' : '')}
      aria-label="Track canvas. Draw lines for Bob to ride on."
      role="img"
    />
  );
}

export default function App() {
  const editor = useMemo(() => new Editor(), []);
  const [menu, setMenu] = useState(false);
  const [dialog, setDialog] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => {
    initDownloads();
    // handy for curious teachers poking around in the browser console
    window.energyRider = editor;
  }, [editor]);

  const saveTrack = async () => {
    const res = await saveFile(`${safeName(editor.state.trackName)}.track.json`, editor.exportJson(), 'application/json');
    if (res === 'saved') editor.toast('Track saved as a .track.json file.');
    else if (res === 'failed') editor.toast('The track could not be saved.', 'error');
  };

  const onAction = (id) => {
    setMenu(false);
    switch (id) {
      case 'save':
        saveTrack();
        break;
      case 'open':
        fileRef.current?.click();
        break;
      case 'new':
        setDialog('new');
        break;
      case 'example':
        setDialog('example');
        break;
      case 'fit':
        editor.zoomToFit();
        break;
      case 'bob':
        editor.showBob();
        break;
      default:
        setDialog(id);
    }
  };

  const close = () => setDialog(null);

  return (
    <EditorContext.Provider value={editor}>
      <div className="app">
        <Stage />
        <header className="brand" aria-label="Energy Rider">
          <span className="brand-mark" aria-hidden="true">
            E<sub>p</sub>+E<sub>k</sub>
          </span>
          <span className="brand-name">Energy Rider</span>
        </header>
        <EnergyPanel />
        <Toolbar onMenu={() => setMenu((m) => !m)} menuOpen={menu}>
          {menu && <Menu onClose={() => setMenu(false)} onAction={onAction} />}
        </Toolbar>
        <SidePanel />
        <Timeline />
        <Toast />
        <Tooltip />
        <FloorPrompt />
        <input
          ref={fileRef}
          id="open-track"
          type="file"
          accept=".json,application/json"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            try {
              editor.importJson(await f.text());
            } catch (err) {
              editor.toast(err.message || 'That track could not be opened.', 'error');
            }
          }}
        />
        {dialog === 'help' && <HelpDialog onClose={close} />}
        {dialog === 'music' && <MusicDialog onClose={close} />}
        {dialog === 'video' && <VideoDialog onClose={close} />}
        {dialog === 'settings' && <SettingsDialog onClose={close} />}
        {(dialog === 'new' || dialog === 'example') && (
          <ConfirmDialog
            title={dialog === 'new' ? 'Start a new track?' : 'Load the example track?'}
            confirmLabel={dialog === 'new' ? 'Start a new track' : 'Load the example'}
            onCancel={close}
            onSaveFirst={saveTrack}
            onConfirm={() => {
              if (dialog === 'new') editor.newTrack();
              else editor.loadSample();
              close();
            }}
          >
            <p>This replaces the track you are working on. Save it first if you want to keep it.</p>
          </ConfirmDialog>
        )}
      </div>
    </EditorContext.Provider>
  );
}
