import type { ModuleMount } from '../../core/module';

/** Browser-only code stays deferred; each visit owns its partial resources. */
export const mount: ModuleMount = context => {
  if (context.signal.aborted) return;
  const child = new AbortController();
  let disposed = false, release: (() => void) | undefined;
  const loading = document.createElement('p'); loading.textContent = 'Loading difference-equation controls…';
  context.container.append(loading);
  const cleanup = () => {
    if (disposed) return;
    disposed = true; context.signal.removeEventListener('abort', cleanup); child.abort();
    const disposeView = release; release = undefined;
    try { disposeView?.(); } finally { loading.remove(); }
  };
  const failed = () => {
    child.abort();
    if (disposed || context.signal.aborted) return;
    loading.textContent = 'The exercise could not load. Reset the workspace to try again.';
    loading.setAttribute('role', 'alert'); context.container.replaceChildren(loading);
  };
  context.signal.addEventListener('abort', cleanup, { once: true });
  void import('./view').then(view => {
    if (disposed || context.signal.aborted) return;
    try {
      const disposeView = view.mount({ container: context.container, signal: child.signal });
      if (typeof disposeView === 'function') {
        if (disposed || child.signal.aborted) disposeView();
        else release = disposeView;
      }
      if (!disposed) loading.remove();
    } catch { failed(); }
  }).catch(failed);
  return cleanup;
};
