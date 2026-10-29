import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mount } from './workspace';

// Verify caller-owned models and lifecycle here; actual MathLive is checked in Chromium.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => {
    const out = document.createElement('div'); out.textContent = latex; out.setAttribute('aria-label', label); return out;
  },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea');
    field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value.trim(), syntaxIssues: [], hasPlaceholders: field.value.includes('placeholder') });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy };
  },
}));
const visits: { root: HTMLElement; controller: AbortController; dispose: () => void }[] = [];
afterEach(() => { for (const visit of visits.splice(0)) { visit.controller.abort(); visit.dispose(); visit.root.remove(); } });
async function open(abortImmediately = false) {
  const root = document.createElement('div'); root.dataset.module = 'DS04'; document.body.append(root); const controller = new AbortController();
  const dispose = mount({ container: root, signal: controller.signal }) as () => void;
  const visit = { root, controller, dispose }; visits.push(visit); if (abortImmediately) controller.abort(); await vi.dynamicImportSettled(); return visit;
}
function click(root: HTMLElement, text: string) {
  const target = Array.from(root.querySelectorAll('button')).find(b => b.textContent === text); expect(target, text).toBeDefined(); target!.click();
}
function edit(field: HTMLInputElement | HTMLTextAreaElement, value: string) { field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); }

describe('DS04 complete teaching workspace', () => {
  it('reveals the exact baseline set and both roots after a prediction', async () => {
    const { root } = await open(); expect(root.querySelector('.g-answer')).toBeNull();
    root.querySelector('select')!.value = '1'; click(root, 'Check prediction and reveal');
    expect(root.querySelector('.g-answer')!.textContent).toBe('0 < K < 5/2'); expect(root.textContent).toContain('Your prediction agrees');
    expect(root.textContent).toContain('radius 0.4472136'); expect(root.querySelectorAll('svg')).toHaveLength(2);
    click(root, 'Inspect K = 5/2'); expect(root.textContent).toContain('boundary or within numerical tolerance'); expect(root.textContent).toContain('z1 = -1');
    expect(root.textContent).toContain('a=c equality; no complex unit-circle pair');
  });
  it('checks the changed complex crossing and displays radians and degrees', async () => {
    const { root } = await open(); click(root, 'Complex crossing experiment'); click(root, 'Check prediction and reveal');
    expect(root.querySelector('.g-answer')!.textContent).toBe('0 < K < 2'); expect(root.textContent).toContain('complex conjugate unit-circle pair');
    expect(root.textContent).toContain('120°'); expect(root.textContent).toContain('Both conjugate roots are on the circle');
  });
  it('reports disconnected sets and every root at singular feedback', async () => {
    const { root } = await open(); click(root, 'Disconnected gain-set experiment'); root.querySelector('select')!.value = '2'; click(root, 'Check prediction and reveal');
    expect(root.querySelector('.g-answer')!.textContent).toBe('−∞ < K < 2/3  ∪  2 < K < ∞');
    expect(root.textContent).toContain('Your prediction agrees'); click(root, 'Inspect K = 1');
    expect(root.textContent).toContain('algebraically singular feedback'); expect(root.textContent).toContain('1 root(s) at infinity');
  });
  it('clears stale results on changed/malformed visual data and accepts fraction shorthand', async () => {
    const { root } = await open(); click(root, 'Check prediction and reveal');
    edit(root.querySelector('textarea')!, String.raw`z+\frac12`); expect(root.querySelector('.g-answer')).toBeNull(); click(root, 'Check prediction and reveal');
    expect(root.querySelector('.g-answer')!.textContent).toBe('0 < K < 2');
    edit(root.querySelector('textarea')!, 'z^3'); click(root, 'Check prediction and reveal');
    expect(root.textContent).toContain('Only powers 0, 1 and 2'); expect(root.querySelectorAll('svg')).toHaveLength(0);
    edit(root.querySelector('textarea')!, '\\placeholder{}'); click(root, 'Check prediction and reveal'); expect(root.textContent).toContain('Complete both visual polynomials');
  });
  it('uses the exact nonrepresentable singular gain for both the root list and plot', async () => {
    const { root } = await open();
    edit(root.querySelector('textarea')!, '-0.3z^2'); edit(root.querySelectorAll('textarea')[1], 'z^2');
    click(root, 'Check prediction and reveal'); click(root, 'Inspect K = 10/3');
    expect(root.textContent).toContain('P is identically zero. Its roots are undetermined');
    // The gain bar may show K, but an undetermined root set has no current-root crosses.
    expect(root.querySelectorAll('.g-locus .g-selected')).toHaveLength(0);
    edit(root.querySelector('input')!, '3');
    expect(root.querySelectorAll('.g-locus .g-selected')).toHaveLength(2);
    expect(root.textContent).not.toContain('P is identically zero. Its roots are undetermined');
  });
  it('explains mixed-number notation and clears the old computed graphs', async () => {
    const { root } = await open(); click(root, 'Check prediction and reveal');
    edit(root.querySelector('textarea')!, String.raw`2\frac12z+1`); click(root, 'Check prediction and reveal');
    expect(root.textContent).toContain('Insert + or × between the whole number and fraction'); expect(root.querySelectorAll('svg')).toHaveLength(0);
    edit(root.querySelector('textarea')!, String.raw`(2+\frac12)z+1`); click(root, 'Check prediction and reveal');
    expect(root.querySelectorAll('svg')).toHaveLength(2); expect(root.textContent).toContain(String.raw`\frac{5}{2}`);
  });
  it('validates gain and plotting bounds without leaving an old graph visible', async () => {
    const { root } = await open(); click(root, 'Check prediction and reveal');
    edit(root.querySelector('input')!, ''); expect(root.textContent).toContain('finite K'); expect(root.querySelectorAll('svg')).toHaveLength(0);
    edit(root.querySelector('input')!, '1e-999'); expect(root.textContent).toContain('finite K'); expect(root.querySelectorAll('svg')).toHaveLength(0);
    edit(root.querySelector('input')!, '0e-999'); expect(root.querySelectorAll('svg')).toHaveLength(2); expect(root.textContent).toContain('All roots at K = 0');
    edit(root.querySelector('input')!, '1e-2'); expect(root.querySelectorAll('svg')).toHaveLength(2); expect(root.textContent).toContain('All roots at K = 0.01');
    edit(root.querySelector('input')!, '1'); expect(root.querySelectorAll('svg')).toHaveLength(2);
    edit(root.querySelectorAll('input')[1], '7'); expect(root.textContent).toContain('minimum < maximum'); expect(root.querySelectorAll('svg')).toHaveLength(0);
  });
  it('exposes fixed boundary modes instead of canceling a shared factor', async () => {
    const { root } = await open(); edit(root.querySelector('textarea')!, 'z-1'); click(root, 'Check prediction and reveal');
    expect(root.querySelector('.g-answer')!.textContent).toContain('No strictly stable'); expect(root.textContent).toContain('Identically zero condition(s): P(+1)');
    expect(root.textContent).toContain('= 1 + 0j; radius 1');
  });
  it('restores fresh fields and unrevealed results when reopened', async () => {
    const a = await open(); click(a.root, 'Disconnected gain-set experiment'); click(a.root, 'Check prediction and reveal'); a.controller.abort(); a.dispose(); expect(a.root.childElementCount).toBe(0);
    const b = await open(); expect(b.root.querySelector('textarea')!.value).toBe('N(z)=z+0.2'); expect(b.root.querySelector('.g-answer')).toBeNull();
  });
  it('ignores local view loading after immediate abort', async () => {
    const { root } = await open(true); expect(root.childElementCount).toBe(0);
  });
});
