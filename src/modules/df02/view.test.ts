import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
import * as equations from '../../shared/equations/input';

// Module-owned state/feedback tests. Actual MathLive, fonts and keyboard require
// the separately recorded real-browser pass.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (source: string, name: string) => {
    if (/[\u0000-\u001f]/.test(source)) throw new Error('Unexpected control character in mathematical output.');
    const e = document.createElement('div'); e.setAttribute('role', 'math'); e.setAttribute('aria-label', name); e.textContent = source; return e;
  },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = (): EquationDraft => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: /\\placeholder/.test(field.value), syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy: () => element.remove() };
  },
}));
import { mount } from './view';

const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach(fn => fn()));
function open() {
  const container = document.createElement('section'); container.dataset.module = 'DF02'; document.body.append(container);
  const controller = new AbortController(), dispose = mount({ container, signal: controller.signal });
  cleanups.push(() => { controller.abort(); if (typeof dispose === 'function') dispose(); container.remove(); });
  const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent === text)!;
  const field = (name: string) => [...container.querySelectorAll('label')].find(l => l.firstElementChild?.textContent === name)!.querySelector<HTMLInputElement | HTMLSelectElement>('input,select')!;
  const change = (input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
  const set = (name: string, value: string) => change(field(name), value);
  const apply = () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const reveal = () => button('Reveal limit and assumptions').click();
  const math = (name: string) => container.querySelector(`[role="math"][aria-label="${name}"]`)?.textContent;
  return { container, controller, button, field, change, set, apply, reveal, math, dispose };
}

describe('DF02 student flow, data validation and per-visit ownership', () => {
  it('forwards abort to resources allocated by an editor that throws before returning', () => {
    const resource = vi.fn(); let editorSignal: AbortSignal | undefined;
    const helper = vi.spyOn(equations, 'createEquationInput').mockImplementationOnce(options => {
      editorSignal = options.signal;
      window.addEventListener('df02-editor-failure-probe', resource, { signal: options.signal });
      throw new Error('editor initialization failed');
    });
    const controller = new AbortController(), container = document.createElement('section');
    try {
      expect(() => mount({ container, signal: controller.signal })).toThrow('editor initialization failed');
      expect(controller.signal.aborted).toBe(false);
      controller.abort(); expect(editorSignal?.aborted).toBe(true);
      window.dispatchEvent(new Event('df02-editor-failure-probe'));
      expect(resource).not.toHaveBeenCalled();
    } finally { controller.abort(); helper.mockRestore(); }
  });
  it('shows real samples before the answer and derives the physical-ramp error independently', () => {
    const v = open();
    expect(v.container.querySelectorAll('figure')).toHaveLength(2);
    expect(v.container.querySelector('.df02-checked')?.textContent).toBe('');
    expect(v.container.querySelector('.df02-sample')?.textContent).toContain('r=8');
    v.set('Predict the limit assessment', 'finite'); v.set('Optional finite-error estimate', '1'); v.reveal();
    expect(v.math('Certified finite error')).toBe(String.raw`e_{\infty}=1`);
    expect(v.container.textContent).toContain('System type 1');
    expect(v.container.textContent).toContain('Numerator: 1 factor(s)');
    expect(v.container.textContent).toContain('Denominator: 1 factor(s)');
    expect(v.container.textContent).toContain('The finite estimate agrees');
    expect(v.math('Reference transform and normalized selected error channel')).toContain(String.raw`\frac{z}{(z-1)^{2}}`);
  });
  it('changes sample-index and physical-time normalization without reusing an old answer', () => {
    const v = open(); v.reveal();
    v.set('Reference normalization', 'sequence'); expect(v.container.querySelector('figure')).toBeNull();
    v.apply(); v.reveal(); expect(v.math('Certified finite error')).toBe(String.raw`e_{\infty}=10`);
    v.set('Reference normalization', 'physical'); v.set('Sample period T (s)', '0.2'); v.apply(); v.reveal();
    expect(v.math('Certified finite error')).toBe(String.raw`e_{\infty}=2`);
    expect(v.math('Physical target converted to sample-index normalization')).toContain('100T=20');
  });
  it('separates sensor comparator error from actual tracking error', () => {
    const v = open(); v.button('Sensor h=2').click(); v.reveal();
    expect(v.container.textContent).toContain('No finite steady-state error');
    expect(v.math('Asymptotic sampled error growth')).toContain(String.raw`\frac{1}{20}k^{1}`);
    expect(v.math('Certified finite error')).toBeUndefined();
    v.set('Error to inspect and predict', 'comparator'); v.apply(); v.reveal();
    expect(v.math('Certified finite error')).toBe(String.raw`e_{\infty}=\frac{1}{2}`);
    expect(v.math('Sensor relation between the two errors')).toContain(String.raw`\frac1h e_c`);
  });
  it('handles a proper static loop without inserting a sample delay', () => {
    const v = open(); v.button('Static gain').click(); v.set('Inspect sample k', '0');
    expect(v.container.querySelector('.df02-sample')?.textContent).toContain('y=0.333333');
    expect(v.container.querySelector('.df02-sample')?.textContent).toContain('e_c=0.666667');
    v.reveal(); expect(v.math('Certified finite error')).toBe(String.raw`e_{\infty}=\frac{2}{3}`);
  });
  it('derives a type-two parabolic limit and refuses an unstable-loop algebraic candidate', () => {
    const v = open(); v.button('Two poles at z=1').click(); v.reveal();
    expect(v.math('Certified finite error')).toBe(String.raw`e_{\infty}=\frac{1}{4}`);
    expect(v.container.textContent).toContain('System type 2');
    expect(v.math('s⁻²; physical unit parabola')).toContain('=4');
    v.button('Changed loop gain').click(); v.reveal();
    expect(v.math('Certified finite error')).toBeUndefined();
    expect(v.container.textContent).toContain('Final value not certified');
    expect(v.math('Formal candidate, not a certified sequence final value')).toContain(String.raw`\frac{1}{5}`);
    expect(v.container.textContent).toContain('Stopped before');
  });
  it('rejects visual ambiguity and incomplete input, then recovers with explicit arithmetic', () => {
    const v = open(), source = v.container.querySelector('textarea')!;
    for (const text of ['1e-2/(z+1)', String.raw`2{\frac12}`, '', String.raw`\frac{\placeholder{}}{z+1}`]) {
      v.change(source, text); v.apply(); expect(v.container.querySelector('figure')).toBeNull();
      expect(v.container.querySelector<HTMLElement>('[role="alert"]')?.hidden).toBe(false);
    }
    v.change(source, String.raw`2+\frac12`); v.apply(); v.reveal();
    expect(v.container.querySelectorAll('figure')).toHaveLength(2);
    expect(v.math('Forward path and original characteristic polynomial')).toContain(String.raw`\frac{5}{2}`);
  });
  it('uses native numeric exponent semantics and rejects nonzero underflow and range failures', () => {
    const v = open();
    for (const text of ['1e-999', '', '0e-999']) {
      v.set('Sample period T (s)', text); v.apply(); expect(v.container.querySelector('figure')).toBeNull();
    }
    v.set('Sample period T (s)', '1e-2'); v.apply(); v.reveal();
    expect(v.math('Certified finite error')).toBe(String.raw`e_{\infty}=\frac{1}{10}`);
    v.set('Final sample index N', '10.5'); v.apply(); expect(v.container.textContent).toContain('as an integer');
    v.set('Final sample index N', '80'); v.set('Sensor gain h', '0'); v.apply(); expect(v.container.querySelector('figure')).toBeNull();
  });
  it('preserves a valid inspected sample when a new native index underflows', () => {
    const v = open(); v.set('Inspect sample k', '1e-999');
    expect(v.container.querySelector('.df02-sample')?.textContent).toContain('k=80');
    expect(v.container.textContent).toContain('nonzero but too small');
    v.set('Inspect sample k', '0e-999');
    expect(v.container.querySelector('.df02-sample')?.textContent).toContain('k=0,');
    expect(v.container.querySelector('.df02-sample')?.textContent).toContain('r=0, y=0');
  });
  it('keeps an optional blank prediction usable, but does not grade invalid entered data', () => {
    const v = open(); v.set('Predict the limit assessment', 'finite'); v.set('Optional finite-error estimate', '1e-999'); v.reveal();
    expect(v.math('Certified finite error')).toBeUndefined(); expect(v.container.textContent).toContain('nonzero but too small');
    v.set('Optional finite-error estimate', ''); v.reveal(); expect(v.math('Certified finite error')).toBeDefined();
  });
  it('handles an identically zero tracking channel and an intentional zero prediction', () => {
    const v = open(), source = v.container.querySelector('textarea')!;
    v.change(source, '2'); v.set('Sensor gain h', '0.5'); v.set('Reference shape', 'parabola'); v.apply();
    v.set('Predict the limit assessment', 'finite'); v.set('Optional finite-error estimate', '0e-999'); v.reveal();
    expect(v.math('Certified finite error')).toBe(String.raw`e_{\infty}=0`);
    expect(v.container.textContent).toContain('Numerator is identically zero');
    expect(v.math('Final-value expression with factors at z equals one')).toContain('=0');
    expect(v.container.textContent).toContain('The finite estimate agrees');
  });
  it('keeps exact reasoning available when near-boundary stems are unreliable', () => {
    const v = open(), source = v.container.querySelector('textarea')!;
    v.change(source, '10^{-12}/(z-(1+10^{-12}-10^{-12}*10^{-8}))'); v.apply();
    expect(v.container.querySelector('figure')).toBeNull(); expect(v.container.textContent).toContain('unit-circle stability condition');
    v.reveal(); expect(v.container.textContent).toContain('All retained closed-loop poles');
    expect(v.container.textContent).toContain('No finite steady-state error');
    expect(v.container.textContent).toContain('System type 0');
  });
  it('bounds the drawing while keeping every computed sample inspectable', () => {
    const v = open(); v.set('Final sample index N', '1000'); v.apply();
    expect(v.container.querySelectorAll('figure circle').length).toBeLessThan(400);
    v.set('Inspect sample k', '777'); expect(v.container.querySelector('.df02-sample')?.textContent).toContain('t=77.7 s');
    expect(v.container.querySelector('.df02-sample')?.textContent).toContain('r=77.7');
    for (const e of v.container.querySelectorAll('svg *')) for (const a of e.attributes) expect(a.value).not.toMatch(/NaN|Infinity/);
  });
  it('cleans old controls and restores fresh baseline state on reopening', () => {
    const v = open(), oldPeriod = v.field('Sample period T (s)');
    v.button('Sensor h=2').click(); v.controller.abort(); if (typeof v.dispose === 'function') v.dispose();
    expect(v.container.childElementCount).toBe(0);
    const next = open(); expect(next.field('Sensor gain h').value).toBe('1'); expect(next.field('Sample period T (s)').value).toBe('0.1');
    v.change(oldPeriod, '1'); expect(next.field('Sample period T (s)').value).toBe('0.1');
    expect(next.container.querySelector('.df02-checked')?.textContent).toBe('');
  });
});
