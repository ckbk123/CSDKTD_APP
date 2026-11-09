import type { ModuleMount } from '../../core/module';
import { mount as explore, type ModeHooks } from './explore';
import { mount as practice } from './practice';
import './style.css';
type Context = Parameters<ModuleMount>[0];
type PanelMount = (context: Context & { hooks: ModeHooks; isActive: () => boolean }) => void | (() => void);
export function mountWithPanels({ container, signal: parent }: Context, mounts: Record<'explore' | 'practice', PanelMount>): () => void {
  if (parent.aborted) return () => {};
  const root = document.createElement('div'), label = document.createElement('label'), mode = document.createElement('select'); root.className = 'cd02-modes'; label.textContent = 'Learning mode'; mode.setAttribute('aria-label', 'Learning mode');
  for (const [value, text] of [['explore', 'Explore the complete design'], ['practice', 'Practice the original design steps']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; mode.append(option); } label.append(mode); root.append(label); container.append(root);
  const life = new AbortController(), panels = new Map<string, { host: HTMLDivElement; scope: AbortController; hooks: ModeHooks; release?: () => void }>(); let disposed = false;
  function dispose() {
    if (disposed) return;
    disposed = true; parent.removeEventListener('abort', dispose); life.abort();
    let failed = false, failure: unknown;
    try {
      for (const panel of panels.values()) panel.scope.abort();
      for (const panel of panels.values()) {
        const release = panel.release; panel.release = undefined;
        try { release?.(); } catch (error) { if (!failed) { failed = true; failure = error; } }
      }
    } finally { root.remove(); }
    if (failed) throw failure;
  }
  parent.addEventListener('abort', dispose, { once: true });
  if (parent.aborted) { dispose(); return dispose; }
  function show() {
    if (disposed || parent.aborted) return;
    for (const [key, panel] of panels) if (key !== mode.value && !panel.host.hidden) { panel.hooks.suspend?.(); panel.host.hidden = true; panel.host.inert = true; }
    const existing = panels.get(mode.value); if (existing) { existing.host.hidden = false; existing.host.inert = false; existing.hooks.resume?.(); return; }
    const key = mode.value as 'explore' | 'practice', host = document.createElement('div'), scope = new AbortController(), hooks: ModeHooks = {}; host.dataset.cd02Panel = key; root.append(host); const panel = { host, scope, hooks, release: undefined as (() => void) | undefined }; panels.set(key, panel);
    try { const release = mounts[key]({ container: host, signal: scope.signal, hooks, isActive: () => !disposed && mode.value === key }); if (disposed || scope.signal.aborted) release?.(); else panel.release = release || undefined; }
    catch (error) { scope.abort(); const release = panel.release; panel.release = undefined; release?.(); host.replaceChildren(); if (disposed || parent.aborted) { host.remove(); return; } const message = document.createElement('p'), retry = document.createElement('button'); message.setAttribute('role', 'alert'); message.textContent = `This design panel could not open. ${error instanceof Error ? error.message : ''}`; retry.type = 'button'; retry.textContent = 'Retry design panel'; retry.addEventListener('click', () => { const ownedFocus = host.contains(document.activeElement); host.remove(); panels.delete(key); show(); if (ownedFocus && !disposed) mode.focus({ preventScroll: true }); }, { signal: life.signal }); host.append(message, retry); }
  }
  mode.addEventListener('change', show, { signal: life.signal }); show(); return dispose;
}
export const mount: ModuleMount = context => mountWithPanels(context, { explore, practice });
