import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let stopped = false, release: (() => void) | undefined;
  const child = new AbortController();
  const pending = document.createElement('p'); pending.textContent = 'Loading the exercise…'; pending.setAttribute('role', 'status'); container.append(pending);
  const dispose = () => {
    if (stopped) return;
    stopped = true; signal.removeEventListener('abort', dispose); child.abort();
    const disposeView = release; release = undefined;
    try { disposeView?.(); } finally { pending.remove(); }
  };
  const failed = () => {
    child.abort();
    if (stopped || signal.aborted) return;
    pending.textContent = 'The exercise could not load. Reset to try again.'; container.replaceChildren(pending);
  };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./ui').then(({ mountUI }) => {
    if (stopped || signal.aborted) return;
    try {
      const disposeView = mountUI({ container, signal: child.signal });
      if (typeof disposeView === 'function') {
        if (stopped || child.signal.aborted) disposeView();
        else release = disposeView;
      }
      if (!stopped) pending.remove();
    } catch { failed(); }
  }).catch(failed);
  return dispose;
};
