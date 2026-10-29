import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  let stopped = false, cleanup: void | (() => void);
  const view = document.createElement('div'), lifetime = new AbortController();
  const pending = document.createElement('p'); pending.textContent = 'Loading cubic stability…'; pending.setAttribute('role', 'status');
  const clearView = () => { lifetime.abort(); const release = cleanup; cleanup = undefined; try { release?.(); } finally { view.remove(); } };
  const dispose = () => { if (stopped) return; stopped = true; signal.removeEventListener('abort', dispose); pending.remove(); clearView(); };
  if (signal.aborted) return dispose;
  signal.addEventListener('abort', dispose, { once: true }); container.append(pending, view);
  void import('./ui').then(({ mountUI }) => {
    if (stopped || signal.aborted) return;
    cleanup = mountUI({ container: view, signal: lifetime.signal });
    if (stopped || signal.aborted) clearView();
    pending.remove();
  }).catch(() => { clearView(); if (!stopped && !signal.aborted) pending.textContent = 'The exercise could not load. Reset to try again.'; });
  return dispose;
};
