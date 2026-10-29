import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = context => {
  let disposed = false, cleanup: (() => void) | void;
  const message = document.createElement('p'); message.textContent = 'Loading ODE and Laplace controls…';
  context.container.append(message);
  void import('./view').then(view => {
    if (disposed || context.signal.aborted) return;
    message.remove(); cleanup = view.mount(context);
  }).catch(() => {
    if (disposed || context.signal.aborted) return;
    message.textContent = 'The exercise could not load. Reset the workspace to try again.';
    message.setAttribute('role', 'alert'); context.container.replaceChildren(message);
  });
  return () => { disposed = true; cleanup?.(); message.remove(); };
};
