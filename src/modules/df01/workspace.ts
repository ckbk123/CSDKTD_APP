import type { ModuleMount } from '../../core/module';

/** Public entry remains synchronous and owns every deferred view resource. */
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let closed = false, release: (() => void) | undefined;
  const child = new AbortController(), loading = document.createElement('p');
  loading.textContent = 'Loading sampled response exercise…'; container.append(loading);
  const cleanup = () => {
    if (closed) return;
    closed = true; signal.removeEventListener('abort', cleanup); child.abort();
    const disposeView = release; release = undefined;
    try { disposeView?.(); } finally { loading.remove(); }
  };
  const failed = () => {
    child.abort();
    if (closed || signal.aborted) return;
    loading.textContent = 'The exercise could not load. Reset the tool to retry.'; container.replaceChildren(loading);
  };
  signal.addEventListener('abort', cleanup, { once: true });
  void import('./view').then(view => {
    if (closed || signal.aborted) return;
    try {
      const disposeView = view.mount({ container, signal: child.signal });
      if (typeof disposeView === 'function') {
        if (closed || child.signal.aborted) disposeView();
        else release = disposeView;
      }
      if (!closed) loading.remove();
    } catch { failed(); }
  }).catch(failed);
  return cleanup;
};
