import type { ModuleMount } from '../../core/module';

/** Keep the public entry importable without initializing browser-only MathLive.
 * The view still belongs to this visit; closing during its import cannot mount it.
 */
export const mount: ModuleMount = ({ container, signal }) => {
  let closed = signal.aborted;
  let dispose: (() => void) | undefined;
  const loading = document.createElement('p');
  loading.textContent = 'Loading sampled response exercise…';
  if (!closed) container.append(loading);
  void import('./view').then(view => {
    if (closed || signal.aborted) return;
    loading.remove();
    dispose = view.mount({ container, signal }) || undefined;
  }).catch(() => {
    if (!closed && !signal.aborted) loading.textContent = 'The exercise could not load. Reset the tool to retry.';
  });
  return () => { closed = true; dispose?.(); dispose = undefined; loading.remove(); };
};
