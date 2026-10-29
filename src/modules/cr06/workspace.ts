import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  const child = new AbortController(), host = document.createElement('div'), loading = document.createElement('p');
  loading.textContent = 'Loading state workspace…'; host.append(loading); container.append(host);
  let disposed = false, cleanup: (() => void) | undefined;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true; child.abort(); signal.removeEventListener('abort', dispose);
    try { cleanup?.(); } finally { host.remove(); }
  };
  signal.addEventListener('abort', dispose, { once: true });
  if (signal.aborted) dispose();
  else void import('./view').then(view => {
    if (disposed || child.signal.aborted) return;
    loading.remove();
    cleanup = view.mount({ container: host, signal: child.signal }) || undefined;
  }).catch(() => {
    if (disposed || signal.aborted) return;
    // Partial mounts can allocate signal-owned resources before throwing.
    child.abort(); loading.textContent = 'The state workspace could not open. Reset the example to try again.';
    host.replaceChildren(loading);
  });
  return dispose;
};
