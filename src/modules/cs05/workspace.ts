import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const host = document.createElement('div'), loading = document.createElement('p');
  host.dataset.module = 'CS05'; loading.textContent = 'Loading gain-region laboratory…'; host.append(loading); container.append(host);
  const child = new AbortController(); let cleanup: void | (() => void), disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; child.abort(); try { if (typeof cleanup === 'function') cleanup(); } finally { host.remove(); } };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(({ mountView }) => {
    if (disposed || signal.aborted) return;
    try {
      const returned = mountView({ container: host, signal: child.signal });
      if (disposed || signal.aborted) { if (typeof returned === 'function') returned(); return; }
      cleanup = returned; loading.remove();
    }
    catch { child.abort(); if (disposed || signal.aborted) return; host.replaceChildren(); const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = 'The gain-region laboratory could not open. Reset the example to try again.'; host.append(error); }
  }).catch(() => {
    if (disposed || signal.aborted) return; child.abort(); host.replaceChildren(); const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = 'The gain-region laboratory could not load. Reset the example to try again.'; host.append(error);
  });
  return () => { signal.removeEventListener('abort', dispose); dispose(); };
};
