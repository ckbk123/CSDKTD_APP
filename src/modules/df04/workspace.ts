import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let disposed = false, cleanup: (() => void) | undefined;
  const resources = new AbortController();
  const loading = document.createElement('p'); loading.setAttribute('role', 'status'); loading.textContent = 'Loading sample-period controls…'; container.append(loading);
  const clearLoading = () => loading.remove();
  const abortResources = () => { resources.abort(); clearLoading(); };
  signal.addEventListener('abort', abortResources, { once: true });
  void import('./view').then(view => {
    if (disposed || signal.aborted) { clearLoading(); return; }
    const result = view.mount({ container, signal: resources.signal }); if (typeof result === 'function') cleanup = result; clearLoading();
  }).catch(() => {
    abortResources(); if (disposed || signal.aborted) return;
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status'); feedback.textContent = 'The sample-period workspace could not initialize. Reset the example to try again.'; container.replaceChildren(feedback);
  });
  return () => { if (disposed) return; disposed = true; signal.removeEventListener('abort', abortResources); abortResources(); cleanup?.(); cleanup = undefined; };
};
