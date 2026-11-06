import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mountView } from './view';

// Caller-owned drafts/lifecycle only. These stand-ins are not editor/browser evidence.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, title: string) => { const node = document.createElement('div'); node.setAttribute('aria-label', title); node.textContent = latex; return node; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value.trim(), syntaxIssues: [], hasPlaceholders: field.value.includes('placeholder') });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, destroy, focus: () => field.focus() };
  },
}));
const visits: { root: HTMLElement; controller: AbortController; cleanup: () => void }[] = [];
afterEach(() => { for (const v of visits.splice(0)) { v.controller.abort(); v.cleanup(); v.root.remove(); } vi.useRealTimers(); vi.unstubAllGlobals(); });
function open(mode: 'explore' | 'practice' = 'practice') {
  const root = document.createElement('div'); root.dataset.module = 'CP01'; document.body.append(root); const controller = new AbortController();
  const cleanup = mountView({ container: root, signal: controller.signal }) as () => void;
  if (mode === 'practice') edit(field(root, 'Learning mode'), 'practice', true);
  const v = { root, controller, cleanup }; visits.push(v); return v;
}
function field<T extends HTMLInputElement | HTMLSelectElement>(root: HTMLElement, title: string): T {
  const labels = Array.from(root.querySelectorAll('label')); const node = labels.find(label => label.firstChild?.textContent === title)?.querySelector('input,select');
  expect(node, title).toBeDefined(); return node as T;
}
function edit(node: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement, value: string, change = false): void { node.value = value; node.dispatchEvent(new Event(change ? 'change' : 'input', { bubbles: true })); }
function reveal(root: HTMLElement): void { root.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); }
function result(root: HTMLElement): HTMLElement { return root.querySelector('[aria-label="Response workspace"]')!; }
function preset(root: HTMLElement, value: string): void { edit(field(root, 'Experiment'), value, true); }
describe('complete response exercise flow', () => {
  it.each([
    ['(s-2)(s+3)', '-3', '20', '8.756511\\times10^{-27}'],
    ['(s-.1)(s-10)', '.1', '5', '1.648721'],
  ])('keeps an unexcited fast mode absent in the actual workspace flow for %s', (denominator, derivative, time, expected) => {
    const { root } = open(); edit(root.querySelectorAll('textarea')[1], denominator);
    edit(field(root, 'Input shape'), 'free', true); edit(field(root, 'Initial x₁ = w(0−)'), '1'); edit(field(root, 'Initial x₂ = w′(0−), order 2 only'), derivative);
    edit(field(root, 'Trace horizon (s)'), time); edit(field(root, 'Prediction time (s), right-hand value'), time); reveal(root);
    expect(result(root).querySelector('[aria-label="Computed ordinary output at the cursor"]')!.textContent).toContain(expected);
    expect(result(root).textContent).not.toContain('Trace stopped early');
  });
  it('reveals computed baseline terms and direct cursor value only on request', () => {
    const { root } = open(); expect(result(root).children).toHaveLength(0); reveal(root);
    expect(result(root).textContent).toContain('e^{-t}'); expect(result(root).textContent).toContain('0.1997882');
    expect(result(root).querySelectorAll('.cp-plot-scroll')).toHaveLength(2);
    expect(root.textContent).toContain('strictly stable');
  });
  it('compares an actual attempt and computes changed data', () => {
    const { root } = open(); field<HTMLInputElement>(root, 'Compare my numerical prediction (optional)').checked = true; reveal(root);
    expect(root.querySelector('.cp-feedback')?.textContent).toContain('Compare your prediction');
    edit(field(root, 'Predicted total y (normalized units)'), '.1997882'); reveal(root);
    expect(root.querySelector('.cp-feedback')?.textContent).toContain('Your prediction agrees');
    preset(root, '1'); reveal(root); expect(result(root).textContent).toContain('0.3153829');
  });
  it('preserves both initial state and checked trajectories across coordinate views', () => {
    const { root } = open(); preset(root, '2'); reveal(root);
    const paths = Array.from(result(root).querySelectorAll('path.cp-curve')).map(p => p.getAttribute('d'));
    const original = result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!.textContent;
    edit(field(root, 'Coordinate view (preserves the initial state)'), 'centered', true);
    expect(result(root).textContent).toContain('\\frac{3}{2}');
    expect(field<HTMLInputElement>(root, 'Initial x₁ = w(0−)').value).toBe('1');
    expect(result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!.textContent).toBe(original);
    expect(Array.from(result(root).querySelectorAll('path.cp-curve')).map(p => p.getAttribute('d'))).toEqual(paths);
  });
  it('handles an ideal direct impulse by signed area without a finite peak', () => {
    const { root } = open(); preset(root, '8'); reveal(root);
    expect(result(root).textContent).toContain('output 2 output-units·s');
    expect(result(root).querySelectorAll('path.cp-impulse')).toHaveLength(2);
    edit(field(root, 'Cursor time (s)'), '0');
    const table = result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!;
    expect(table.textContent).toContain('0+0011');
    edit(field(root, 'One-sided value'), 'left', true); expect(table.isConnected).toBe(false);
    expect(result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!.textContent).toContain('0−0000');
  });
  it('shows pulse width/area/height and one-sided turn-off values', () => {
    const { root } = open(); preset(root, '9'); reveal(root);
    expect(result(root).textContent).toContain('A/W=10');
    edit(field(root, 'Cursor time (s)'), '.1');
    expect(result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!.textContent).toContain('0.9516258');
    edit(field(root, 'One-sided value'), 'left', true);
    expect(result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')!.textContent).toContain('20.95163');
  });
  it.each(['3', '4', '5', '6', '7', '10'])('computes the declared mode experiment %s', value => {
    const { root } = open(); preset(root, value); reveal(root);
    expect(result(root).querySelectorAll('.cp-plot-scroll')).toHaveLength(2);
    expect(root.querySelector('.cp-feedback')?.textContent).toContain('Response revealed');
  });
  it('clears old answers on invalid equations and rejects mixed-number ambiguity', () => {
    const { root } = open(); reveal(root);
    edit(root.querySelector('textarea')!, 's2\\frac12'); expect(result(root).children).toHaveLength(0); reveal(root);
    expect(result(root).children).toHaveLength(0); expect(root.querySelector('.cp-feedback')?.textContent).toContain('mixed');
    edit(root.querySelector('textarea')!, 's^2'); edit(root.querySelectorAll('textarea')[1], 's+1'); reveal(root);
    expect(root.querySelector('.cp-feedback')?.textContent).toContain('proper');
  });
  it.each(['1e-999', '-1e-999', ''])('rejects native amplitude draft %s without stale results', raw => {
    const { root } = open(); reveal(root); edit(field(root, 'Amplitude / slope / area A'), raw); reveal(root);
    expect(result(root).children).toHaveLength(0); expect(root.querySelector('.cp-feedback')?.textContent).toMatch(/nonzero but too small|finite number/);
  });
  it('validates the cursor locally and preserves the checked model', () => {
    const { root } = open(); reveal(root); edit(field(root, 'Cursor time (s)'), '1e-999');
    expect(result(root).textContent).toContain('nonzero but too small'); expect(result(root).querySelectorAll('.cp-plot-scroll')).toHaveLength(2);
    expect(result(root).querySelector('[aria-label="Computed cursor values; ordinary parts only"]')).toBeNull();
    edit(field(root, 'Cursor time (s)'), '1'); expect(result(root).textContent).toContain('0.1997882');
  });
  it('reports early truncation and insufficient pulse horizon without inventing a limit', () => {
    const { root } = open(); preset(root, '10'); edit(field(root, 'Trace horizon (s)'), '60'); reveal(root);
    expect(result(root).textContent).toContain('Trace stopped early'); expect(result(root).textContent).toContain('No general settling claim');
    preset(root, '9'); edit(field(root, 'Pulse width W (s)'), '10'); reveal(root); expect(result(root).textContent).toContain('pulse ends after this horizon');
  });
  it('restore and a fresh visit return to baseline with no old listener updates', () => {
    const v = open(); preset(v.root, '1'); reveal(v.root); const oldCursor = field<HTMLInputElement>(v.root, 'Cursor time (s)');
    const reset = Array.from(v.root.querySelectorAll('button')).find(b => b.textContent === 'Restore baseline')!; reset.click();
    expect(result(v.root).children).toHaveLength(0); expect(v.root.querySelector('textarea')!.value).toBe('1');
    edit(oldCursor, '2'); expect(result(v.root).children).toHaveLength(0);
    v.controller.abort(); v.cleanup(); const fresh = open(); reveal(fresh.root); expect(result(fresh.root).textContent).toContain('0.1997882');
    edit(field(v.root, 'Trace horizon (s)'), '5'); expect(result(fresh.root).textContent).toContain('0.1997882');
  });
});

describe('visual-first exploration and optional prediction', () => {
  it('gives each numeric control and its range a separate label so values do not enter the numeric accessible name', () => {
    const { root } = open('explore');
    for (const [numberLabel, rangeLabel] of [
      ['Amplitude / slope / area A', 'Slide input amplitude, slope or signed area'],
      ['Initial x₁ = w(0−)', 'Slide initial phase state x₁'],
      ['Initial x₂ = w′(0−), order 2 only', 'Slide initial phase state x₂'],
    ]) {
      const numeric = field(root, numberLabel), range = root.querySelector<HTMLInputElement>(`[aria-label="${rangeLabel}"]`)!;
      expect(numeric.parentElement!.querySelectorAll('input')).toHaveLength(1);
      expect(range.closest('label')).not.toBe(numeric.closest('label'));
      expect(numeric.parentElement!.firstChild!.textContent).toBe(numberLabel);
    }
  });

  it('opens with a computed baseline and an independently known ordinary value, without exposing a derivation wall', () => {
    const { root } = open('explore');
    expect(result(root).dataset.state).toBe('preview');
    expect(result(root).querySelectorAll('.cp-plot-scroll')).toHaveLength(2);
    expect(result(root).querySelector('[data-preview-readout]')!.textContent).toContain('free 0 + forced 0.1997882 = total 0.1997882');
    expect(result(root).querySelector('[aria-label="Exact free response terms"]')).toBeNull();
    expect(result(root).querySelector('[aria-label="Computed ordinary output at the cursor"]')).toBeNull();
    expect(field<HTMLInputElement>(root, 'Pulse width W (s)').parentElement!.hidden).toBe(true);
  });

  it('coalesces rapid slider edits and previews the latest amplitude before any check', () => {
    vi.useFakeTimers(); const { root } = open('explore');
    const range = root.querySelector<HTMLInputElement>('[aria-label="Slide input amplitude, slope or signed area"]')!;
    edit(range, '.5'); edit(range, '2');
    expect(field<HTMLInputElement>(root, 'Amplitude / slope / area A').value).toBe('2');
    expect(result(root).dataset.state).toBe('draft'); expect(result(root).querySelector('h3')!.textContent).toBe('Previous preview — updating');
    vi.advanceTimersByTime(31); expect(result(root).dataset.state).toBe('draft');
    vi.advanceTimersByTime(1);
    expect(result(root).dataset.state).toBe('preview');
    expect(result(root).querySelector('[data-preview-readout]')!.textContent).toContain('total 0.3995764');
    expect(result(root).querySelectorAll('.cp-plot-scroll')).toHaveLength(2);
  });

  it('lets a changed initial state produce free motion directly while the zero-input forced path stays zero', () => {
    vi.useFakeTimers(); const { root } = open('explore');
    edit(field(root, 'Input shape'), 'free', true); edit(field(root, 'Initial x₁ = w(0−)'), '1'); vi.advanceTimersByTime(32);
    expect(field<HTMLInputElement>(root, 'Amplitude / slope / area A').disabled).toBe(true);
    expect(result(root).querySelector('[data-preview-readout]')!.textContent).toContain('free 0.6004236 + forced 0 = total 0.6004236');
    const free = result(root).querySelector('path.cp-free')!, total = result(root).querySelector('path.cp-total')!;
    expect(free.getAttribute('d')).toBe(total.getAttribute('d'));
  });

  it('withholds every output answer in Practice, including direct impulse area, until reveal', () => {
    vi.useFakeTimers(); const { root } = open('explore'); preset(root, '8');
    edit(field(root, 'Learning mode'), 'practice', true); vi.advanceTimersByTime(32);
    expect(result(root).dataset.state).toBe('awaiting-prediction');
    expect(result(root).querySelectorAll('.cp-plot-scroll')).toHaveLength(1);
    expect(result(root).querySelector('path.cp-input')).not.toBeNull();
    expect(result(root).querySelector('path.cp-total, path.cp-free, path.cp-forced')).toBeNull();
    expect(result(root).querySelector('[data-preview-readout]')).toBeNull();
    expect(result(root).querySelector('[aria-label="Ideal input and direct output impulse areas"]')).toBeNull();
    expect(result(root).querySelector('[aria-label="Computed ordinary output at the cursor"]')).toBeNull();
    reveal(root);
    expect(result(root).dataset.state).toBe('checked');
    expect(result(root).textContent).toContain('output 2 output-units·s');
    edit(field(root, 'Initial x₁ = w(0−)'), '1'); vi.advanceTimersByTime(32);
    expect(result(root).querySelector('path.cp-total')).toBeNull();
  });

  it('revokes a checked response on model changes, but keeps guesses and view-only inspection separate', () => {
    vi.useFakeTimers(); const { root } = open('explore'); reveal(root);
    edit(field(root, 'Cursor time (s)'), '2'); expect(result(root).dataset.state).toBe('checked');
    expect(root.querySelector('.cp-feedback')!.textContent).toContain('Response revealed');
    edit(field(root, 'Amplitude / slope / area A'), '3');
    expect(result(root).dataset.state).toBe('draft');
    vi.advanceTimersByTime(32); expect(result(root).dataset.state).toBe('preview');
    expect(result(root).querySelector('[data-preview-readout]')!.textContent).toContain('total 0.5993646');
    expect(result(root).querySelector('[aria-label="Exact free response terms"]')).toBeNull();
    reveal(root); vi.advanceTimersByTime(100); expect(result(root).dataset.state).toBe('checked');
  });

  it('shows invalid drafts immediately after the bounded preview delay and recovers without a stale answer', () => {
    vi.useFakeTimers(); const { root } = open('explore');
    edit(field(root, 'Amplitude / slope / area A'), '1e-999'); vi.advanceTimersByTime(32);
    expect(result(root).dataset.state).toBe('invalid'); expect(result(root).children).toHaveLength(0);
    expect(root.querySelector('.cp-feedback')!.textContent).toContain('nonzero but too small');
    edit(field(root, 'Amplitude / slope / area A'), '2'); vi.advanceTimersByTime(32);
    expect(result(root).querySelector('[data-preview-readout]')!.textContent).toContain('total 0.3995764');
  });

  it('cancels pending previews on abort and direct disposal, including rapid mode changes', () => {
    vi.useFakeTimers(); const aborted = open('explore'); edit(field(aborted.root, 'Amplitude / slope / area A'), '2');
    const oldMode = field(aborted.root, 'Learning mode'), oldButton = aborted.root.querySelector('button[type="submit"]')!.textContent;
    const abortedDOM = result(aborted.root).innerHTML; aborted.controller.abort(); edit(oldMode, 'practice', true);
    vi.advanceTimersByTime(100); expect(result(aborted.root).innerHTML).toBe(abortedDOM);
    expect(aborted.root.querySelector('button[type="submit"]')!.textContent).toBe(oldButton);
    const direct = open('explore'); edit(field(direct.root, 'Amplitude / slope / area A'), '2'); direct.cleanup();
    const directDOM = result(direct.root).innerHTML; vi.advanceTimersByTime(100); expect(result(direct.root).innerHTML).toBe(directDOM);
    const directAmplitude = field<HTMLInputElement>(direct.root, 'Amplitude / slope / area A');
    edit(direct.root.querySelector<HTMLInputElement>('[aria-label="Slide input amplitude, slope or signed area"]')!, '3');
    expect(directAmplitude.value).toBe('2');
    const latest = open('explore'); edit(field(latest.root, 'Learning mode'), 'practice', true); edit(field(latest.root, 'Learning mode'), 'explore', true);
    vi.advanceTimersByTime(32); expect(result(latest.root).dataset.state).toBe('preview');
    expect(result(latest.root).querySelector('path.cp-total')).not.toBeNull();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('checks a short Explore horizon without requiring a hidden Practice prediction time', () => {
    const { root } = open('explore'); edit(field(root, 'Trace horizon (s)'), '.5'); reveal(root);
    expect(result(root).dataset.state).toBe('checked');
    expect(result(root).querySelector('[aria-label="Computed ordinary output at the cursor"]')).not.toBeNull();
  });

  it('keeps Enter on a checked time inspector from submitting and resetting the cursor', () => {
    const { root } = open('explore'); reveal(root); const cursor = field<HTMLInputElement>(root, 'Cursor time (s)');
    edit(cursor, '2'); const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }); cursor.dispatchEvent(enter);
    expect(enter.defaultPrevented).toBe(true); expect(cursor.value).toBe('2'); expect(result(root).dataset.state).toBe('checked');
    expect(result(root).querySelector('[aria-label="Computed ordinary output at the cursor"]')!.textContent).toContain('0.3738225');
  });

  it('updates during a continuing gesture instead of postponing every preview until the gesture ends', () => {
    vi.useFakeTimers(); const { root } = open('explore');
    edit(field(root, 'Amplitude / slope / area A'), '2'); vi.advanceTimersByTime(20);
    edit(field(root, 'Amplitude / slope / area A'), '3'); vi.advanceTimersByTime(12);
    expect(result(root).dataset.state).toBe('preview');
    expect(result(root).querySelector('[data-preview-readout]')!.textContent).toContain('total 0.5993646');
    edit(field(root, 'Amplitude / slope / area A'), '4'); vi.advanceTimersByTime(20);
    edit(field(root, 'Amplitude / slope / area A'), '5'); vi.advanceTimersByTime(12);
    expect(result(root).querySelector('[data-preview-readout]')!.textContent).toContain('total 0.998941');
  });

  it('keeps truncated, under-resolved and pulse-horizon warnings visible while Practice withholds output', () => {
    vi.useFakeTimers(); const { root } = open();
    preset(root, '10'); edit(field(root, 'Trace horizon (s)'), '60'); vi.advanceTimersByTime(32);
    expect(result(root).querySelector('.cp-warning')!.textContent).toContain('Trace stopped early');
    expect(result(root).querySelector('path.cp-total')).toBeNull();
    preset(root, '9'); edit(field(root, 'Pulse width W (s)'), '10'); vi.advanceTimersByTime(32);
    expect(result(root).querySelector('.cp-warning')!.textContent).toContain('pulse ends after this horizon');
    expect(result(root).querySelector('path.cp-total')).toBeNull();
    preset(root, '3'); edit(root.querySelectorAll('textarea')[1], '(s+10)^2'); edit(field(root, 'Trace horizon (s)'), '60'); vi.advanceTimersByTime(32);
    expect(result(root).querySelector('.cp-warning')!.textContent).toContain('base-interval budget');
    expect(result(root).querySelector('path.cp-total')).toBeNull();
  });

  it('keeps the material short-horizon warning beside the checked plots rather than inside collapsed reasoning', () => {
    const { root } = open('explore'); edit(field(root, 'Trace horizon (s)'), '.1'); reveal(root);
    const warning = Array.from(result(root).querySelectorAll('.cp-warning')).find(node => node.textContent!.includes('endpoint is still more than 1%'))!;
    expect(warning).toBeDefined(); expect(warning.closest('details')).toBeNull();
    expect(warning.textContent).toContain('not a settling-time calculation');
  });

  it('clears old prediction grading when the guess or comparison choice changes without revoking the checked model', () => {
    const { root } = open(); const compare = field<HTMLInputElement>(root, 'Compare my numerical prediction (optional)');
    compare.checked = true; edit(field(root, 'Predicted total y (normalized units)'), '.1997882'); reveal(root);
    expect(root.querySelector('.cp-feedback')!.textContent).toContain('Your prediction agrees');
    edit(field(root, 'Predicted total y (normalized units)'), '.3');
    expect(root.querySelector('.cp-feedback')!.textContent).toContain('Prediction edited; reveal again');
    expect(root.querySelector('.cp-feedback')!.textContent).not.toContain('Your prediction agrees');
    expect(result(root).dataset.state).toBe('checked');
    reveal(root); expect(root.querySelector('.cp-feedback')!.textContent).toContain('Compare your prediction');
    compare.checked = false; compare.dispatchEvent(new Event('change', { bubbles: true }));
    expect(root.querySelector('.cp-feedback')!.textContent).toContain('Prediction edited; reveal again');
    expect(root.querySelector('.cp-feedback')!.textContent).not.toContain('Compare your prediction');
    expect(result(root).dataset.state).toBe('checked');
  });
});
