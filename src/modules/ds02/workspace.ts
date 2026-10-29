import type { ModuleMount } from '../../core/module';

// Keep browser-only MathLive out of catalogue import checks. The shell mount
// stays synchronous; a superseded visit must not create editors or controls.
export const mount: ModuleMount = ({ container, signal }) => {
  let disposed = false;
  let cleanup: (() => void) | undefined;
  const loading = document.createElement('p');
  loading.setAttribute('role', 'status'); loading.textContent = 'Loading Jury exercise…';
  container.append(loading);
  void import('./ui').then(ui => {
    if (disposed || signal.aborted) return;
    loading.remove();
    cleanup = ui.mount({ container, signal }) || undefined;
  }).catch(() => {
    if (disposed || signal.aborted) return;
    loading.setAttribute('role', 'alert');
    loading.textContent = 'The Jury exercise could not load. Reset the workspace to try again.';
    container.append(loading);
  });
  return () => { disposed = true; loading.remove(); cleanup?.(); };
};
