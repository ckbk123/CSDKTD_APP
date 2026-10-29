import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const host = document.createElement('div'), loading = document.createElement('p');
  host.dataset.module = 'CP05'; loading.textContent = 'Loading Nyquist construction…'; loading.setAttribute('role','status'); host.append(loading); container.append(host);
  const child = new AbortController(); let cleanup: void | (() => void), disposed = false;
  const dispose = () => { if (disposed) return; disposed = true; signal.removeEventListener('abort',dispose); child.abort(); const release=cleanup;cleanup=undefined;try { if (typeof release === 'function') release(); } finally { host.remove(); } };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(({ mountView }) => {
    if (disposed || signal.aborted) return;
    try {
      const returned = mountView({ container: host, signal: child.signal });
      if (disposed || signal.aborted) { if (typeof returned === 'function') returned(); return; }
      cleanup = returned; loading.remove();
    }
    catch { child.abort(); if (disposed || signal.aborted) return; host.replaceChildren(); const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = 'The Nyquist construction could not open. Reset the example to try again.'; host.append(error); }
  }).catch(() => {
    if (disposed || signal.aborted) return; child.abort(); if(disposed)return;host.replaceChildren(); const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = 'The Nyquist construction could not load. Reset the example to try again.'; host.append(error);
  });
  return () => { signal.removeEventListener('abort', dispose); dispose(); };
};
