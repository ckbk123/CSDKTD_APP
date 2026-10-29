import type { ModuleMount } from '../../core/module';

/** Keep browser-only equation components behind the mounted visit boundary. */
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const loading = document.createElement('p');
  loading.textContent = 'Loading sinusoidal experiment…';
  loading.setAttribute('role', 'status'); container.append(loading);
  let closed = false;
  let dispose: (() => void) | undefined;
  const cleanup = () => {
    if (closed) return;
    closed = true; dispose?.(); loading.remove();
    signal.removeEventListener('abort', cleanup);
  };
  signal.addEventListener('abort', cleanup, { once: true });
  void import('./view').then(view => {
    if (closed || signal.aborted) return;
    loading.remove();
    const result = view.mount({ container, signal });
    if (typeof result === 'function') dispose = result;
  }).catch(() => {
    if (closed || signal.aborted) return;
    loading.textContent = 'The experiment could not load. Reset the tool to try again.';
    loading.setAttribute('role', 'alert');
  });
  return cleanup;
};
