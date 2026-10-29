import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const child = new AbortController(), host = document.createElement('div'), message = document.createElement('p');
  let disposed = false, release: void | (() => void);
  message.textContent = 'Loading frequency editor…'; host.append(message); container.append(host);
  const dispose = () => {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', dispose); child.abort();
    const disposeView = release; release = undefined;
    try { disposeView?.(); } finally { host.remove(); }
  };
  signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(({ mountView }) => {
    if (disposed || signal.aborted) return;
    message.remove();
    const disposeView = mountView({ container: host, signal: child.signal });
    if (typeof disposeView === 'function') {
      if (disposed || child.signal.aborted) disposeView();
      else release = disposeView;
    }
  }).catch(() => {
    if (disposed || signal.aborted) return;
    child.abort(); message.textContent = 'The frequency editor could not load. Reset the example to try again.'; host.replaceChildren(message);
  });
  return dispose;
};
