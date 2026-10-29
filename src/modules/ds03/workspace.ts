import type { ModuleMount } from '../../core/module';

// Keep browser-only MathLive out of catalogue import checks. The visit still
// mounts synchronously and owns disposal while its local UI chunk is loading.
export const mount: ModuleMount = ({ container, signal }) => {
  let disposed = false;
  let cleanup: void | (() => void);
  const pending = document.createElement('p'); pending.textContent = 'Loading the exercise…';
  pending.setAttribute('role', 'status');
  const dispose = () => {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', dispose); pending.remove(); cleanup?.();
  };
  if (signal.aborted) return dispose;
  signal.addEventListener('abort', dispose, { once: true });
  container.append(pending);
  void import('./ui').then(({ mountUI }) => {
    if (disposed || signal.aborted) return;
    pending.remove(); cleanup = mountUI({ container, signal });
  }).catch(() => {
    if (!disposed && !signal.aborted) pending.textContent = 'The exercise could not load. Reset the tool to try again.';
  });
  return dispose;
};
