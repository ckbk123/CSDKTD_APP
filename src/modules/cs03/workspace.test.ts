import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import type { ModuleMount } from '../../core/module';
import { mount } from './workspace';
// Caller state/lifecycle only; the real visual editor is checked separately in Chromium.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const out = document.createElement('div'); out.textContent = latex; out.setAttribute('aria-label', label); return out; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value.trim(), syntaxIssues: [], hasPlaceholders: field.value.includes('placeholder') });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy };
  },
}));
const visits: { root: HTMLElement; controller: AbortController; dispose: () => void }[] = [];
afterEach(() => { for (const visit of visits.splice(0)) { visit.controller.abort(); visit.dispose(); visit.root.remove(); } });
async function open(immediateAbort = false) {
  const root = document.createElement('div'); root.dataset.module = 'CS03'; document.body.append(root); const controller = new AbortController();
  const dispose = mount({ container: root, signal: controller.signal }) as () => void; const visit = { root, controller, dispose }; visits.push(visit);
  if (immediateAbort) controller.abort(); await vi.dynamicImportSettled(); return visit;
}
function click(root: HTMLElement, text: string) { const button = [...root.querySelectorAll('button')].find(b => b.textContent === text); expect(button, text).toBeDefined(); button!.click(); }
function edit(field: HTMLInputElement | HTMLTextAreaElement, value: string) { field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); }
function scalar(root: HTMLElement, index: number) { return root.querySelectorAll('input')[index]; }
function answer(root: HTMLElement, index: number) { return root.querySelectorAll('textarea')[index + 1]; }

describe('CS03 complete cubic workspace', () => {
  it('populates the synchronous loading render and cleans it before a late import can mount', async () => {
    const root = document.createElement('div'); root.dataset.module = 'CS03'; document.body.append(root); const controller = new AbortController();
    const dispose = mount({ container: root, signal: controller.signal }) as () => void; visits.push({ root, controller, dispose });
    expect(root.childElementCount).toBeGreaterThan(0); expect(root.querySelector('[role="status"]')?.textContent).toBe('Loading cubic stability…');
    controller.abort(); expect(root.childElementCount).toBe(0); await vi.dynamicImportSettled(); expect(root.childElementCount).toBe(0);
  });
  it('grades the interval, intersects all conditions and classifies every endpoint mode', async () => {
    const { root } = await open(); expect(root.querySelector('.c-answer')).toBeNull();
    edit(answer(root, 0), '0'); edit(answer(root, 1), '70'); click(root, 'Check interval and reveal');
    expect(root.textContent).toContain('Your open interval agrees'); expect(root.querySelector('.c-answer')!.textContent).toBe('0 < K < 70');
    expect(root.querySelectorAll('svg')).toHaveLength(2); expect(root.querySelectorAll('.c-stable')).toHaveLength(5);
    click(root, 'Inspect K = 70'); expect(root.textContent).toContain('Not strictly stable'); expect(root.textContent).toContain('Exact factor (s+a)(s²+b)'); expect(root.querySelectorAll('.c-root')).toHaveLength(3);
    click(root, 'Inspect K = 0'); expect(root.textContent).toContain('s1 = 0 + 0j');
    click(root, 'Inspect above interval'); expect(root.textContent).toContain('Numerical right-half-plane count: 2');
    click(root, 'Inspect below interval'); expect(root.textContent).toContain('Numerical right-half-plane count: 1');
    click(root, 'Inspect interval midpoint'); expect(root.textContent).toContain('Strictly stable by the exact inequalities');
  });
  it('distinguishes a wrong closed-endpoint answer from a missing answer', async () => {
    const { root } = await open(); click(root, 'Check interval and reveal'); expect(root.textContent).toContain('Complete both numerical endpoints');
    edit(answer(root, 0), '0'); edit(answer(root, 1), '70'); root.querySelectorAll('select')[2].value = 'closed'; click(root, 'Check interval and reveal');
    expect(root.textContent).toContain('Strict stability excludes both endpoints'); expect(root.querySelector('.c-answer')).not.toBeNull();
  });
  it('recomputes the W06 and negative-polarity experiments', async () => {
    const { root } = await open(); click(root, 'W06 cubic experiment'); click(root, 'Reveal derivation');
    expect(root.querySelector('.c-answer')!.textContent).toBe('0 < K < 48'); click(root, 'Inspect K = 48'); expect(root.textContent).toContain('2.8284271j');
    click(root, 'Reverse gain polarity'); expect(root.querySelector('.c-answer')).toBeNull(); click(root, 'Reveal derivation'); expect(root.querySelector('.c-answer')!.textContent).toBe('-70 < K < 0');
  });
  it('handles all-real and empty sets without fake finite endpoints', async () => {
    const { root } = await open(); click(root, 'Gain-independent experiment'); edit(scalar(root, 0), '0e-999'); const kind = root.querySelector('select')!; kind.value = 'all'; kind.dispatchEvent(new Event('change'));
    expect(answer(root, 0).parentElement!.hidden).toBe(true); click(root, 'Check interval and reveal'); expect(root.querySelector('.c-answer')!.textContent).toBe('All real K');
    edit(root.querySelector('textarea')!, 's^3+s'); click(root, 'Reveal derivation'); expect(root.querySelector('.c-answer')!.textContent).toContain('Empty set'); expect(root.textContent).toContain('division by a is not performed');
  });
  it('preserves exact fractional gains in the root calculation', async () => {
    const { root } = await open(); edit(root.querySelector('textarea')!, 's^3+s^2+s+0.1'); edit(scalar(root, 0), '0.3'); click(root, 'Reveal derivation'); click(root, 'Inspect K = -1/3');
    expect(root.textContent).toContain('All roots at K = -1/3'); expect(root.textContent).toContain('s1 = 0 + 0j'); expect(root.textContent).toContain('Exact factor s(s²+as+b)');
  });
  it('grades visual endpoint fractions for a region narrower than native numeric resolution', async () => {
    const { root } = await open(); edit(root.querySelector('textarea')!, 's^3+s^2/100000000+s/100000000+100');
    edit(answer(root, 0), '-100'); edit(answer(root, 1), String.raw`-\frac{999999999999999999}{10000000000000000}`); click(root, 'Check interval and reveal');
    expect(root.textContent).toContain('Your open interval agrees'); expect(root.querySelector('.c-answer')!.textContent).toBe('-100 < K < -999999999999999999/10000000000000000');
    edit(answer(root, 1), '-99'); expect(root.textContent).toContain('Your interval answer changed; check again.'); click(root, 'Check interval and reveal'); expect(root.textContent).toContain('The endpoint values differ');
  });
  it('clears stale answers and distinguishes visual grammar, numeric and window failures', async () => {
    const { root } = await open(); click(root, 'Reveal derivation'); edit(scalar(root, 1), '1e-999'); expect(root.textContent).toContain('finite manual K'); expect(root.querySelectorAll('svg')).toHaveLength(0);
    edit(scalar(root, 1), '0e-999'); expect(root.textContent).toContain('All roots at K = 0'); expect(root.querySelectorAll('svg')).toHaveLength(2);
    edit(scalar(root, 1), '1e-2'); expect(root.textContent).toContain('All roots at K = 1/100'); expect(root.querySelectorAll('svg')).toHaveLength(2);
    edit(scalar(root, 1), '0'); expect(root.querySelectorAll('svg')).toHaveLength(2); edit(scalar(root, 2), '100'); expect(root.textContent).toContain('minimum < maximum');
    edit(scalar(root, 2), '-10'); edit(root.querySelector('textarea')!, 's^3+1e-2'); expect(root.querySelector('.c-answer')).toBeNull(); click(root, 'Reveal derivation'); expect(root.textContent).toContain('e notation is unsupported');
    edit(root.querySelector('textarea')!, '\\placeholder{}'); click(root, 'Reveal derivation'); expect(root.textContent).toContain('Complete the denominator');
  });
  it('reopens with baseline data and no previous attempt', async () => {
    const first = await open(); click(first.root, 'W06 cubic experiment'); click(first.root, 'Reveal derivation'); first.controller.abort(); first.dispose(); expect(first.root.childElementCount).toBe(0);
    const second = await open(); expect(second.root.querySelector('textarea')!.value).toBe('D(s)=s(s+2)(s+5)'); expect(scalar(second.root, 1).value).toBe('10'); expect(second.root.querySelector('.c-answer')).toBeNull();
  });
  it('ignores the lazy view after immediate abort', async () => { const { root } = await open(true); expect(root.childElementCount).toBe(0); });
  it('shows a recoverable load error and releases its pending view on abort', async () => {
    vi.resetModules(); vi.doMock('./ui', () => { throw new Error('Simulated chunk load failure'); });
    try {
      const visit = await open(); expect(visit.root.textContent).toBe('The exercise could not load. Reset to try again.');
      visit.controller.abort(); expect(visit.root.childElementCount).toBe(0);
    } finally { vi.doUnmock('./ui'); vi.resetModules(); }
    const recovered = await open(); expect(recovered.root.querySelector('textarea')!.value).toBe('D(s)=s(s+2)(s+5)');
  });
  it('aborts resources and removes partial controls immediately when view mounting throws', async () => {
    let childSignal: AbortSignal | undefined, calls = 0;
    const partial = document.createElement('button'); partial.textContent = 'Partial control';
    vi.resetModules(); vi.doMock('./ui', () => ({ mountUI: (({ container, signal }) => {
      childSignal = signal; container.append(partial);
      partial.addEventListener('click', () => calls++, { signal });
      document.addEventListener('cs03-partial', () => calls++, { signal });
      throw new Error('Simulated failure after creating controls');
    }) satisfies ModuleMount }));
    try {
      const visit = await open();
      expect(visit.controller.signal.aborted).toBe(false); expect(childSignal?.aborted).toBe(true);
      expect(visit.root.textContent).toBe('The exercise could not load. Reset to try again.');
      expect(partial.isConnected).toBe(false); partial.click(); document.dispatchEvent(new Event('cs03-partial')); expect(calls).toBe(0);
    } finally { vi.doUnmock('./ui'); vi.resetModules(); }
  });
});
