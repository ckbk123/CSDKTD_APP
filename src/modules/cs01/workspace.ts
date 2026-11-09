import type { ModuleMount } from '../../core/module';
import { mountView } from './view';

function el(tag: 'p', text: string): HTMLParagraphElement {
  const node = document.createElement(tag); node.textContent = text; return node;
}
/** Keep the public synchronous entry importable without running a browser editor in Node. */
export const mount: ModuleMount = context => {
  if (context.signal.aborted) return;
  let disposed = false;
  let cleanup: (() => void) | undefined;
  const visit = new AbortController();
  const loading = el('p', 'Loading visual inputs…'); context.container.append(loading);
  const dispose = (): void => {
    if (disposed) return;
    disposed = true; visit.abort(); cleanup?.(); loading.remove(); context.signal.removeEventListener('abort', dispose);
  };
  context.signal.addEventListener('abort', dispose, { once: true });
  void import('../../shared/equations/input').then(ui => {
    if (disposed || context.signal.aborted) return;
    loading.remove(); const release = mountView({ container: context.container, signal: visit.signal }, ui);
    if (disposed || context.signal.aborted || visit.signal.aborted) release(); else cleanup = release;
  }).catch(() => {
    if (!disposed && !context.signal.aborted) {
      visit.abort(); context.container.replaceChildren(loading);
      loading.textContent = 'Visual inputs could not load. Reset the tool to try again.';
    }
  });
  return dispose;
};
