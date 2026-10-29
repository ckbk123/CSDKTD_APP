import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let disposed = false, cleanup: (() => void) | undefined;
  const loading = document.createElement('p'); loading.setAttribute('role', 'status'); loading.textContent = 'Loading root-locus controls…'; container.append(loading);
  const clearLoading = () => loading.remove();
  signal.addEventListener('abort', clearLoading, { once: true });
  void import('./view').then(view => {
    if (disposed || signal.aborted) { clearLoading(); return; }
    const result = view.mount({ container, signal });
    if (typeof result === 'function') cleanup = result;
    clearLoading();
  }).catch(() => {
    clearLoading();
    if (disposed || signal.aborted) return;
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
    feedback.textContent = 'The root-locus workspace could not initialize. Reset the example to try again.';
    container.replaceChildren(feedback);
  });
  return () => { if (disposed) return; disposed = true; signal.removeEventListener('abort', clearLoading); clearLoading(); cleanup?.(); cleanup = undefined; };
};
