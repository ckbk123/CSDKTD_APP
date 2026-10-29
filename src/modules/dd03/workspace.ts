import type { ModuleMount } from '../../core/module';

/** Keep browser-only MathLive initialization out of metadata/entry-point inspection.
 * Mount remains synchronous; late view imports cannot touch an aborted visit. */
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const pending = document.createElement('p'); pending.textContent = 'Loading discrete frequency design…';
  pending.setAttribute('role', 'status');
  container.append(pending);
  const child = new AbortController();
  let disposed = false;
  let release: (() => void) | undefined;
  const cleanup = () => {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', cleanup); child.abort();
    const disposeView = release; release = undefined;
    try { disposeView?.(); } finally { pending.remove(); }
  };
  const failed = () => {
    child.abort();
    if (!disposed && !signal.aborted) {
      pending.textContent = 'Discrete frequency design could not load. Reset the tool to try again.';
      container.replaceChildren(pending);
    }
  };
  signal.addEventListener('abort', cleanup, { once: true });
  void import('./view').then(view => {
    if (disposed || signal.aborted) return;
    try {
      const disposeView = view.mount({ container, signal: child.signal });
      if (typeof disposeView === 'function') {
        if (disposed || child.signal.aborted) disposeView();
        else release = disposeView;
      }
      if (!disposed) pending.remove();
    } catch { failed(); }
  }).catch(failed);
  return cleanup;
};
