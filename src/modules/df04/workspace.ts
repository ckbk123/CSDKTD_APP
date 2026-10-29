import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let disposed = false, cleanup: (() => void) | undefined;
  const resources = new AbortController();
  const host = document.createElement('div');
  const loading = document.createElement('p'); loading.setAttribute('role', 'status'); loading.textContent = 'Loading sample-period controls…'; host.append(loading); container.append(host);
  const clearLoading = () => loading.remove();
  const abortResources = () => { resources.abort(); clearLoading(); };
  const dispose = () => {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', dispose); abortResources();
    const release = cleanup; cleanup = undefined;
    try { release?.(); } finally { host.remove(); }
  };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(view => {
    if (disposed || signal.aborted) { clearLoading(); return; }
    const result = view.mount({ container: host, signal: resources.signal });
    if (disposed || signal.aborted) { if (typeof result === 'function') result(); return; }
    if (typeof result === 'function') cleanup = result; clearLoading();
  }).catch(() => {
    abortResources(); if (disposed || signal.aborted) return;
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status'); feedback.textContent = 'The sample-period workspace could not initialize. Reset the example to try again.'; host.replaceChildren(feedback);
  });
  return dispose;
};
