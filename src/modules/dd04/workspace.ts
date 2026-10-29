import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const pending = document.createElement('p'); pending.textContent = 'Loading digital PID…'; container.append(pending);
  let disposed = false;
  let release: (() => void) | undefined;
  void import('./view').then(view => {
    if (disposed || signal.aborted) return;
    const cleanup = view.mount({ container, signal });
    pending.remove();
    if (typeof cleanup === 'function') release = cleanup;
  }).catch(() => {
    if (!disposed && !signal.aborted) { pending.textContent = 'Digital PID could not load. Reset the tool to try again.'; container.replaceChildren(pending); }
  });
  const cleanup = () => { if (disposed) return; disposed = true; release?.(); pending.remove(); };
  signal.addEventListener('abort', cleanup, { once: true });
  return () => { signal.removeEventListener('abort', cleanup); cleanup(); };
};
