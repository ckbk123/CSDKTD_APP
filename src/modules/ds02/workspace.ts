import type { ModuleMount } from '../../core/module';

// Keep browser-only MathLive out of catalogue import checks. The shell mount
// stays synchronous; a superseded visit must not create editors or controls.
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const child = new AbortController();
  let disposed = false;
  let release: (() => void) | undefined;
  const loading = document.createElement('p');
  loading.setAttribute('role', 'status'); loading.textContent = 'Loading Jury exercise…';
  container.append(loading);
  const cleanup = (): void => {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', cleanup);
    child.abort();
    const disposeView = release; release = undefined;
    try { disposeView?.(); } finally { loading.remove(); }
  };
  const failed = (): void => {
    child.abort();
    if (disposed || signal.aborted) return;
    loading.setAttribute('role', 'alert');
    loading.textContent = 'The Jury exercise could not load. Reset the workspace to try again.';
    container.replaceChildren(loading);
  };
  signal.addEventListener('abort', cleanup, { once: true });
  void import('./ui').then(ui => {
    if (disposed || signal.aborted) return;
    try {
      const disposeView = ui.mount({ container, signal: child.signal });
      if (typeof disposeView === 'function') {
        if (disposed || child.signal.aborted) disposeView();
        else release = disposeView;
      }
      if (!disposed) loading.remove();
    } catch { failed(); }
  }).catch(failed);
  return cleanup;
};
