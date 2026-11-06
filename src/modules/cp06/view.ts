import type { ModuleMount } from '../../core/module';
import { mountExplore } from './explore';
import { mountView as mountPractice } from './practice';
import './style.css';

/** Both modes own visit-local state; switching preserves each attempt until reset or leave. */
export const mountView: ModuleMount = ({ container, signal }) => {
  const root = document.createElement('div'); root.className = 'cp-mode-workspace'; container.append(root);
  const modes = document.createElement('div'); modes.className = 'cp-actions cp-mode-switch'; modes.setAttribute('role', 'group'); modes.setAttribute('aria-label', 'Root-locus learning mode');
  const explore = document.createElement('button'), practice = document.createElement('button'); explore.type = practice.type = 'button'; explore.textContent = 'Explore'; practice.textContent = 'Practice'; modes.append(explore, practice);
  const explorePanel = document.createElement('div'), practicePanel = document.createElement('div'); explorePanel.dataset.learningMode = 'explore'; practicePanel.dataset.learningMode = 'practice'; practicePanel.hidden = true; root.append(modes, explorePanel, practicePanel);
  const lifetime = new AbortController(), onAbort = () => lifetime.abort(); signal.addEventListener('abort', onAbort, { once: true }); if (signal.aborted) lifetime.abort();
  let disposeExplore: (() => void) | void, disposePractice: (() => void) | void, practiceMounted = false, disposed = false;
  const show = (isExplore: boolean) => {
    window.mathVirtualKeyboard?.hide({ animate: false });
    if (!isExplore) explorePanel.dispatchEvent(new Event('cp06-suspend'));
    if (!isExplore && !practiceMounted) { disposePractice = mountPractice({ container: practicePanel, signal: lifetime.signal }); practiceMounted = true; if (lifetime.signal.aborted) { disposePractice?.(); return; } }
    explorePanel.hidden = !isExplore; practicePanel.hidden = isExplore; explore.setAttribute('aria-pressed', String(isExplore)); practice.setAttribute('aria-pressed', String(!isExplore));
  };
  const cleanup = () => { if (disposed) return; disposed = true; signal.removeEventListener('abort', onAbort); lifetime.abort(); disposeExplore?.(); disposePractice?.(); root.remove(); };
  lifetime.signal.addEventListener('abort', cleanup, { once: true });
  try {
    if (lifetime.signal.aborted) { cleanup(); return cleanup; }
    disposeExplore = mountExplore({ container: explorePanel, signal: lifetime.signal });
    if (lifetime.signal.aborted) { disposeExplore?.(); return cleanup; }
    explore.addEventListener('click', () => show(true), { signal: lifetime.signal }); practice.addEventListener('click', () => show(false), { signal: lifetime.signal }); show(true); return cleanup;
  } catch (e) { cleanup(); throw e; }
};
