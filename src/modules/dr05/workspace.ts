import type { ModuleMount } from '../../core/module';

/** Keep the public mount synchronous. The browser-only equation editor loads
 * after mounting; abort/cleanup rejects any late completion. */
export const mount: ModuleMount = context => {
  let cleanup: ReturnType<ModuleMount>;
  let disposed = false;
  const child = new AbortController(), host = document.createElement('div');
  const loading = document.createElement('p');
  loading.textContent = 'Loading sampling controls…';
  host.append(loading); context.container.append(host);
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    child.abort(); context.signal.removeEventListener('abort', dispose);
    try { if (typeof cleanup === 'function') cleanup(); }
    finally { host.remove(); }
  };
  context.signal.addEventListener('abort', dispose, { once: true });
  if (context.signal.aborted) dispose();
  else void import('./view').then(view => {
    if (disposed || child.signal.aborted) return;
    loading.remove();
    cleanup = view.mount({ container: host, signal: child.signal });
  }).catch(() => {
    if (disposed || context.signal.aborted) return;
    // A partially mounted editor/listener already owns this signal even if
    // mount throws before it can return its normal cleanup function.
    child.abort();
    loading.textContent = 'Sampling controls could not load. Reset the tool to try again.';
    host.replaceChildren(loading);
  });
  return dispose;
};
