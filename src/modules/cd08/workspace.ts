import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  const message = document.createElement('p'); message.setAttribute('role', 'status'); message.textContent = 'Loading state-feedback exercise…'; container.append(message);
  let disposed = false, cleanup: (() => void) | undefined;
  void import('./ui').then(ui => {
    if (disposed || signal.aborted) return;
    message.remove(); cleanup = ui.mount({ container, signal }) || undefined;
  }).catch(() => {
    if (disposed || signal.aborted) return;
    message.setAttribute('role', 'alert'); message.textContent = 'The state-feedback exercise could not load. Reset the workspace to retry.'; container.append(message);
  });
  return () => { disposed = true; message.remove(); cleanup?.(); };
};
