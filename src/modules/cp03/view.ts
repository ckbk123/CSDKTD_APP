import type { ModuleMount } from '../../core/module';
import { mountExperiment, type ModeHooks } from './experiment-view';
import './workspace.css';

export const mount: ModuleMount = ({ container, signal: parent }) => {
  const life = new AbortController(), root = document.createElement('div'); root.className = 'cp03-modes'; container.append(root);
  const label = document.createElement('label'); label.className = 'cp03-mode'; label.textContent = 'Learning mode'; const mode = document.createElement('select'); mode.setAttribute('aria-label', 'Learning mode'); label.append(mode); root.append(label);
  for (const [value, text] of [['explore', 'Explore'], ['practice', 'Practice — measure before reveal']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; mode.append(option); }
  interface Panel { host: HTMLElement; scope: AbortController; hooks: ModeHooks; dispose: void | (() => void); failed: boolean }
  const panels = new Map<string, Panel>(); let active: Panel | undefined, closed = false;
  function release(panel: Panel) { const disposer = panel.dispose; panel.dispose = undefined; panel.scope.abort(); try { disposer?.(); } finally { panel.host.remove(); } }
  function show() {
    if (closed) return;
    if (active) { active.hooks.suspend?.(); active.host.hidden = true; active.host.inert = true; active = undefined; }
    const key = mode.value === 'practice' ? 'practice' : 'explore'; let panel = panels.get(key);
    if (panel?.failed) { release(panel); panels.delete(key); panel = undefined; }
    if (panel) { active = panel; panel.host.hidden = false; panel.host.inert = false; panel.hooks.resume?.(); return; }
    const host = document.createElement('div'); host.dataset.cp03Panel = key; root.append(host); const created: Panel = { host, scope: new AbortController(), hooks: {}, dispose: undefined, failed: false }; panels.set(key, created); active = created;
    try { const disposer = mountExperiment({ container: host, signal: created.scope.signal, mode: key, hooks: created.hooks, isActive: () => !closed && active === created }); if (closed || parent.aborted || created.scope.signal.aborted) { disposer?.(); return; } created.dispose = disposer; }
    catch { created.scope.abort(); created.failed = true; if (closed || parent.aborted) return; const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = 'The sinusoidal experiment could not open. Reset or switch modes to try again.'; host.replaceChildren(error); }
  }
  function dispose() { if (closed) return; closed = true; parent.removeEventListener('abort', dispose); life.abort(); active?.hooks.suspend?.(); active = undefined; for (const panel of panels.values()) { try { release(panel); } catch { /* Release the other owned panel as well. */ } } panels.clear(); root.remove(); }
  parent.addEventListener('abort', dispose, { once: true }); mode.addEventListener('change', () => { window.mathVirtualKeyboard?.hide({ animate: false }); show(); }, { signal: life.signal });
  if (parent.aborted) dispose(); else show(); return dispose;
};
