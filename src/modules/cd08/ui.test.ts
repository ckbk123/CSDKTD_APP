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
  return { root, controller, close, action, set };
}
describe('two-state feedback lesson', () => {
  it('clears revealed plots for a significant blank exponent and recovers a properly filled power box', () => {
    const v = open(); v.action('reveal').click(); expect(v.root.querySelectorAll('svg')).toHaveLength(4);
    const target = v.root.querySelectorAll('textarea')[3]; target.value = 's^\u20092+6s+8'; target.dispatchEvent(new Event('input')); v.action('apply').click();
    expect(v.root.textContent).toContain('blank space cannot fill a box'); expect(v.root.querySelectorAll('svg')).toHaveLength(0);
    target.value = 's^{\u20092}+6s+8'; target.dispatchEvent(new Event('input')); v.action('apply').click(); v.action('reveal').click();
    expect(v.root.querySelectorAll('svg')).toHaveLength(4); v.close();
  });
  it('typesets a tiny nonzero gain as a power of ten rather than zero', () => {
    const v = open(), fields = v.root.querySelectorAll('textarea'); fields[0].value = String.raw`A=\begin{bmatrix}0&1\\0&0\end{bmatrix}`;
    fields[3].value = String.raw`q(s)=s^2+\frac{0.0000001}{10000000}s+\frac{0.0000001}{10000000}`;
    fields[0].dispatchEvent(new Event('input')); fields[3].dispatchEvent(new Event('input')); v.action('apply').click(); v.action('reveal').click(); expect(v.root.textContent).toContain('10^{-14}');
    v.set('k1', '0'); v.set('k2', '0'); v.set('n', '0'); v.action('check').click(); expect(v.root.textContent).toContain('Recheck both matching equations');
    v.set('k1', '1e-14'); v.set('k2', '1e-14'); v.set('n', '1e-14'); v.action('check').click(); expect(v.root.textContent).toContain('Correct feedback and tracking conclusion');
  });
  it('constructs rank, checks a genuine attempt, reveals both pole and tracking results', () => {
    const v = open(); expect(v.root.textContent).not.toContain('Actual eigenvalues');
    v.action('column').focus(); v.action('column').click(); expect(v.root.textContent).toContain('numerical rank is 2'); expect(document.activeElement?.getAttribute('data-action')).toBe('column');
    v.set('k1', '6'); v.set('k2', '3'); v.set('n', '8'); v.action('check').click(); expect(v.root.textContent).toContain('Correct feedback and tracking conclusion');
    v.action('reveal').focus(); v.action('reveal').click(); expect(v.root.textContent).toContain('Actual eigenvalues'); expect(v.root.textContent).toContain('0.125'); expect(v.root.querySelectorAll('svg').length).toBe(4); expect(document.activeElement?.getAttribute('data-action')).toBe('reveal');
    v.set('inspectTime', '5'); v.action('time').focus(); v.action('time').click(); expect(document.activeElement?.getAttribute('data-action')).toBe('time'); expect(v.root.textContent).toContain('Nearest sampled time: 5 s');
    v.action('variation').click(); v.action('reveal').click(); expect(v.root.textContent).toContain('N=5');
    v.action('complex').click(); v.action('reveal').click(); expect(v.root.textContent).toContain('− j 3');
  });
  it('reports an unavailable prefilter while preserving actual feedback computation', () => {
    const v = open(); v.action('velocity').click(); v.action('reveal').click(); expect(v.root.textContent).toContain('No reliable static unity-tracking prefilter');
    expect(v.root.textContent).toContain('Actual eigenvalues'); expect(v.root.querySelectorAll('table tr').length).toBe(2);
    v.set('k1', '6'); v.set('k2', '3'); const check = v.root.querySelector<HTMLInputElement>('input[name="none"]')!; check.checked = true; check.dispatchEvent(new Event('input', { bubbles: true })); v.action('check').click(); expect(v.root.textContent).toContain('Correct feedback and tracking conclusion');
  });
  it('rejects native underflow, retains intentional zero and accepts normal native exponent notation', () => {
    const v = open(); v.action('reveal').click(); v.set('reference', '1e-999'); v.action('apply').click(); expect(v.root.textContent).toContain('too small to represent'); expect(v.root.querySelectorAll('svg').length).toBe(0);
    v.set('reference', '0e-999'); v.action('apply').click(); v.action('reveal').click(); expect(v.root.querySelectorAll('svg').length).toBe(4);
    v.set('reference', '1e-2'); v.action('apply').click(); expect(v.root.textContent).toContain('Model applied');
    v.set('horizon', '0'); v.action('apply').click(); expect(v.root.textContent).toContain('0.1–50 seconds');
    v.set('horizon', '5'); v.set('initial1', '0'); v.action('apply').click(); expect(v.root.textContent).toContain('Model applied');
  });
  it('invalidates edited visual data, recovers from errors, and returns fresh state on reopen', () => {
    const v = open(); v.action('reveal').click(); const target = v.root.querySelectorAll('textarea')[3]; target.value = 's^2+1e-2'; target.dispatchEvent(new Event('input'));
    expect(v.root.querySelectorAll('svg').length).toBe(0); v.action('apply').click(); expect(v.root.textContent).toContain('e/E symbols are unsupported');
    v.action('baseline').click(); v.action('reveal').click(); const old = v.action('variation'); v.close(); old.click(); expect(v.root.children.length).toBe(0);
    const fresh = open(); expect(fresh.root.textContent).not.toContain('Actual eigenvalues'); expect(fresh.root.querySelectorAll('textarea')[3].value).toBe('q(s)=(s+2)(s+4)');
  });
});
