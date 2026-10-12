import { createContext, useContext, useSyncExternalStore } from 'react';

export const EditorContext = createContext(null);

export function useEditorInstance() {
  return useContext(EditorContext);
}

/** Subscribe to a slice of editor state. The selector should return a primitive or a stable object. */
export function useEditor(selector) {
  const ed = useContext(EditorContext);
  return useSyncExternalStore(ed.subscribe, () => selector(ed.state));
}
