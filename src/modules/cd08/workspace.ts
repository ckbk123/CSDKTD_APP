import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  const host = document.createElement('div'), lifetime = new AbortController(); container.append(host);
  const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Loading state-feedback exercise…'; host.append(message);
  let disposed = false, cleanup: (() => void) | undefined;
  const dispose = () => { if (disposed) return; disposed = true; lifetime.abort(); signal.removeEventListener('abort', dispose); cleanup?.(); host.remove(); };
  signal.addEventListener('abort', dispose, { once: true });
  if (signal.aborted) { dispose(); return dispose; }
  void import('./ui').then(ui => {
    if (disposed || lifetime.signal.aborted) return;
    message.remove();
    const mountedCleanup = ui.mount({ container: host, signal: lifetime.signal }) || undefined;
    if (disposed || lifetime.signal.aborted) mountedCleanup?.(); else cleanup = mountedCleanup;
  }).catch(() => {
    if (disposed || signal.aborted) return;
    lifetime.abort(); host.replaceChildren(message);
    message.setAttribute('role', 'alert'); message.textContent = 'The state-feedback exercise could not load. Reset the workspace to retry.';
  });
  return dispose;
};
