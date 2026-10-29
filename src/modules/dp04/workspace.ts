import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let disposed = false, cleanup: (() => void) | undefined;
  void import('./view').then(view => {
    if (disposed || signal.aborted) return;
    const result = view.mount({ container, signal });
    if (typeof result === 'function') cleanup = result;
  }).catch(() => {
    if (disposed || signal.aborted) return;
    const feedback = document.createElement('p'); feedback.setAttribute('role', 'status');
    feedback.textContent = 'The root-locus workspace could not initialize. Reset the example to try again.';
    container.replaceChildren(feedback);
  });
  return () => { if (disposed) return; disposed = true; cleanup?.(); cleanup = undefined; };
};
