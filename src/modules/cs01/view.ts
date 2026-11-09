import type { ModuleContext } from '../../core/module';
import { mountExplore } from './explore';
import { mountPractice } from './practice';
import './workspace.css';

type EquationUI = typeof import('../../shared/equations/input');
/** Both panels retain their own actual input elements, checked models and attempts. */
export function mountView({ container, signal: parent }: ModuleContext, ui: EquationUI): () => void {
  const life = new AbortController(), signal = life.signal, root = document.createElement('div'); root.className = 'cs01-modes'; container.append(root);
  const buttons = document.createElement('div'); buttons.className = 'cs01-actions'; buttons.setAttribute('role', 'group'); buttons.setAttribute('aria-label', 'Pole stability learning mode');
  const explore = document.createElement('button'), practice = document.createElement('button'); explore.type = practice.type = 'button'; explore.textContent = 'Explore'; practice.textContent = 'Practice'; buttons.append(explore, practice);
  const warning = document.createElement('p'), retry = document.createElement('button'); warning.setAttribute('role', 'status'); warning.hidden = retry.hidden = true; retry.type = 'button'; retry.textContent = 'Retry Practice';
  const explorePanel = document.createElement('div'), practicePanel = document.createElement('div'); explorePanel.dataset.learningMode = 'explore'; practicePanel.dataset.learningMode = 'practice'; practicePanel.hidden = true; root.append(buttons, warning, retry, explorePanel, practicePanel);
  let disposed = false, releaseExplore: (() => void) | undefined, releasePractice: (() => void) | undefined;
  let practiceScope: AbortController | undefined, practiceHost: HTMLElement | undefined, practiceForward: (() => void) | undefined;
  const dropPractice = () => {
    const release = releasePractice; releasePractice = undefined; practiceScope?.abort(); if (practiceForward) signal.removeEventListener('abort', practiceForward);
    practiceScope = undefined; practiceForward = undefined; try { release?.(); } finally { practiceHost?.remove(); practiceHost = undefined; }
  };
  const cleanup = () => { if (disposed) return; disposed = true; parent.removeEventListener('abort', cleanup); life.abort(); try { releaseExplore?.(); } finally { try { dropPractice(); } finally { root.remove(); } } };
  parent.addEventListener('abort', cleanup, { once: true });
  const startPractice = () => {
    const scope = new AbortController(), host = document.createElement('div'), forward = () => scope.abort(); practiceScope = scope; practiceHost = host; practiceForward = forward; practicePanel.append(host); signal.addEventListener('abort', forward, { once: true });
    try {
      if (disposed || signal.aborted) { dropPractice(); return false; }
      const release = mountPractice({ container: host, signal: scope.signal }, ui);
      if (disposed || scope.signal.aborted) { release(); dropPractice(); return false; } releasePractice = release; return true;
    } catch { dropPractice(); if (!disposed) { warning.textContent = 'Practice could not open. Retry or continue exploring.'; warning.hidden = retry.hidden = false; } return false; }
  };
  const show = (first: boolean) => {
    if (disposed) return; const retryFocused = document.activeElement === retry; window.mathVirtualKeyboard?.hide({ animate: false });
    if (!first) { explorePanel.dispatchEvent(new Event('cs01-suspend')); if (!releasePractice && !startPractice()) return; }
    warning.hidden = retry.hidden = true; explorePanel.hidden = !first; practicePanel.hidden = first; explore.setAttribute('aria-pressed', String(first)); practice.setAttribute('aria-pressed', String(!first));
    if (retryFocused) (first ? explore : practice).focus({ preventScroll: true });
  };
  try {
    if (parent.aborted) { cleanup(); return cleanup; }
    const release = mountExplore({ container: explorePanel, signal }, ui); if (disposed || signal.aborted) { release(); return cleanup; } releaseExplore = release;
    explore.addEventListener('click', () => show(true), { signal }); practice.addEventListener('click', () => show(false), { signal }); retry.addEventListener('click', () => show(false), { signal }); show(true); return cleanup;
  } catch (error) { cleanup(); throw error; }
}
