import type { ModuleMount } from '../../core/module';

/** Keep the public mount synchronous. The browser-only equation editor loads
 * after mounting; abort/cleanup rejects any late completion. */
export const mount: ModuleMount = context => {
  let cleanup: ReturnType<ModuleMount>;
  let disposed = false;
  const loading = document.createElement('p');
  loading.textContent = 'Loading sampling controls…';
  context.container.append(loading);
  void import('./view').then(view => {
    if (disposed || context.signal.aborted) return;
    loading.remove();
    cleanup = view.mount(context);
  }).catch(() => {
    if (!disposed && !context.signal.aborted) {
      loading.textContent = 'Sampling controls could not load. Reset the tool to try again.';
      context.container.replaceChildren(loading);
    }
  });
  return () => {
    disposed = true;
    if (typeof cleanup === 'function') cleanup();
    loading.remove();
  };
};
