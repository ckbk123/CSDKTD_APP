import type { ModuleMount } from '../../core/module';

/** Keep browser-only equation components behind the mounted visit boundary. */
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const child = new AbortController(), host = document.createElement('div');
  const loading = document.createElement('p');
  loading.textContent = 'Loading sinusoidal experiment…';
  loading.setAttribute('role', 'status'); host.append(loading); container.append(host);
  let closed = false;
  let dispose: (() => void) | undefined;
  const cleanup = () => {
    if (closed) return;
    closed = true; child.abort();
    signal.removeEventListener('abort', cleanup);
    const release = dispose; dispose = undefined;
    try { release?.(); } finally { host.remove(); }
  };
  signal.addEventListener('abort', cleanup, { once: true });
  void import('./view').then(view => {
    if (closed || signal.aborted) return;
    const result = view.mount({ container: host, signal: child.signal });
    if (closed || signal.aborted) { if (typeof result === 'function') result(); return; }
    if (typeof result === 'function') dispose = result;
    loading.remove();
  }).catch(() => {
    child.abort();
    if (closed || signal.aborted) return;
    loading.textContent = 'The experiment could not load. Reset the tool to try again.';
    loading.setAttribute('role', 'alert');
    host.replaceChildren(loading);
  });
  return cleanup;
};
