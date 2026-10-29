import type { ModuleMount } from '../../core/module';

/** Browser-only equation UI loads after mount, with an explicit stale-visit guard. */
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let disposed = false;
  let release: void | (() => void);
  const message = document.createElement('p');
  message.textContent = 'Loading sequence editor…';
  container.append(message);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', dispose);
    release?.(); message.remove();
  };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(({ mountView }) => {
    if (disposed || signal.aborted) return;
    message.remove();
    release = mountView({ container, signal });
  }).catch(() => {
    if (!disposed && !signal.aborted) message.textContent = 'The sequence editor could not load. Reset the tool to try again.';
  });
  return dispose;
};
