import type { ModuleMount } from '../../core/module';
import { mountExplore, type ModeHooks } from './explore';
import { mountView as mountPractice } from './practice';
import './workspace.css';

type PanelMount = (context: Parameters<ModuleMount>[0] & { hooks: ModeHooks; isActive: () => boolean }) => void | (() => void);
/** Retained visit-local panels own separate scopes, including failed/late mounts. */
export function mountPanels(context: Parameters<ModuleMount>[0], mounts: [PanelMount, PanelMount] = [mountExplore, mountPractice]): () => void {
  const { container, signal } = context;
  if (signal.aborted) return () => {};
  const root = document.createElement('div'); root.className = 'cp02-modes'; root.dataset.module = 'CP02';
  const label = document.createElement('label'), choice = document.createElement('select'); label.textContent = 'Learning mode'; choice.setAttribute('aria-label', 'Learning mode');
  choice.append(new Option('Explore', '0'), new Option('Practice', '1')); label.append(choice); root.append(label); container.append(root);
  type Panel = { host: HTMLDivElement; scope: AbortController; hooks: ModeHooks; release?: () => void; mounted: boolean };
  const panels: Panel[] = [0, 1].map(() => { const host = document.createElement('div'); host.hidden = true; host.inert = true; root.append(host); return { host, scope: new AbortController(), hooks: {}, mounted: false }; });
  let disposed = false, active = 0;
  const release = (p: Panel) => { const owned = p.release; p.release = undefined; owned?.(); };
  function dispose() {
    if (disposed) return; disposed = true; signal.removeEventListener('abort', dispose);
    for (const p of panels) p.scope.abort();
    let failure: unknown, failed = false;
    for (const p of panels) { try { release(p); } catch (error) { if (!failed) { failed = true; failure = error; } } finally { p.host.remove(); } }
    root.remove(); if (failed) throw failure;
  }
  signal.addEventListener('abort', dispose, { once: true });
  function show(index: number) {
    if (disposed) return;
    panels[active].hooks.suspend?.(); active = index;
    panels.forEach((p, i) => { p.host.hidden = i !== active; p.host.inert = i !== active; });
    const p = panels[active];
    if (!p.mounted) {
      p.mounted = true;
      try {
        const late = mounts[active]({ container: p.host, signal: p.scope.signal, hooks: p.hooks, isActive: () => !disposed && active === index });
        if (typeof late === 'function') { if (disposed || p.scope.signal.aborted) late(); else p.release = late; }
      } catch {
        p.scope.abort(); try { release(p); } finally { p.host.replaceChildren(); }
        if (disposed) return;
        const error = document.createElement('p'), retry = document.createElement('button'); error.setAttribute('role', 'alert'); error.textContent = 'This view could not mount. Retry this mode.'; retry.type = 'button'; retry.textContent = 'Retry'; p.host.append(error, retry);
        retry.addEventListener('click', () => { const restore = document.activeElement === retry; p.host.replaceChildren(); p.scope = new AbortController(); p.hooks = {}; p.mounted = false; show(index); if (!disposed && restore) choice.focus({ preventScroll: true }); }, { signal });
      }
    } else p.hooks.resume?.();
  }
  choice.addEventListener('change', () => { window.mathVirtualKeyboard?.hide({ animate: false }); show(Number(choice.value)); }, { signal });
  show(0); return dispose;
}
export const mountView: ModuleMount = context => mountPanels(context);
