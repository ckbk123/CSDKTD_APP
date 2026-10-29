import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const child = new AbortController(), host = document.createElement('div'), loading = document.createElement('p');
  loading.textContent = 'Loading lag-compensation exercise…'; host.append(loading); container.append(host);
  let disposed = false, cleanup: (() => void) | undefined;
  const dispose = () => { if (disposed) return; disposed = true; child.abort(); signal.removeEventListener('abort', dispose); try { cleanup?.(); } finally { cleanup = undefined; host.remove(); } };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(view => {
    if (disposed || signal.aborted) return;
    loading.remove(); const mounted = view.mount({ container: host, signal: child.signal });
    if (disposed || child.signal.aborted) { mounted?.(); return; } cleanup = mounted || undefined;
  }).catch(() => {
    child.abort(); loading.remove(); if (disposed || signal.aborted) return;
    const message = document.createElement('p'); message.textContent = 'The exercise could not load. Reset the tool to retry.'; host.replaceChildren(message);
  }); return dispose;
};
