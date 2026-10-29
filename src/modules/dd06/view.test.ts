import { afterEach, describe, expect, it, vi } from 'vitest';
import { convertLatexToMathMl } from 'mathlive';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
const editorEvidence = vi.hoisted(() => ({ signals: [] as AbortSignal[], calls: 0, failOnCall: 0, probes: 0 }));
// Owned state/DOM tests only; real MathLive editing/fonts/keyboard need a browser.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (source: string, name: string) => {
    if (/[\u0000-\u001f]/.test(source)) throw new Error('Control character in displayed mathematics.');
    const e = document.createElement('div'); e.setAttribute('role', 'math'); e.setAttribute('aria-label', name); e.textContent = source; return e;
  },
  createEquationInput: (options: EquationInputOptions) => {
    editorEvidence.signals.push(options.signal); editorEvidence.calls++;
    window.addEventListener('dd06-editor-probe', () => editorEvidence.probes++, { signal: options.signal });
    if (editorEvidence.calls === editorEvidence.failOnCall) throw new Error('partial editor failure');
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = (): EquationDraft => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: /\\placeholder/.test(field.value), syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy: () => element.remove() };
  },
}));
import { mount } from './view';
const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(fn => fn()); editorEvidence.failOnCall = 0; });
function open() {
  const container = document.createElement('section'); container.dataset.module = 'DD06'; document.body.append(container);
  const controller = new AbortController(), dispose = mount({ container, signal: controller.signal });
  cleanups.push(() => { controller.abort(); if (typeof dispose === 'function') dispose(); container.remove(); });
  const button = (title: string) => [...container.querySelectorAll('button')].find(button => button.textContent === title)!;
  const field = (title: string) => [...container.querySelectorAll('label')].find(label => label.firstElementChild?.textContent === title)!.querySelector<HTMLInputElement | HTMLSelectElement>('input,select')!;
  const change = (input: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); };
  const set = (name: string, value: string) => change(field(name), value);
  const apply = () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  const reveal = () => button('Reveal feedback and sampled experiment').click();
  const math = (name: string) => container.querySelector(`[role="math"][aria-label="${name}"]`)?.textContent ?? '';
  return { container, controller, dispose, button, field, change, set, apply, reveal, math };
}
describe('DD06 exercise flow and bounded data feedback', () => {
  it('hides feedback until prediction/reveal and preserves actual two-row matrix typesetting', () => {
    const v = open(); expect(v.container.querySelector('.dd06-checked')!.textContent).toBe('');
    const markup = convertLatexToMathMl(v.math('Computed ZOH state and input matrices'));
    expect(markup.match(/<mtable\b/g)).toHaveLength(2); expect(markup.match(/<mtr\b/g)).toHaveLength(4);
    v.set('Does sampled controllability pass?', 'yes'); v.set('Is unity step tracking established?', 'yes'); v.set('Optional Nd estimate', '6.9565'); v.reveal();
    expect(v.math('Coefficient matching and feedback gain')).toContain(String.raw`K_d\approx\begin{bmatrix}4.9565&2.33577\end{bmatrix}`);
    expect(v.math('Computed DC gain, multiplier and equilibrium')).toContain(String.raw`N_d\approx6.9565`);
    expect(v.math('All actual closed-loop poles')).toContain(String.raw`\mathrm{j}`);
    expect(v.container.textContent).toContain('Controllability prediction agrees'); expect(v.container.textContent).toContain('Tracking prediction agrees'); expect(v.container.textContent).toContain('estimate agrees');
    expect(v.container.querySelector('.dd06-readout')!.textContent).toContain('y=1'); expect(v.container.querySelectorAll('figure')).toHaveLength(4);
  });
  it('resamples/redesigns on T change and switches to damping targets with inactive fields ignored', () => {
    const v = open(); v.reveal(); const oldGain = v.math('Coefficient matching and feedback gain');
    v.set('Sample period T (s)', '0.2'); expect(v.container.querySelector('.dd06-checked')).toBeNull(); v.apply(); v.reveal();
    expect(v.math('Coefficient matching and feedback gain')).not.toBe(oldGain); expect(v.math('Desired characteristic polynomial and sample period')).toContain('1.5');
    v.set('Target specification', 'damping'); v.set('First discrete pole', '1e-999'); v.apply(); v.reveal();
    expect(v.math('All actual closed-loop poles')).toContain(String.raw`\mathrm{j}`); expect(v.container.textContent).toContain('ζ and ωn stay fixed');
    expect(v.field('First discrete pole').disabled).toBe(true); expect(v.field('Damping ratio ζ').disabled).toBe(false);
  });
  it('checks changed nilpotent data against the independent K=[6,4.7],N6 fixture', () => {
    const v = open(); v.button('Double integrator').click(); v.reveal();
    expect(v.math('Coefficient matching and feedback gain')).toContain(String.raw`K_d\approx\begin{bmatrix}6&4.7\end{bmatrix}`);
    expect(v.math('Computed DC gain, multiplier and equilibrium')).toContain(String.raw`N_d\approx6`);
  });
  it('shows controllability columns and useful rank-zero feedback without invented gains', () => {
    const v = open(); v.button('Uncontrollable input').click(); v.set('Does sampled controllability pass?', 'no'); v.reveal();
    expect(v.math('Sampled controllability columns')).toBeTruthy(); expect(v.container.textContent).toContain('Numerical rank 0');
    expect(v.math('Coefficient matching and feedback gain')).toBe(''); expect(v.container.querySelector('figure')).toBeNull(); expect(v.container.textContent).toContain('prediction agrees');
  });
  it('keeps valid feedback when tracking is incompatible and permits an explicit zero-reference regulator', () => {
    const v = open(); v.button('Velocity output: DC=0').click(); v.reveal();
    expect(v.math('Coefficient matching and feedback gain')).toBeTruthy(); expect(v.container.textContent).toContain('DC gain is zero');
    expect(v.container.textContent).toContain('nonzero reference needs'); expect(v.container.querySelector('.dd06-readout')).toBeNull();
    v.set('Constant reference r (units)', '0e-999'); v.apply(); v.reveal();
    expect(v.container.querySelector('.dd06-readout')!.textContent).toContain('r=0'); expect(v.container.querySelectorAll('figure')).toHaveLength(4);
    expect(v.container.textContent).not.toContain('Observed overshoot');
  });
  it('does not establish tracking for unstable targets and bounds the partial trace', () => {
    const v = open(); v.button('Unstable target').click(); v.set('Final sample index N', '1000'); v.apply(); v.reveal();
    expect(v.container.textContent).toContain('formal equilibrium multiplier'); expect(v.container.textContent).toContain('Stopped before');
    expect(v.container.textContent).not.toContain('strict retained-mode stability gives y[k]→r');
    expect(v.container.textContent).not.toMatch(/NaN|Infinity/);
  });
  it('rejects malformed matrix data and recovers without showing stale results', () => {
    const v = open(); v.reveal(); v.change(v.container.querySelector('[data-dd06-matrix="A"] textarea')!, String.raw`A=\begin{bmatrix}0&1\\-2&z\end{bmatrix}`); v.apply();
    expect(v.container.querySelector('[role="alert"]')!.textContent).toContain('row 2, column 2'); expect(v.container.querySelector('figure')).toBeNull();
    v.button('Course baseline').click(); v.reveal(); expect(v.math('Computed DC gain, multiplier and equilibrium')).toContain('6.9565');
  });
  it('uses native numeric grammar with explicit underflow and range/integer feedback', () => {
    const v = open(); v.set('Sample period T (s)', '1e-999'); v.apply(); expect(v.container.textContent).toContain('nonzero but too small'); expect(v.container.querySelector('.dd06-checked')).toBeNull();
    v.set('Sample period T (s)', '0e-999'); v.apply(); expect(v.container.textContent).toContain('between 0.001 and 2');
    v.set('Sample period T (s)', '1e-2'); v.set('Initial state x₁[0] (units)', '0e-999'); v.apply(); v.reveal(); expect(v.math('Computed DC gain, multiplier and equilibrium')).toBeTruthy();
    v.set('Final sample index N', '10.5'); v.apply(); expect(v.container.textContent).toContain('as an integer');
  });
  it('validates an optional estimate before reveal while allowing blank and intentional zero', () => {
    const v = open(); v.set('Is unity step tracking established?', 'yes'); v.set('Optional Nd estimate', '1e-999'); v.reveal();
    expect(v.container.querySelector('.dd06-checked')!.textContent).toBe(''); expect(v.container.textContent).toContain('nonzero but too small');
    v.set('Optional Nd estimate', ''); v.reveal(); expect(v.math('Coefficient matching and feedback gain')).toBeTruthy();
    v.set('Optional Nd estimate', '0e-999'); expect(v.container.textContent).toContain('computed multiplier is 6.9565');
  });
  it('bounds drawing but inspects any sample and preserves a prior point after bad input', () => {
    const v = open(); v.set('Final sample index N', '2000'); v.apply(); v.reveal();
    expect(v.container.querySelectorAll('figure circle').length).toBeLessThan(900);
    v.set('Inspect sample k', '777'); expect(v.container.querySelector('.dd06-readout')!.textContent).toContain('k=777');
    v.set('Inspect sample k', '1e-999'); expect(v.container.querySelector('.dd06-readout')!.textContent).toContain('k=777'); expect(v.container.textContent).toContain('nonzero but too small');
    v.set('Inspect sample k', '0e-999'); expect(v.container.querySelector('.dd06-readout')!.textContent).toContain('k=0');
    for (const element of v.container.querySelectorAll('svg *')) for (const attribute of element.attributes) expect(attribute.value).not.toMatch(/NaN|Infinity/);
  });
  it('keeps numerical controllability distinct from an excessive-gain limitation', () => {
    const v = open(); v.change(v.container.querySelector('[data-dd06-matrix="B"] textarea')!, String.raw`B=\begin{bmatrix}0\\0.000000000001\end{bmatrix}`); v.apply();
    v.set('Does sampled controllability pass?', 'yes'); v.reveal(); expect(v.container.textContent).toContain('Numerical rank 2'); expect(v.container.textContent).toContain('Controllability prediction agrees'); expect(v.container.textContent).toContain('Feedback entries exceed');
  });
  it('releases all three editors and restores independent baseline state after reopening', () => {
    const v = open(), oldPeriod = v.field('Sample period T (s)'); v.button('Damping targets').click();
    const start = editorEvidence.probes; v.controller.abort(); if (typeof v.dispose === 'function') v.dispose(); window.dispatchEvent(new Event('dd06-editor-probe'));
    expect(editorEvidence.probes).toBe(start); expect(v.container.childElementCount).toBe(0);
    const next = open(); expect(next.field('Sample period T (s)').value).toBe('0.1'); expect(next.field('Target specification').value).toBe('real');
    v.change(oldPeriod, '1'); expect(next.field('Sample period T (s)').value).toBe('0.1'); expect(next.container.querySelector('.dd06-checked')!.textContent).toBe('');
  });
  it('releases resources allocated by an editor that throws during partial initialization', () => {
    const controller = new AbortController(), container = document.createElement('section'), start = editorEvidence.signals.length;
    editorEvidence.failOnCall = editorEvidence.calls + 2;
    try {
      expect(() => mount({ container, signal: controller.signal })).toThrow('partial editor failure'); expect(controller.signal.aborted).toBe(false);
      controller.abort(); expect(editorEvidence.signals.slice(start).every(signal => signal.aborted)).toBe(true);
      const probes = editorEvidence.probes; window.dispatchEvent(new Event('dd06-editor-probe')); expect(editorEvidence.probes).toBe(probes); expect(container.childElementCount).toBe(0);
    } finally { controller.abort(); }
  });
});
