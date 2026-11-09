import type { ModuleContext, ModuleMount } from '../../core/module';
import { mountExplore } from './explore';
import { mountLab } from './lab';
import { mount as mountPractice } from './practice';
import './workspace.css';
type Key = 'response' | 'lab' | 'practice';
type PanelMount = (context: ModuleContext) => void | (() => void);
type Panel = { host: HTMLElement; scope: AbortController; release?: () => void };
export function mountWithPanels({ container, signal: parent }: ModuleContext, mounts: Record<Key, PanelMount>): () => void {
  const life = new AbortController(), signal = life.signal, root = document.createElement('div'); root.className = 'dp01-modes'; root.dataset.module = 'DP01'; container.append(root);
  const actions = document.createElement('div'); actions.className = 'dp01-actions'; actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', 'Sequence learning panel'); const buttons = new Map<Key, HTMLButtonElement>();
  for (const [key, text] of [['response', 'Explore response'], ['lab', 'Compare modes'], ['practice', 'Practice']] as const) { const button = document.createElement('button'); button.type = 'button'; button.textContent = text; actions.append(button); buttons.set(key, button); }
  const warning = document.createElement('p'), retry = document.createElement('button'); warning.setAttribute('role', 'status'); warning.hidden = retry.hidden = true; retry.type = 'button'; retry.textContent = 'Retry panel'; root.append(actions, warning, retry);
  const panels = new Map<Key, Panel>(); let active: Key | undefined, failed: Key = 'response', disposed = false;
  function cleanup(): void { if (disposed) return; disposed = true; parent.removeEventListener('abort', cleanup); life.abort(); let failure: unknown; for (const panel of panels.values()) panel.scope.abort(); for (const panel of panels.values()) { try { panel.release?.(); } catch (error) { failure ??= error; } } root.remove(); if (failure) throw failure; }
  parent.addEventListener('abort', cleanup, { once: true });
  function start(key: Key): boolean {
    const host = document.createElement('div'), scope = new AbortController(), panel: Panel = { host, scope }; host.dataset.learningPanel = key; root.append(host); panels.set(key, panel);
    try { const release = mounts[key]({ container: host, signal: scope.signal }); if (disposed || scope.signal.aborted || parent.aborted) { release?.(); scope.abort(); host.remove(); panels.delete(key); return false; } panel.release = release || undefined; return true; }
    catch (error) { scope.abort(); host.remove(); panels.delete(key); if (disposed || parent.aborted) return false; failed = key; warning.textContent = `This sequence panel could not open. ${error instanceof Error ? error.message : ''} Retry or continue in another panel.`; warning.hidden = retry.hidden = false; return false; }
  }
  function show(key: Key): void {
    if (disposed || parent.aborted) return; const focusedRetry = document.activeElement === retry; window.mathVirtualKeyboard?.hide({ animate: false }); if (disposed || parent.aborted) return; if (!panels.has(key) && !start(key)) return; if (disposed || parent.aborted) return;
    if (active && active !== key) { const old = panels.get(active)!; old.host.dispatchEvent(new Event('dp01-suspend')); if (disposed || parent.aborted) return; old.host.hidden = old.host.inert = true; }
    const current = panels.get(key)!; current.host.hidden = current.host.inert = false; active = key; warning.hidden = retry.hidden = true; buttons.forEach((button, id) => button.setAttribute('aria-pressed', String(id === key))); if (focusedRetry) buttons.get(key)!.focus({ preventScroll: true });
  }
  if (parent.aborted) { cleanup(); return cleanup; } buttons.forEach((button, key) => button.addEventListener('click', () => show(key), { signal })); retry.addEventListener('click', () => show(failed), { signal }); show('response'); return cleanup;
}
export const mount: ModuleMount = context => mountWithPanels(context, { response: mountExplore, lab: mountLab, practice: mountPractice });
