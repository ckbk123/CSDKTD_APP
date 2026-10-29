import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  let stopped = false, cleanup: void | (() => void);
  const pending = document.createElement('p'); pending.textContent = 'Loading cubic stability…'; pending.setAttribute('role', 'status');
  const dispose = () => { if (stopped) return; stopped = true; signal.removeEventListener('abort', dispose); pending.remove(); cleanup?.(); };
  if (signal.aborted) return dispose;
  signal.addEventListener('abort', dispose, { once: true }); container.append(pending);
  void import('./ui').then(({ mountUI }) => { if (!stopped && !signal.aborted) { cleanup = mountUI({ container, signal }); pending.remove(); } })
    .catch(() => { if (!stopped && !signal.aborted) pending.textContent = 'The exercise could not load. Reset to try again.'; });
  return dispose;
};
