import type { ModuleContext, ModuleMount } from '../../core/module';
import { mount as mountExplore } from './explore';
import { mount as mountPractice } from './practice';
import './style.css';
export interface LearningContext extends ModuleContext { hooks: { suspend?: () => void; resume?: () => void }; isActive: () => boolean }
type Panel = { host: HTMLElement; scope: AbortController; hooks: LearningContext['hooks']; release?: () => void };
type PanelMount = (context: LearningContext) => void | (() => void);
/** Each panel retains its own actual fields, model and attempts for this visit only. */
export function mountWithPanels({ container, signal: parent }: ModuleContext, mounts: Record<'explore' | 'practice', PanelMount>): () => void {
  if (parent.aborted) return () => {};
  const root = document.createElement('div'); root.className = 'cd03-modes'; container.append(root);
  const label = document.createElement('label'), mode = document.createElement('select'); label.textContent = 'Learning mode'; mode.setAttribute('aria-label', 'Learning mode');
  for (const [value, name] of [['explore', 'Explore lag placement'], ['practice', 'Practice the original full design']]) { const option = document.createElement('option'); option.value = value; option.textContent = name; mode.append(option); }
  label.append(mode); root.append(label);
  const life = new AbortController(), panels = new Map<string, Panel>(); let disposed = false;
  function cleanup() {
    if (disposed) return; disposed = true; parent.removeEventListener('abort', cleanup); life.abort();
    let failed = false, failure: unknown;
    try { for (const panel of panels.values()) panel.scope.abort(); for (const panel of panels.values()) { const release = panel.release; panel.release = undefined; try { release?.(); } catch (error) { if (!failed) { failed = true; failure = error; } } } }
    finally { root.remove(); }
    if (failed) throw failure;
  }
  parent.addEventListener('abort', cleanup, { once: true });
  if (parent.aborted) { cleanup(); return cleanup; }
  function show(): void {
    if (disposed || parent.aborted) return;
    window.mathVirtualKeyboard?.hide({ animate: false });
    for (const [key, panel] of panels) if (key !== mode.value && !panel.host.hidden) { panel.hooks.suspend?.(); panel.host.hidden = panel.host.inert = true; }
    const found = panels.get(mode.value); if (found) { found.host.hidden = found.host.inert = false; found.hooks.resume?.(); return; }
    const key = mode.value as 'explore' | 'practice', host = document.createElement('div'), scope = new AbortController(), hooks: Panel['hooks'] = {};
    host.dataset.cd03Mode = key; root.append(host); const panel: Panel = { host, scope, hooks }; panels.set(key, panel);
    try { const release = mounts[key]({ container: host, signal: scope.signal, hooks, isActive: () => !disposed && mode.value === key }); if (disposed || scope.signal.aborted) release?.(); else panel.release = release || undefined; }
    catch (error) {
      scope.abort(); host.replaceChildren(); if (disposed || parent.aborted) { host.remove(); return; }
      const message = document.createElement('p'), retry = document.createElement('button'); message.setAttribute('role', 'alert'); message.textContent = 'This lag workspace could not open. ' + (error instanceof Error ? error.message : ''); retry.type = 'button'; retry.textContent = 'Retry workspace';
      retry.addEventListener('click', () => { const owned = host.contains(document.activeElement); host.remove(); panels.delete(key); show(); if (owned && !disposed) mode.focus({ preventScroll: true }); }, { signal: life.signal }); host.append(message, retry);
    }
  }
  mode.addEventListener('change', show, { signal: life.signal }); show(); return cleanup;
}
export const mount: ModuleMount = context => mountWithPanels(context, { explore: mountExplore, practice: mountPractice });
