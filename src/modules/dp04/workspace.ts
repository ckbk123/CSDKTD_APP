import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let disposed = false, release: (() => void) | undefined;
  const child = new AbortController();
  const loading = document.createElement('p'); loading.setAttribute('role', 'status'); loading.textContent = 'Loading root-locus controls…'; container.append(loading);
  const cleanup = () => {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', cleanup); child.abort();
    const disposeView = release; release = undefined;
    try { disposeView?.(); } finally { loading.remove(); }
  };
  const failed = () => {
    child.abort();
    if (disposed || signal.aborted) return;
    loading.textContent = 'The root-locus workspace could not initialize. Reset the example to try again.';
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
