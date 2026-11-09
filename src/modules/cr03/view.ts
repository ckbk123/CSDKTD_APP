import type { ModuleMount } from '../../core/module';
import { mountExplore } from './explore';
import { mountPractice } from './practice';
import './workspace.css';

/** Retained independent panels: switching views never serializes a student's native draft. */
export const mount: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.className = 'cr03-panels';
  const label = document.createElement('label'); label.textContent = 'Learning mode';
  const mode = document.createElement('select'); mode.setAttribute('aria-label', 'Learning mode');
  for (const [value, title] of [['explore', 'Explore coordinates'], ['practice', 'Practice the complete realization']]) { const option = document.createElement('option'); option.value = value; option.textContent = title; mode.append(option); }
  label.append(mode); root.append(label); container.append(root);
  type Panel = { host: HTMLDivElement; scope: AbortController; release?: () => void; ready: boolean };
  const panels = new Map<string, Panel>(); let disposed = false;
  function open() {
    const name = mode.value;
    for (const [key, panel] of panels) { panel.host.hidden = key !== name; panel.host.inert = key !== name; panel.host.dispatchEvent(new Event(key === name ? 'cr03-activate' : 'cr03-deactivate')); }
    let panel = panels.get(name); if (panel?.ready || disposed) return;
    if (panel) { panel.scope.abort(); panel.host.remove(); panels.delete(name); }
    const host = document.createElement('div'), scope = new AbortController(); root.append(host); panel = { host, scope, ready: false }; panels.set(name, panel);
    try {
      const release = (name === 'practice' ? mountPractice : mountExplore)({ container: host, signal: scope.signal });
      if (typeof release === 'function') { if (disposed || scope.signal.aborted) release(); else panel.release = release; }
      if (disposed || scope.signal.aborted) { host.remove(); return; } panel.ready = true;
    } catch {
      scope.abort(); host.replaceChildren(); const notice = document.createElement('p'); notice.setAttribute('role', 'alert'); notice.textContent = 'This view could not load. The other learning mode remains available.';
      const retry = document.createElement('button'); retry.type = 'button'; retry.textContent = 'Retry this view';
      retry.addEventListener('click', () => { const owned = host.contains(document.activeElement); open(); if (owned && !disposed) mode.focus({ preventScroll: true }); }, { signal }); host.append(notice, retry);
    }
  }
  function dispose() {
    if (disposed) return; disposed = true; signal.removeEventListener('abort', dispose);
    let failure: unknown; for (const panel of panels.values()) panel.scope.abort();
    try { for (const panel of panels.values()) { const release = panel.release; panel.release = undefined; try { release?.(); } catch (error) { failure ??= error; } } } finally { root.remove(); }
    if (failure) throw failure;
  }
  signal.addEventListener('abort', dispose, { once: true }); mode.addEventListener('change', open, { signal });
  try { if (signal.aborted) dispose(); else open(); return dispose; } catch (error) { dispose(); throw error; }
};
