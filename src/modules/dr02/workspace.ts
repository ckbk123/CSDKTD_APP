import type { ModuleMount } from '../../core/module';

/** Keep browser-only equation code out of metadata/contract inspection in Node.
 * The mount remains synchronous; a late view import never touches a left page. */
export const mount: ModuleMount = context => {
  let disposed = false;
  let cleanup: (() => void) | void;
  const loading = document.createElement('p'); loading.textContent = 'Loading difference-equation controls…';
  context.container.append(loading);
  void import('./view').then(view => {
    if (disposed || context.signal.aborted) return;
    loading.remove(); cleanup = view.mount(context);
  }).catch(() => {
    if (disposed || context.signal.aborted) return;
    loading.textContent = 'The exercise could not load. Reset the workspace to try again.';
    loading.setAttribute('role', 'alert');
    context.container.replaceChildren(loading);
  });
  return () => { disposed = true; cleanup?.(); loading.remove(); };
};
