import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({
  createEquationInput: (options: { label: string; value: string; signal: AbortSignal; onChange?: (draft: unknown) => void }) => {
    const element = document.createElement('div'), input = document.createElement('textarea'); input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    const getValue = () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: input.value.includes('\\placeholder'), syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (v: string) => { input.value = v; }, destroy, focus: () => input.focus() };
  },
  createEquationDisplay: (latex: string, label: string) => { const e = document.createElement('div'); e.setAttribute('aria-label', label); e.textContent = latex; return e; },
}));
import { mountView } from './view';
const hide = vi.fn();
beforeEach(() => { Object.defineProperty(window, 'mathVirtualKeyboard', { configurable: true, value: { hide } }); hide.mockClear(); });
afterEach(() => { document.body.replaceChildren(); });
function open() {
  const container = document.createElement('div'), controller = new AbortController(); container.dataset.module = 'CR01'; document.body.append(container);
  const cleanup = mountView({ container, signal: controller.signal });
  const field = <T extends HTMLElement = HTMLInputElement>(label: string) => container.querySelector<T>(`[aria-label="${label}"]`)!;
  const button = (name: string) => [...container.querySelectorAll('button')].find(b => b.textContent === name)!;
  const change = (label: string, value: string) => { const input = field<HTMLInputElement>(label); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const reveal = () => button('Expand, factor and reveal').click();
  return { container, controller, cleanup, field, button, change, reveal };
}
describe('CR01 teaching interactions with mocked presentation only', () => {
  it('requires reveal and checks a coefficient with independent baseline root/discriminant output', () => {
    const t = open(); expect(t.container.querySelector<HTMLElement>('.cr01-output')!.hidden).toBe(true);
    t.change('Your coefficient prediction', '27'); t.reveal();
    expect(t.container.textContent).toContain('Coefficient prediction matches exactly'); expect(t.container.textContent).toContain('Negative discriminant');
    expect(t.container.querySelectorAll('.cr01-output tbody').length).toBe(2); expect(t.container.querySelector('svg')).not.toBeNull();
    expect(t.container.textContent).toContain('-2 + 3j'); t.controller.abort(); if (typeof t.cleanup === 'function') t.cleanup(); expect(t.container.children.length).toBe(0);
  });
  it('copies exact fractions into editable coefficients and applies changed data', () => {
    const t = open(); t.change('Polynomial P(s)', '\\frac13s^2+\\frac23s+1'); t.button('Copy exact coefficients from P(s)').click();
    expect(t.field<HTMLTextAreaElement>('Coefficient a2 for s^2').value).toBe('\\frac{1}{3}');
    t.change('Coefficient a0 for s^0', '2'); t.button('Apply coefficient drafts').click(); t.reveal();
    expect(t.field<HTMLTextAreaElement>('Polynomial P(s)').value).toBe('\\frac{1}{3}s^{2}+\\frac{2}{3}s+2');
    expect(t.container.querySelector<HTMLElement>('.cr01-output')!.hidden).toBe(false); t.controller.abort();
  });
  it('has exact real/conjugate pole construction and rejects excess degree', () => {
    const t = open(); t.button('Apply root drafts').click(); expect(t.container.textContent).toContain('Exact re-expansion matches');
    t.change('Row 1 real part', '-.5'); t.button('Apply root drafts').click(); expect(t.container.textContent).toContain('changed polynomial');
    const include = t.field<HTMLInputElement>('Include root row 4'); include.checked = true; t.button('Apply root drafts').click(); expect(t.container.textContent).toContain('exceed degree four'); t.controller.abort();
  });
  it.each(['1e-999', '-1e-999'])('rejects native nonzero underflow %s in a pole and hides stale output', raw => {
    const t = open(); t.reveal(); t.change('Row 1 real part', raw); t.button('Apply root drafts').click();
    expect(t.container.textContent).toContain('nonzero but too small'); expect(t.container.querySelector<HTMLElement>('.cr01-output')!.hidden).toBe(true); t.controller.abort();
  });
  it('preserves native normal scientific notation and intentional zero', () => {
    const t = open(); t.change('Row 1 real part', '-1e-2'); t.change('Row 1 imaginary magnitude', '0e-999'); t.button('Apply root drafts').click();
    expect(t.container.textContent).toContain('changed polynomial'); t.reveal(); expect(t.container.textContent).toContain('-0.01 + 0j'); t.controller.abort();
  });
  it('retains original rational-expression domains and rejects near cancellation', () => {
    const t = open(); t.button('Compare rational expressions').click(); expect(t.container.textContent).toContain('Equal on their common domain'); expect(t.container.textContent).toContain('domains differ');
    t.change('Numerator A', '1'); t.change('Denominator A', 's+1'); t.change('Numerator B', '1'); t.change('Denominator B', 's+1.001');
    t.button('Compare rational expressions').click(); expect(t.container.textContent).toContain('cross-product difference is nonzero');
    t.change('Denominator B', '0'); t.button('Compare rational expressions').click(); expect(t.container.querySelector('.cr01-comparison')!.textContent).toContain('zero polynomial'); t.controller.abort();
  });
  it('handles real/repeated discriminants and independent new visits', () => {
    const t = open(); t.change('Polynomial P(s)', '(s-1)^2'); t.reveal(); expect(t.container.textContent).toContain('Zero discriminant');
    t.button('Irrational real roots').click(); t.reveal(); expect(t.container.textContent).toContain('Positive discriminant');
    t.controller.abort(); if (typeof t.cleanup === 'function') t.cleanup(); const next = open(); expect(next.field<HTMLTextAreaElement>('Polynomial P(s)').value).toContain('+26'); expect(next.container.querySelector<HTMLElement>('.cr01-output')!.hidden).toBe(true); next.controller.abort();
  });
  it.each(['2\\frac12', 's{+1}', 's^12', '\\placeholder{}', '', 's^5'])('hides stale results and explains invalid input %s', value => {
    const t = open(); t.reveal(); t.change('Polynomial P(s)', value); t.reveal(); expect(t.container.querySelector<HTMLElement>('.cr01-output')!.hidden).toBe(true); expect(t.container.querySelector('.cr01-message')!.textContent!.length).toBeGreaterThan(10); t.controller.abort();
  });
  it('cancels Escape before the shared editor handler and dismisses its keyboard', () => {
    const t = open(), field = t.field('Polynomial P(s)'), later = vi.fn(); field.addEventListener('keydown', later);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); field.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true); expect(later).not.toHaveBeenCalled(); expect(hide).toHaveBeenCalledOnce();
    t.button('Proposed quartic').click(); t.reveal(); expect(t.container.querySelector<HTMLElement>('.cr01-output')!.hidden).toBe(false); t.controller.abort();
  });
});
