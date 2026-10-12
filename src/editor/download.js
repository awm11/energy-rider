// Saving files. Inside a claude.ai artifact the page cannot start downloads
// itself, so we ask the viewer through the `downloads` capability; in a
// normal browser (the Vite app) we use an ordinary download link.

let downloadsPromise = null;
export function initDownloads() {
  if (downloadsPromise) return downloadsPromise;
  const c = typeof window !== 'undefined' ? window.claude : undefined;
  downloadsPromise = c && typeof c.use === 'function' ? c.use('downloads').catch(() => null) : Promise.resolve(null);
  return downloadsPromise;
}

export function isArtifactHost() {
  return typeof window !== 'undefined' && !!window.claude && typeof window.claude.use === 'function';
}

/**
 * Save `data` (string or Blob) as `filename`.
 * Resolves 'saved' | 'declined' | 'failed'.
 */
export async function saveFile(filename, data, mime = 'application/octet-stream') {
  const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
  if (isArtifactHost()) {
    const dl = await initDownloads();
    if (dl) {
      try {
        await dl.save({ filename, data: blob });
        return 'saved';
      } catch (e) {
        if (e && e.code === 'declined') return 'declined';
        console.warn('download failed', e);
        return 'failed';
      }
    }
  }
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    return 'saved';
  } catch (e) {
    console.warn(e);
    return 'failed';
  }
}

export function safeName(name, fallback = 'track') {
  const s = String(name || '')
    .trim()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 60);
  return s || fallback;
}
