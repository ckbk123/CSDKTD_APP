import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import * as ui from './ui';
import { mount as mountWorkspace } from './workspace';

// Test caller state and lifecycle only. Real MathLive editing is browser QA.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string) => { const div = document.createElement('div'); div.textContent = latex; return div; },
  createEquationInput: (options: EquationInputOptions) => {
    const input = document.createElement('textarea'); input.value = options.value;
    const getValue = () => ({ latex: input.value, empty: !input.value, hasPlaceholders: false, syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => input.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element: input, getValue, setValue: (s: string) => { input.value = s; }, destroy };
  },
}));
const visits: (() => void)[] = [];
afterEach(() => { visits.splice(0).forEach(cleanup => cleanup()); });
function open() {
  const root = document.createElement('div'), controller = new AbortController(); document.body.append(root);
  const cleanup = ui.mount({ container: root, signal: controller.signal });
  visits.push(() => { controller.abort(); if (typeof cleanup === 'function') cleanup(); root.remove(); });
  const click = (action: string) => root.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)!.click();
  const set = (name: string, value: string) => { root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!.value = value; };
  return { root, click, set, controller, cleanup };
}
describe('quadratic teaching flow', () => {
  it('preserves keyboard focus through result, gain, condition, boundary and sweep redraws', () => {
    const v = open();
    const activate = (action: string) => {
      const before = v.root.querySelector<HTMLButtonElement>(`button[data-action="${action}"]`)!;
      before.focus(); before.click();
      expect(before.isConnected).toBe(false);
      expect(document.activeElement?.getAttribute('data-action')).toBe(action);
      expect(document.activeElement?.isConnected).toBe(true);
    };
    activate('reveal'); activate('reveal'); activate('reveal');
    activate('gain'); activate('condition-1'); activate('boundary'); activate('sweep'); activate('clearSweep');
  });
  it('checks a row and prediction before revealing computed conditions', () => {
    const v = open(); expect(v.root.textContent).not.toContain('Complete strict intersection');
    v.set('row0', '24/25'); v.set('row1', '0'); v.click('row'); expect(v.root.textContent).toContain('Both entries are correct');
    v.set('lower', '0'); v.set('upper', '5/2'); v.click('predict'); expect(v.root.textContent).toContain('Correct strict interval');
    v.click('reveal'); expect(v.root.textContent).toContain('0 < K < 5/2');
    expect(v.root.querySelectorAll('svg').length).toBe(2);
    v.set('gain', '5/2'); v.click('gain'); expect(v.root.textContent).toContain('strict stability fails');
    expect(v.root.textContent).toContain('−');
    v.click('variant'); v.click('reveal'); expect(v.root.textContent).toContain('0 < K < 20/9');
    v.click('condition-1'); v.click('boundary'); expect(v.root.textContent).toContain('At K = 20/9');
  });
  it('invalidates old results on edits and recovers from invalid gain without corrupting state', () => {
    const v = open(); v.click('reveal'); v.set('gain', '10001'); v.click('gain');
    expect(v.root.textContent).toContain('Use |K|');
    v.click('reveal'); v.click('reveal'); expect(v.root.textContent).toContain('At K = 1');
    const field = v.root.querySelector('textarea')!; field.value = 'z^3+1'; field.dispatchEvent(new Event('input'));
    expect(v.root.textContent).not.toContain('Complete strict intersection');
    v.click('apply'); expect(v.root.textContent).toContain('integer powers 0, 1 or 2');
    field.value = 'z^2+Kz+0.5'; field.dispatchEvent(new Event('input')); v.click('apply'); v.click('reveal');
    expect(v.root.textContent).toContain('-3/2 < K < 3/2');
  });
  it('bounds sweeps, covers empty/universal sets and returns fresh state on reopen', () => {
    const v = open(); v.click('reveal'); v.set('sweepStart', '3'); v.set('sweepEnd', '2'); v.click('sweep');
    expect(v.root.textContent).toContain('start < end');
    v.set('sweepStart', '-0.5'); v.set('sweepEnd', '3'); v.click('sweep'); expect(v.root.querySelectorAll('.jury-sample').length).toBe(162);
    v.set('sweepStart', '1/3'); v.set('sweepEnd', '20/9'); v.click('sweep'); v.click('sweep');
    expect(v.root.querySelector<HTMLInputElement>('input[name="sweepStart"]')!.value).toBe('1/3');
    expect(v.root.querySelector<HTMLInputElement>('input[name="sweepEnd"]')!.value).toBe('20/9');
    v.click('clearSweep'); expect(v.root.querySelectorAll('.jury-sample').length).toBe(0);
    const field = v.root.querySelector('textarea')!;
    field.value = 'z^2+1'; field.dispatchEvent(new Event('input')); v.click('apply'); v.click('reveal');
    expect(v.root.textContent).toContain('No strictly stable K'); expect(v.root.textContent).toContain('leading reduction entry is zero');
    field.value = 'z^2+0.5'; field.dispatchEvent(new Event('input')); v.click('apply'); v.click('reveal'); expect(v.root.textContent).toContain('All real K');
    const oldButton = v.root.querySelector<HTMLButtonElement>('button[data-action="variant"]')!;
    v.controller.abort(); if (typeof v.cleanup === 'function') v.cleanup(); oldButton.click(); expect(v.root.children.length).toBe(0);
    const fresh = open(); expect(fresh.root.querySelector('textarea')!.value).toContain('0.2K'); expect(fresh.root.textContent).not.toContain('Complete strict intersection');
  });
});

describe('DS02 deferred workspace resources', () => {
  afterEach(() => vi.restoreAllMocks());
  function visit(aborted = false) {
    const container = document.createElement('div'), parent = new AbortController();
    if (aborted) parent.abort();
    const cleanup = mountWorkspace({ container, signal: parent.signal });
    visits.push(() => { parent.abort(); if (typeof cleanup === 'function') cleanup(); });
    return { container, parent, cleanup };
  }
  it('does not initialize an already-aborted visit', async () => {
    const viewMount = vi.spyOn(ui, 'mount'); const current = visit(true);
    expect(current.cleanup).toBeUndefined(); expect(current.container.childElementCount).toBe(0);
    await vi.dynamicImportSettled(); expect(viewMount).not.toHaveBeenCalled();
  });
  it('removes synchronous loading and skips an import after parent abort', async () => {
    const viewMount = vi.spyOn(ui, 'mount'); const current = visit();
    expect(current.container.textContent).toContain('Loading Jury exercise');
    current.parent.abort(); expect(current.container.childElementCount).toBe(0);
    await vi.dynamicImportSettled(); expect(viewMount).not.toHaveBeenCalled();
  });
  it('aborts partially allocated resources before replacing failed UI with recovery feedback', async () => {
    const listener = vi.fn(); let childSignal: AbortSignal | undefined;
    vi.spyOn(ui, 'mount').mockImplementationOnce(({ container, signal }) => {
      childSignal = signal;
      document.addEventListener('ds02-partial-resource', listener, { signal });
      container.append(document.createElement('section'));
      throw new Error('Failure after allocating a resource');
    });
    const current = visit(); await vi.dynamicImportSettled();
    expect(current.parent.signal.aborted).toBe(false); expect(childSignal).not.toBe(current.parent.signal);
    expect(childSignal?.aborted).toBe(true);
    document.dispatchEvent(new Event('ds02-partial-resource')); expect(listener).not.toHaveBeenCalled();
    expect(current.container.querySelector('section')).toBeNull();
    expect(current.container.querySelector('[role="alert"]')?.textContent).toContain('Reset the workspace to try again');
    if (typeof current.cleanup === 'function') current.cleanup();
    expect(current.container.childElementCount).toBe(0);
  });
  it('aborts listeners on standalone cleanup while releasing the loaded view only once', async () => {
    const listener = vi.fn(), release = vi.fn(); let childSignal: AbortSignal | undefined;
    vi.spyOn(ui, 'mount').mockImplementationOnce(({ signal }) => {
      childSignal = signal;
      document.addEventListener('ds02-loaded-resource', listener, { signal });
      return release;
    });
    const current = visit(); await vi.dynamicImportSettled();
    document.dispatchEvent(new Event('ds02-loaded-resource')); expect(listener).toHaveBeenCalledOnce();
    if (typeof current.cleanup === 'function') { current.cleanup(); current.cleanup(); }
    expect(current.parent.signal.aborted).toBe(false); expect(childSignal?.aborted).toBe(true);
    document.dispatchEvent(new Event('ds02-loaded-resource')); expect(listener).toHaveBeenCalledOnce();
    expect(release).toHaveBeenCalledOnce(); current.parent.abort(); expect(release).toHaveBeenCalledOnce();
    expect(current.container.childElementCount).toBe(0);
  });
  it('releases a disposer returned after the parent aborts during mounting', async () => {
    const parent = new AbortController(), container = document.createElement('div'), release = vi.fn();
    let childSignal: AbortSignal | undefined;
    vi.spyOn(ui, 'mount').mockImplementationOnce(({ signal }) => { childSignal = signal; parent.abort(); return release; });
    const cleanup = mountWorkspace({ container, signal: parent.signal }); await vi.dynamicImportSettled();
    expect(childSignal?.aborted).toBe(true); expect(release).toHaveBeenCalledOnce();
    if (typeof cleanup === 'function') cleanup();
    expect(release).toHaveBeenCalledOnce(); expect(container.childElementCount).toBe(0);
  });
  it('does not attach recovery feedback after abort during mounting', async () => {
    const parent = new AbortController(), container = document.createElement('div');
    vi.spyOn(ui, 'mount').mockImplementationOnce(() => { parent.abort(); throw new Error('Aborted mount'); });
    const cleanup = mountWorkspace({ container, signal: parent.signal }); await vi.dynamicImportSettled();
    expect(container.childElementCount).toBe(0); if (typeof cleanup === 'function') cleanup();
  });
});
