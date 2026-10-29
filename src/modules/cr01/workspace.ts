import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const host = document.createElement('div'), loading = document.createElement('p');
  host.dataset.module = 'CR01'; loading.textContent = 'Loading polynomial laboratory…'; host.append(loading); container.append(host);
  const child = new AbortController(); let cleanup: void | (() => void), disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; child.abort(); if (typeof cleanup === 'function') cleanup(); host.remove(); };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(({ mountView }) => {
    if (disposed || signal.aborted) return;
    try {
      const mounted = mountView({ container: host, signal: child.signal });
      if (disposed || child.signal.aborted) { if (typeof mounted === 'function') mounted(); return; }
      cleanup = mounted; loading.remove();
    }
    catch { if (disposed || signal.aborted) return; child.abort(); host.replaceChildren(); const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = 'The polynomial laboratory could not open. Reset the example to try again.'; host.append(error); }
  }).catch(() => {
    if (disposed || signal.aborted) return; child.abort(); host.replaceChildren(); const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = 'The polynomial laboratory could not load. Reset the example to try again.'; host.append(error);
  });
  return () => { signal.removeEventListener('abort', dispose); dispose(); };
};
