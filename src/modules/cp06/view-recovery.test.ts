import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ModuleMount } from '../../core/module';
import { mountView } from './view';

const state = vi.hoisted(() => ({ fail: true, attempts: 0, probes: 0, aborts: 0, cleanups: 0, exploreCleanups: 0, signals: [] as AbortSignal[], onMount: undefined as (() => void) | undefined }));
// This fixture isolates the late lazy-mount resource boundary, not Practice's mathematical behavior.
vi.mock('./practice', () => ({ mountView: (({ container, signal }) => {
  state.attempts++; state.signals.push(signal);
  const node = document.createElement('input'); node.dataset.practiceAttempt = String(state.attempts); container.append(node);
  window.addEventListener('cp06-practice-resource', () => state.probes++, { signal });
  signal.addEventListener('abort', () => state.aborts++, { once: true });
  state.onMount?.();
  if (state.fail) throw new Error('Synthetic failure after signal-owned resource registration');
  return () => { state.cleanups++; node.remove(); };
}) satisfies ModuleMount }));
vi.mock('./explore', () => ({ mountExplore: (({ container }) => {
  const input = document.createElement('input'); input.setAttribute('aria-label', 'Explore fixture state'); input.value = 'baseline'; container.append(input);
  return () => { state.exploreCleanups++; input.remove(); };
}) satisfies ModuleMount }));

const visits: { root: HTMLElement; controller: AbortController; cleanup: () => void }[] = [];
function visit() { const root = document.createElement('div'); root.dataset.module = 'CP06'; document.body.append(root); const controller = new AbortController(), cleanup = mountView({ container: root, signal: controller.signal }) || (() => {}); const v = { root, controller, cleanup }; visits.push(v); return v; }
function press(root: HTMLElement, name: string) { const button = [...root.querySelectorAll('button')].find(n => n.textContent === name)!; expect(button).toBeDefined(); button.click(); }
afterEach(() => { for (const v of visits.splice(0)) { v.cleanup(); v.controller.abort(); v.root.remove(); } state.fail = true; state.attempts = state.probes = state.aborts = state.cleanups = state.exploreCleanups = 0; state.signals = []; state.onMount = undefined; });

describe('Practice lazy-mount recovery ownership', () => {
  it('aborts only the failed attempt, preserves Explore state and retries with one fresh host/resource', () => {
    const { root, controller } = visit(), input = root.querySelector<HTMLInputElement>('[aria-label="Explore fixture state"]')!; input.value = 'changed exploration';
    press(root, 'Practice'); expect(controller.signal.aborted).toBe(false); expect(state.signals[0].aborted).toBe(true); expect(state.aborts).toBe(1);
    expect(root.querySelector('[data-practice-attempt]')).toBeNull(); expect(root.textContent).toContain('Practice could not open'); expect(root.querySelector<HTMLElement>('[data-learning-mode="explore"]')!.hidden).toBe(false); expect(input.value).toBe('changed exploration');
    window.dispatchEvent(new Event('cp06-practice-resource')); expect(state.probes).toBe(0);
    state.fail = false; press(root, 'Retry Practice'); expect(root.querySelectorAll('[data-practice-attempt]')).toHaveLength(1); expect(state.signals[1].aborted).toBe(false); expect(controller.signal.aborted).toBe(false);
    window.dispatchEvent(new Event('cp06-practice-resource')); expect(state.probes).toBe(1);
    press(root, 'Explore'); expect(input.value).toBe('changed exploration'); expect(root.querySelector<HTMLElement>('[data-learning-mode="explore"]')!.hidden).toBe(false);
  });
  it('releases repeated failures and the successful attempt on direct disposal while the parent stays active', () => {
    const { root, controller, cleanup } = visit(); press(root, 'Practice'); press(root, 'Retry Practice'); expect(state.aborts).toBe(2); expect(root.querySelector('[data-practice-attempt]')).toBeNull();
    state.fail = false; press(root, 'Practice'); expect(root.querySelectorAll('[data-practice-attempt]')).toHaveLength(1); cleanup(); cleanup();
    expect(controller.signal.aborted).toBe(false); expect(state.aborts).toBe(3); expect(state.cleanups).toBe(1); expect(state.exploreCleanups).toBe(1); expect(root.children).toHaveLength(0);
    window.dispatchEvent(new Event('cp06-practice-resource')); expect(state.probes).toBe(0);
  });
  it('releases a late disposer if the parent aborts synchronously during the Practice mount', () => {
    const { root, controller } = visit(); state.fail = false; state.onMount = () => controller.abort(); press(root, 'Practice');
    expect(state.signals[0].aborted).toBe(true); expect(state.aborts).toBe(1); expect(state.cleanups).toBe(1); expect(state.exploreCleanups).toBe(1); expect(root.children).toHaveLength(0);
    window.dispatchEvent(new Event('cp06-practice-resource')); expect(state.probes).toBe(0);
  });
});
