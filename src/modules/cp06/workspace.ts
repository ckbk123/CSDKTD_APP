import type { ModuleMount } from '../../core/module';

type View = { readonly mountView: ModuleMount };
/** A visit owns its deferred view's signal, including a partially mounted view. */
export function mountDeferred({ container, signal }: Parameters<ModuleMount>[0], load: () => Promise<View>): () => void {
  const root = document.createElement('div'); root.dataset.module = 'CP06';
  const loading = document.createElement('p'); loading.textContent = 'Loading root-locus controls…'; loading.setAttribute('role', 'status');
  root.append(loading); container.append(root);
  const child = new AbortController(); let disposed = false, cleanup: (() => void) | undefined;
  function dispose(): void {
    if (disposed) return;
    disposed = true; signal.removeEventListener('abort', dispose); child.abort(); cleanup?.(); loading.remove(); root.remove();
  }
  signal.addEventListener('abort', dispose, { once: true });
  if (signal.aborted) dispose();
  else void load().then(view => {
    if (disposed) return;
    loading.remove(); cleanup = view.mountView({ container: root, signal: child.signal }) || undefined;
    if (disposed) cleanup?.();
  }).catch(() => {
    if (disposed) return;
    child.abort(); cleanup?.(); loading.remove(); root.replaceChildren();
    const message = document.createElement('p'); message.setAttribute('role', 'alert');
    message.textContent = 'The root-locus controls could not load. Reset this tool to retry.'; root.append(message);
  });
  return dispose;
}
export const mount: ModuleMount = context => mountDeferred(context, () => import('./view'));

