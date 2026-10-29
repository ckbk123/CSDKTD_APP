import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mount } from './ui';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string) => { const e = document.createElement('div'); e.textContent = latex; return e; },
  createEquationInput: (options: EquationInputOptions) => {
    const field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label);
    const getValue = () => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: false, syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => field.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element: field, getValue, setValue: (value: string) => { field.value = value; }, destroy };
  },
}));
const cleanups: (() => void)[] = [];
afterEach(() => cleanups.splice(0).forEach(c => c()));
function open() {
  const root = document.createElement('div'), controller = new AbortController(); document.body.append(root);
  const cleanup = mount({ container: root, signal: controller.signal });
  const close = () => { controller.abort(); if (typeof cleanup === 'function') cleanup(); root.remove(); }; cleanups.push(close);
  const action = (name: string) => root.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
  const set = (name: string, value: string) => { const input = root.querySelector<HTMLInputElement>(`input[name="${name}"]`)!; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const feedback = (value: boolean) => { const checkbox = root.querySelector<HTMLInputElement>('input[name="feedback"]')!; checkbox.checked = value; checkbox.dispatchEvent(new Event('input', { bubbles: true })); };
  const row = (label: string) => Array.from(root.querySelectorAll<HTMLTableRowElement>('tr')).find(r => r.cells[0]?.textContent === label)!;
  return { root, controller, close, action, set, feedback, row };
}
describe('observer exercise state and native controls', () => {
  it('constructs observability, checks a real prediction and preserves keyboard focus', () => {
    const v = open(); expect(v.root.textContent).not.toContain('Actual nominal error modes');
    v.action('row').focus(); v.action('row').click(); expect(document.activeElement?.getAttribute('data-action')).toBe('row'); expect(v.root.textContent).toContain('numerical rank is2');
    v.set('l1', '10'); v.set('l2', '10'); v.action('check').click(); expect(v.root.textContent).toContain('Correct nominal observer gain');
    v.action('reveal').focus(); v.action('reveal').click(); expect(document.activeElement?.getAttribute('data-action')).toBe('reveal'); expect(v.root.querySelectorAll('svg')).toHaveLength(7);
    expect(v.row('True x₁').cells[1].textContent).toBe('1'); expect(v.row('Estimated x̂₁').cells[1].textContent).toBe('0'); expect(v.row('Measured output yₘ').cells[1].textContent).toBe('1');
    v.set('inspectTime', '1'); v.action('time').focus(); v.action('time').click(); expect(document.activeElement?.getAttribute('data-action')).toBe('time');
    expect(Number(v.row('Error e₁').cells[1].textContent)).toBeCloseTo(-3 * Math.exp(-6) + 4 * Math.exp(-7), 8);
    expect(v.root.textContent).toContain('All 4 plant/observer/filter homogeneous modes');
  });
  it('recomputes the changed sensor and estimated-state feedback connection', () => {
    const v = open(); v.action('velocity').click(); v.action('reveal').click(); expect(v.root.textContent).toContain('-20'); expect(v.root.textContent).toContain('numerical');
    v.feedback(true); expect(v.root.querySelector<HTMLInputElement>('input[name="heldInput"]')!.disabled).toBe(true); expect(v.root.querySelector<HTMLInputElement>('input[name="reference"]')!.disabled).toBe(false);
    v.action('apply').click(); v.action('reveal').click(); expect(v.root.textContent).toContain('No supported unity-tracking prefilter'); expect(v.root.textContent).toContain('N=1');
    v.action('baseline').click(); v.feedback(true); v.action('apply').click(); v.action('reveal').click(); expect(v.root.textContent).toContain('N=8'); expect(v.root.textContent).toContain('Actual controller modes');
  });
  it('shows the complete filtered dynamics and separate component errors/comparison', () => {
    const v = open(); v.action('filter').click(); v.action('reveal').click(); expect(v.root.textContent).toContain('All 5 plant/observer/filter homogeneous modes');
    expect(v.root.textContent).toContain('(132)'); expect(v.root.textContent).toContain('(420)'); expect(v.root.textContent).toContain('Unfiltered run');
    expect(v.row('Injected signal ν').cells.length).toBe(3); expect(v.row('Injected signal ν').cells[1].textContent).toBe('1'); expect(v.row('Sample RMS e₁')).toBeDefined(); expect(v.row('Sample RMS e₂')).toBeDefined();
    v.action('unstable').click(); v.action('reveal').click(); expect(v.root.textContent).toContain('Authored variation applied'); expect(v.root.textContent).toContain('Homogeneous error dynamics: unstable'); expect(v.root.textContent).toContain('(-2)');
  });
  it('rejects native underflow and range failures, while preserving intentional zero/exponents', () => {
    const v = open(); v.action('reveal').click(); v.set('amplitude', '1e-999'); v.action('apply').click(); expect(v.root.textContent).toContain('too small to represent'); expect(v.root.querySelectorAll('svg')).toHaveLength(0);
    v.set('amplitude', '0e-999'); v.set('frequency', '1e-2'); v.action('apply').click(); v.action('reveal').click(); expect(v.root.querySelectorAll('svg')).toHaveLength(7);
    v.set('tau', '.0001'); v.action('apply').click(); expect(v.root.textContent).toContain('0.001–10 seconds');
    v.set('tau', '0'); v.set('horizon', '0'); v.action('apply').click(); expect(v.root.textContent).toContain('0.1–50 second horizon');
  });
  it('handles invalid visual data, and does not require controllability for observer-only work', () => {
    const v = open(), fields = v.root.querySelectorAll('textarea'); v.action('reveal').click(); fields[3].value = 's^2+1e-2'; fields[3].dispatchEvent(new Event('input'));
    expect(v.root.querySelectorAll('svg')).toHaveLength(0); v.action('apply').click(); expect(v.root.textContent).toContain('e/E symbols are unsupported');
    v.action('baseline').click(); fields[1].value = String.raw`B=\begin{bmatrix}0\\ 0\end{bmatrix}`; fields[1].dispatchEvent(new Event('input')); v.action('apply').click(); v.action('reveal').click(); expect(v.root.textContent).toContain('Actual nominal error modes');
    v.feedback(true); v.action('apply').click(); expect(v.root.textContent).toContain('Controllability rank');
  });
  it('preserves tiny gains in the checked result and rejects a zero prediction', () => {
    const v = open(), fields = v.root.querySelectorAll('textarea'); fields[0].value = String.raw`A=\begin{bmatrix}0&1\\0&0\end{bmatrix}`; fields[3].value = String.raw`s^2+\frac{0.0000001}{10000000}s+\frac{0.0000001}{10000000}`;
    fields[0].dispatchEvent(new Event('input')); v.action('apply').click(); v.action('reveal').click(); expect(v.root.textContent).toContain('10^{-14}');
    v.set('l1', '0'); v.set('l2', '0'); v.action('check').click(); expect(v.root.textContent).toContain('Recheck both');
    v.set('l1', '1e-14'); v.set('l2', '1e-14'); v.action('check').click(); expect(v.root.textContent).toContain('Correct nominal observer gain');
  });
  it('disposes old controls and reopens with baseline initial state, mode and targets', () => {
    const v = open(); v.action('filter').click(); v.feedback(true); v.set('estimate1', '3'); const oldAction = v.action('apply'); v.close(); oldAction.click(); expect(v.root.children.length).toBe(0);
    const fresh = open(); expect(fresh.root.querySelectorAll('textarea')[3].value).toBe('q(s)=(s+6)(s+7)'); expect(fresh.root.querySelector<HTMLInputElement>('input[name="feedback"]')!.checked).toBe(false);
    expect(fresh.root.querySelector<HTMLInputElement>('input[name="initial1"]')!.value).toBe('1'); expect(fresh.root.querySelector<HTMLInputElement>('input[name="estimate1"]')!.value).toBe('0'); expect(fresh.root.querySelector<HTMLInputElement>('input[name="tau"]')!.value).toBe('0'); expect(fresh.root.querySelectorAll('svg')).toHaveLength(0);
  });
});
