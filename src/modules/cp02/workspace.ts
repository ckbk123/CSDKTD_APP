import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let disposed = false;
  let cleanup: void | (() => void);
  const visit = new AbortController();
  const loading = document.createElement('p'); loading.textContent = 'Loading visual inputs…'; container.append(loading);
  const dispose = (): void => { if (disposed) return; disposed = true; visit.abort(); cleanup?.(); loading.remove(); signal.removeEventListener('abort', dispose); };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(view => {
    if (disposed || signal.aborted) return;
    loading.remove(); cleanup = view.mountView({ container, signal: visit.signal });
  }).catch(() => {
    if (disposed || signal.aborted) return;
    visit.abort(); container.replaceChildren(loading); loading.textContent = 'Visual inputs could not load. Reset the tool to try again.';
  });
  return dispose;
};
