import type { ModuleMount } from '../../core/module';
import { mountExplore } from './explore';
import { mountView as mountPractice } from './practice';
import './workspace.css';

/** Both modes own visit-local state; switching preserves each attempt until reset or leave. */
export const mountView: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.className = 'cs05-mode-workspace'; container.append(root);
  const modes = document.createElement('div'); modes.className = 'cs05-actions cs05-mode-switch'; modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Gain-stability learning mode');
  const explore = document.createElement('button'), practice = document.createElement('button'); explore.type = practice.type = 'button'; explore.textContent = 'Explore'; practice.textContent = 'Practice'; modes.append(explore, practice);
  const recovery = document.createElement('div'), recoveryText = document.createElement('p'), retry = document.createElement('button'); recovery.className = 'cs05-warning'; recovery.setAttribute('role', 'status'); recovery.hidden = true; retry.type = 'button'; retry.textContent = 'Retry Practice'; recovery.append(recoveryText, retry);
  const explorePanel = document.createElement('div'), practicePanel = document.createElement('div'); explorePanel.dataset.learningMode = 'explore'; practicePanel.dataset.learningMode = 'practice'; practicePanel.hidden = true; root.append(modes, recovery, explorePanel, practicePanel);
  const lifetime = new AbortController(), onAbort = () => lifetime.abort(); signal.addEventListener('abort', onAbort, { once: true }); if (signal.aborted) lifetime.abort();
  let disposeExplore: (() => void) | void, disposePractice: (() => void) | void, practiceMounted = false, disposed = false;
  let practiceScope: AbortController | undefined, practiceForward: (() => void) | undefined, practiceHost: HTMLDivElement | undefined;
  const releasePractice = () => {
    practiceScope?.abort(); if (practiceForward) lifetime.signal.removeEventListener('abort', practiceForward);
    disposePractice?.(); disposePractice = undefined; practiceScope = undefined; practiceForward = undefined; practiceHost?.remove(); practiceHost = undefined; practiceMounted = false;
  };
  const startPractice = (): boolean => {
    const child = new AbortController(), forward = () => child.abort(), host = document.createElement('div');
    practiceScope = child; practiceForward = forward; practiceHost = host; practicePanel.replaceChildren(host);
    lifetime.signal.addEventListener('abort', forward, { once: true }); if (lifetime.signal.aborted) child.abort();
    try {
      if (child.signal.aborted) { releasePractice(); return false; }
      const release = mountPractice({ container: host, signal: child.signal });
      if (disposed || child.signal.aborted) { release?.(); releasePractice(); return false; }
      disposePractice = release; practiceMounted = true; return true;
    } catch {
      // Abort releases signal-owned resources; removing the owned host clears partial Practice DOM.
      releasePractice();
      if (!disposed && !lifetime.signal.aborted) { recoveryText.textContent = 'Practice could not open. Retry Practice or continue exploring.'; recovery.hidden = false; }
      return false;
    }
  };
  const show = (isExplore: boolean) => {
    if (disposed || lifetime.signal.aborted) return;
    const retryOwnedFocus = document.activeElement === retry;
    window.mathVirtualKeyboard?.hide({ animate: false });
    if (!isExplore) explorePanel.dispatchEvent(new Event('cs05-suspend'));
    if (!isExplore && !practiceMounted && !startPractice()) return;
    recovery.hidden = true;
    explorePanel.hidden = !isExplore; practicePanel.hidden = isExplore; explore.setAttribute('aria-pressed', String(isExplore)); practice.setAttribute('aria-pressed', String(!isExplore));
    if (retryOwnedFocus) (isExplore ? explore : practice).focus({ preventScroll: true });
  };
  const cleanup = () => { if (disposed) return; disposed = true; signal.removeEventListener('abort', onAbort); lifetime.abort(); disposeExplore?.(); releasePractice(); root.remove(); };
  lifetime.signal.addEventListener('abort', cleanup, { once: true });
  try {
    if (lifetime.signal.aborted) { cleanup(); return cleanup; }
    disposeExplore = mountExplore({ container: explorePanel, signal: lifetime.signal });
    if (lifetime.signal.aborted) { disposeExplore?.(); return cleanup; }
    explore.addEventListener('click', () => show(true), { signal: lifetime.signal }); practice.addEventListener('click', () => show(false), { signal: lifetime.signal }); retry.addEventListener('click', () => show(false), { signal: lifetime.signal }); show(true); return cleanup;
  } catch (e) { cleanup(); throw e; }
};
