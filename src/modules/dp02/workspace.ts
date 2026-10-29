import type { ModuleMount } from '../../core/module';

/** Keep browser-only MathLive initialization out of metadata/entry-point inspection.
 * Mount remains synchronous; late view imports cannot touch an aborted visit. */
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const pending = document.createElement('p'); pending.textContent = 'Loading pole mapping…';
  container.append(pending);
  let disposed = false;
  let release: (() => void) | undefined;
  void import('./view').then(view => {
    if (disposed || signal.aborted) return;
    pending.remove();
    const cleanup = view.mount({ container, signal });
    if (typeof cleanup === 'function') release = cleanup;
  }).catch(() => {
    if (!disposed && !signal.aborted) {
      pending.textContent = 'Pole mapping could not load. Reset the tool to try again.';
      container.replaceChildren(pending);
    }
  });
  const cleanup = () => { if (disposed) return; disposed = true; release?.(); pending.remove(); };
  signal.addEventListener('abort', cleanup, { once: true });
  return () => { signal.removeEventListener('abort', cleanup); cleanup(); };
};
