import type { ModuleMount } from '../../core/module';

/** Keep the public mount synchronous. The browser-only equation editor loads
 * after mounting; abort/cleanup rejects any late completion. */
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const child = new AbortController();
  let release: (() => void) | undefined;
  let disposed = false;
  const loading = document.createElement('p');
  loading.textContent = 'Loading sequence controls…';
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
    loading.textContent = 'Sequence controls could not load. Reset the tool to try again.';
    container.replaceChildren(loading);
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
      if (!disposed) loading.remove();
    } catch { failed(); }
  }).catch(failed);
  return cleanup;
};
