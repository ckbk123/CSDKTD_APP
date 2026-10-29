import type { ModuleMount } from '../../core/module';

// Keep browser-only MathLive out of catalogue import checks. The visit still
// mounts synchronously and owns disposal while its local UI chunk is loading.
export const mount: ModuleMount = ({ container, signal }) => {
  const child = new AbortController();
  let disposed = false;
  let release: (() => void) | undefined;
  const pending = document.createElement('p'); pending.textContent = 'Loading the exercise…';
  pending.setAttribute('role', 'status');
  const dispose = () => {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', dispose); child.abort();
    const disposeView = release; release = undefined;
    try { disposeView?.(); } finally { pending.remove(); }
  };
  if (signal.aborted) { dispose(); return dispose; }
  const failed = () => {
    child.abort();
    if (!disposed && !signal.aborted) {
      pending.textContent = 'The exercise could not load. Reset the tool to try again.';
      container.replaceChildren(pending);
    }
  };
  signal.addEventListener('abort', dispose, { once: true });
  container.append(pending);
  void import('./ui').then(({ mountUI }) => {
    if (disposed || signal.aborted) return;
    try {
      const disposeView = mountUI({ container, signal: child.signal });
      if (typeof disposeView === 'function') {
        if (disposed || child.signal.aborted) disposeView();
        else release = disposeView;
      }
      if (!disposed) pending.remove();
    } catch { failed(); }
  }).catch(failed);
  return dispose;
};
