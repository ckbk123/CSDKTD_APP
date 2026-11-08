import type { ModuleMount } from '../../core/module';
import { mountExplore } from './explore';
import { mountView as mountPractice } from './practice';
import './workspace.css';

/** Modes have independent owned lifetimes; no checked answer seeds an attempt. */
export const mountView: ModuleMount = ({ container, signal: parent }) => {
  const lifetime = new AbortController(), signal = lifetime.signal;
  const root = document.createElement('div'); root.className = 'cp04'; container.append(root);
  const label = document.createElement('label'); label.className = 'bode-mode'; label.textContent = 'Learning mode';
  const mode = document.createElement('select'); mode.setAttribute('aria-label', 'Learning mode');
  for (const [value, text] of [['explore', 'Explore'], ['practice', 'Practice — construct before reveal']]) { const option = document.createElement('option'); option.value = value; option.textContent = text; mode.append(option); }
  label.append(mode); const host = document.createElement('div'); root.append(label, host);
  let child: AbortController | undefined, release: void | (() => void), disposed = false;
  function stop() { child?.abort(); release?.(); child = undefined; release = undefined; host.replaceChildren(); }
  function show() {
    stop(); child = new AbortController();
    try { release = (mode.value === 'practice' ? mountPractice : mountExplore)({ container: host, signal: child.signal }); }
    catch { child.abort(); host.replaceChildren(); const error = document.createElement('p'); error.setAttribute('role', 'alert'); error.textContent = 'The Bode view could not open. Reset the tool to recover.'; host.append(error); }
  }
  function dispose() { if (disposed) return; disposed = true; parent.removeEventListener('abort', dispose); lifetime.abort(); stop(); root.remove(); }
  parent.addEventListener('abort', dispose, { once: true });
  mode.addEventListener('change', () => { window.mathVirtualKeyboard?.hide({ animate: false }); show(); }, { signal });
  if (parent.aborted) dispose(); else show(); return dispose;
};
