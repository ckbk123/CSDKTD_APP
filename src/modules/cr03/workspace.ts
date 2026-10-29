import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = context => {
  let disposed = false, cleanup: (() => void) | void;
  const viewController = new AbortController();
  context.signal.addEventListener('abort', () => viewController.abort(), { once: true, signal: viewController.signal });
  if (context.signal.aborted) viewController.abort();
  const message = document.createElement('p'); message.textContent = 'Loading realization and coordinate controls…'; context.container.append(message);
  void import('./view').then(view => {
    if (disposed || context.signal.aborted) return;
    message.remove(); cleanup = view.mount({ container: context.container, signal: viewController.signal });
  }).catch(() => {
    if (disposed || context.signal.aborted) return;
    viewController.abort();
    message.textContent = 'The exercise could not load. Reset the workspace to try again.'; message.setAttribute('role', 'alert'); context.container.replaceChildren(message);
  });
  return () => { disposed = true; viewController.abort(); cleanup?.(); message.remove(); };
};
