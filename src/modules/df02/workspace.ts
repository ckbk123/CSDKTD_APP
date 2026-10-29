import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const child = new AbortController();
  const loading = document.createElement('p'); loading.textContent = 'Loading the tracking-error experiment…'; container.append(loading);
  let disposed = false, release: (() => void) | undefined, failure: HTMLElement | undefined;
  function cleanup(): void {
    if (disposed) return; disposed = true;
    signal.removeEventListener('abort', cleanup); child.abort(); loading.remove(); failure?.remove(); release?.();
  }
  signal.addEventListener('abort', cleanup, { once: true });
  void import('./view').then(module => {
    if (disposed || signal.aborted) return;
    loading.remove();
    const result = module.mount({ container, signal: child.signal });
    if (typeof result === 'function') release = result;
    if (disposed || signal.aborted) release?.();
  }).catch(() => {
    if (disposed || signal.aborted) return;
    // A view can register resources before throwing, without returning cleanup.
    child.abort(); release?.(); loading.remove(); failure = document.createElement('p'); failure.setAttribute('role', 'alert');
    failure.textContent = 'The experiment could not start. Reset the example to retry.'; container.replaceChildren(failure);
  });
  return cleanup;
};
