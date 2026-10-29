import type { ModuleMount } from '../../core/module';

/** Browser-only equation UI loads after mount, with an explicit stale-visit guard. */
export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  let disposed = false;
  let release: void | (() => void);
  const viewController = new AbortController();
  const host = document.createElement('div');
  const message = document.createElement('p');
  message.textContent = 'Loading sequence editor…';
  host.append(message); container.append(host);
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    signal.removeEventListener('abort', dispose);
    viewController.abort();
    const disposeView = release; release = undefined;
    try { disposeView?.(); } finally { host.remove(); }
  };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(({ mountView }) => {
    if (disposed || signal.aborted) return;
    message.remove();
    const disposeView = mountView({ container: host, signal: viewController.signal });
    if (typeof disposeView === 'function') {
      if (disposed || viewController.signal.aborted) disposeView();
      else release = disposeView;
    }
  }).catch(() => {
    if (disposed || signal.aborted) return;
    viewController.abort();
    message.textContent = 'The sequence editor could not load. Reset the tool to try again.';
    host.replaceChildren(message);
  });
  return dispose;
};
