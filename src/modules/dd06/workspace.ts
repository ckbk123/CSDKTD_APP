import type { ModuleMount } from '../../core/module';

export const mount: ModuleMount = ({ container, signal }) => {
  if (signal.aborted) return;
  const child = new AbortController(), loading = document.createElement('p');
  loading.textContent = 'Loading the state-feedback exercise…'; container.append(loading);
  let disposed = false, release: (() => void) | undefined, failure: HTMLElement | undefined;
  function cleanup(): void {
    if (disposed) return; disposed = true;
    signal.removeEventListener('abort', cleanup); child.abort(); loading.remove(); failure?.remove();
    const disposeView = release; release = undefined; disposeView?.();
  }
  signal.addEventListener('abort', cleanup, { once: true });
  void import('./view').then(module => {
    if (disposed || signal.aborted) return;
    loading.remove(); const result = module.mount({ container, signal: child.signal });
    if (typeof result === 'function') {
      if (disposed || child.signal.aborted) result();
      else release = result;
    }
  }).catch(() => {
    if (disposed || signal.aborted) return;
    child.abort(); release?.(); loading.remove(); failure = document.createElement('p'); failure.setAttribute('role', 'alert');
    failure.textContent = 'The state-feedback exercise could not start. Reset the example to retry.'; container.replaceChildren(failure);
  });
  return cleanup;
};
