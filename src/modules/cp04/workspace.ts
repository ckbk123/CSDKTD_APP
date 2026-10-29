import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let disposed = false;
  let cleanup: void | (() => void);
  const visit = new AbortController();
  const host = document.createElement('div');
  const loading = document.createElement('p'); loading.textContent = 'Loading visual inputs…'; host.append(loading); container.append(host);
  const dispose = (): void => {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', dispose); visit.abort();
    const release = cleanup; cleanup = undefined;
    try { release?.(); } finally { host.remove(); }
  };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(view => {
    if (disposed || signal.aborted) return;
    const release = view.mountView({ container: host, signal: visit.signal });
    if (disposed || signal.aborted) { release?.(); return; }
    cleanup = release; loading.remove();
  }).catch(() => {
    visit.abort();
    if (disposed || signal.aborted) return;
    host.replaceChildren(loading); loading.textContent = 'Visual inputs could not load. Reset the tool to try again.'; loading.setAttribute('role', 'alert');
  });
  return dispose;
};
