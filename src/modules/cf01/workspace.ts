import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const host = document.createElement('div'), loading = document.createElement('p'), child = new AbortController();
  loading.textContent = 'Loading transient specifications…'; host.append(loading); container.append(host);
  let closed = false, cleanup: (() => void) | undefined;
  const dispose = () => {
    if (closed) return;
    closed = true; child.abort(); signal.removeEventListener('abort', dispose);
    try { cleanup?.(); } finally { cleanup = undefined; host.remove(); }
  };
  signal.addEventListener('abort', dispose, { once: true });
  const recover = () => {
    child.abort(); loading.remove();
    if (closed || signal.aborted) return;
    const message = document.createElement('p'); message.textContent = 'The exercise could not load. Reset the tool to retry.'; host.replaceChildren(message);
  };
  void import('./view').then(view => {
    if (closed || signal.aborted) return;
    loading.remove(); cleanup = view.mount({ container: host, signal: child.signal }) || undefined;
  }).catch(recover);
  return dispose;
};
