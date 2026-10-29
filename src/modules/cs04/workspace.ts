import type { ModuleMount } from '../../core/module';

/** Keep the browser equation dependency behind the synchronous entry point. */
export function mountWithLoader(
  { container, signal }: Parameters<ModuleMount>[0],
  load: () => Promise<{ mount: ModuleMount }>,
): () => void {
  const host = document.createElement('div'), lifetime = new AbortController();
  const message = document.createElement('p'); message.setAttribute('role', 'status');
  message.textContent = 'Loading Nyquist stability exercise…'; host.append(message); container.append(host);
  let disposed = false, release: (() => void) | undefined;
  const dispose = () => {
    if (disposed) return; disposed = true; signal.removeEventListener('abort', dispose); lifetime.abort();
    const cleanup = release; release = undefined;
    try { cleanup?.(); } finally { host.remove(); }
  };
  signal.addEventListener('abort', dispose, { once: true });
  if (signal.aborted) { dispose(); return dispose; }
  void load().then(view => {
    if (disposed || lifetime.signal.aborted) return;
    message.remove();
    const cleanup = view.mount({ container: host, signal: lifetime.signal }) || undefined;
    if (disposed || lifetime.signal.aborted) cleanup?.(); else release = cleanup;
  }).catch(() => {
    if (disposed || signal.aborted) return;
    lifetime.abort(); host.replaceChildren(message); message.setAttribute('role', 'alert');
    message.textContent = 'The Nyquist stability exercise could not load. Reset the workspace to retry.';
  });
  return dispose;
}

export const mount: ModuleMount = context => mountWithLoader(context, () => import('./view'));
