import type { ModuleMount } from '../../core/module';

// Keep browser-only MathLive out of catalogue import checks. The shell mount
// stays synchronous; a superseded visit must not create editors or controls.
export const mount: ModuleMount = ({ container, signal }) => {
  let disposed = false;
  let cleanup: (() => void) | undefined;
  void import('./ui').then(ui => {
    if (disposed || signal.aborted) return;
    cleanup = ui.mount({ container, signal }) || undefined;
  }).catch(() => {
    if (disposed || signal.aborted) return;
    const message = document.createElement('p');
    message.setAttribute('role', 'alert');
    message.textContent = 'The Jury exercise could not load. Reset the workspace to try again.';
    container.append(message);
  });
  return () => { disposed = true; cleanup?.(); };
};
