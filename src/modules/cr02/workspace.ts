import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = context => {
  if (context.signal.aborted) return;
  const child = new AbortController(), host = document.createElement('div');
  const message = document.createElement('p'); message.textContent = 'Loading ODE and Laplace controls…';
  host.append(message); context.container.append(host);
  let disposed = false, cleanup: (() => void) | void;
  const dispose = () => {
    if (disposed) return;
    disposed = true; context.signal.removeEventListener('abort', dispose); child.abort();
    const release = cleanup; cleanup = undefined;
    try { release?.(); } finally { host.remove(); }
  };
  context.signal.addEventListener('abort', dispose, { once: true });
  void import('./view').then(view => {
    if (disposed || context.signal.aborted) return;
    const release = view.mount({ ...context, container: host, signal: child.signal });
    if (disposed || context.signal.aborted) { release?.(); return; }
    cleanup = release; message.remove();
  }).catch(() => {
    child.abort();
    if (disposed || context.signal.aborted) return;
    message.textContent = 'The exercise could not load. Reset the workspace to try again.';
    message.setAttribute('role', 'alert'); host.replaceChildren(message);
  });
  return dispose;
};
