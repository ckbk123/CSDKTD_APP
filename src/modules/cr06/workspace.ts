import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  const loading = document.createElement('p'); loading.textContent = 'Loading state workspace…'; container.append(loading);
  let disposed = false, cleanup: (() => void) | undefined;
  void import('./view').then(view => {
    if (disposed || signal.aborted) return;
    loading.remove();
    try { cleanup = view.mount({ container, signal }) || undefined; }
    catch { container.replaceChildren(loading); loading.textContent = 'The state workspace could not open. Reset the example to try again.'; }
  }).catch(() => {
    if (!disposed && !signal.aborted) { loading.textContent = 'The state workspace could not open. Reset the example to try again.'; if (!loading.isConnected) container.append(loading); }
  });
  return () => { disposed = true; cleanup?.(); loading.remove(); };
};
