import type { ModuleMount } from '../../core/module';
import { mountExplore } from './explore';
import { mountView as mountPractice } from './practice';
import type { ModeHooks } from './mode';
import './workspace.css';

/** Independent visit-local panels preserve complete drafts, including native badInput. */
export const mountView: ModuleMount = ({ container, signal: parent }) => {
  const lifetime = new AbortController(), signal = lifetime.signal;
  const root = document.createElement('div'); root.className = 'cp04'; container.append(root);
  const label = document.createElement('label'); label.className = 'bode-mode'; label.textContent = 'Learning mode';
  const mode = document.createElement('select'); mode.setAttribute('aria-label', 'Learning mode');
  for (const [value, text] of [['explore', 'Explore'], ['practice', 'Practice — construct before reveal']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; mode.append(option); }
  label.append(mode); root.append(label);
  interface Panel { host: HTMLElement; scope: AbortController; hooks: ModeHooks; release: void | (() => void); failed: boolean }
  const panels = new Map<string, Panel>(); let active: Panel | undefined, disposed = false;
  function drop(panel: Panel) {
    const release = panel.release; panel.release = undefined; panel.scope.abort();
    try { release?.(); } finally { panel.host.remove(); }
  }
  function show() {
    if (disposed) return;
    if (active) { active.hooks.suspend?.(); active.host.hidden = true; active.host.inert = true; active = undefined; }
    const key = mode.value === 'practice' ? 'practice' : 'explore'; let panel = panels.get(key);
    if (panel?.failed) { drop(panel); panels.delete(key); panel = undefined; }
    if (panel) { active = panel; panel.host.hidden = false; panel.host.inert = false; panel.hooks.resume?.(); return; }
    const host = document.createElement('div'); host.dataset.cp04Panel = key; root.append(host);
    const created: Panel = { host, scope: new AbortController(), hooks: {}, release: undefined, failed: false }; panels.set(key, created); active = created;
    try {
      const context = { container: host, signal: created.scope.signal, hooks: created.hooks, isActive: () => !disposed && active === created };
      const release = (key === 'practice' ? mountPractice : mountExplore)(context);
      // A submount can synchronously abort the parent before returning its disposer.
      if (disposed || parent.aborted || created.scope.signal.aborted) { release?.(); return; }
      created.release = release;
    } catch {
      created.scope.abort(); created.failed = true; if (disposed || parent.aborted) return;
      host.replaceChildren(); const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = 'The Bode view could not open. Reset the tool or switch modes to try again.'; host.append(error);
    }
  }
  function dispose() {
    if (disposed) return; disposed = true; parent.removeEventListener('abort', dispose); lifetime.abort();
    active?.hooks.suspend?.(); active = undefined;
    for (const panel of panels.values()) { try { drop(panel); } catch { /* Continue releasing the other owned panel. */ } }
    panels.clear(); root.remove();
  }
  parent.addEventListener('abort', dispose, { once: true });
  mode.addEventListener('change', () => { window.mathVirtualKeyboard?.hide({ animate: false }); show(); }, { signal });
  if (parent.aborted) dispose(); else show(); return dispose;
};
