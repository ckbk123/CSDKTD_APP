import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = context => {
  if (context.signal.aborted) return;
  let disposed = false, cleanup: (() => void) | void;
  const viewController = new AbortController();
  const message = document.createElement('p'); message.textContent = 'Loading realization and coordinate controls…';
  const abortView = () => { viewController.abort(); message.remove(); };
  context.signal.addEventListener('abort', abortView, { once: true }); context.container.append(message);
  void import('./view').then(view => {
    if (disposed || context.signal.aborted) return;
    message.remove(); cleanup = view.mount({ container: context.container, signal: viewController.signal });
  }).catch(() => {
    if (disposed || context.signal.aborted) return;
    viewController.abort();
    message.textContent = 'The exercise could not load. Reset the workspace to try again.'; message.setAttribute('role', 'alert'); context.container.replaceChildren(message);
  });
  return () => { disposed = true; context.signal.removeEventListener('abort', abortView); abortView(); cleanup?.(); };
};
