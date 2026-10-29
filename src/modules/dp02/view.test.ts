import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
import { mount } from './view';

vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const node = document.createElement('div'); node.setAttribute('aria-label', label); node.textContent = latex; return node; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; element.append(field);
    const getValue = (): EquationDraft => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: false, syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy: () => element.remove() };
  },
}));
const visits: (() => void)[] = [];
afterEach(() => { visits.splice(0).forEach(cleanup => cleanup()); document.body.replaceChildren(); });
function visit() {
  const container = document.createElement('div'), controller = new AbortController(); container.dataset.module = 'DP02'; document.body.append(container);
  const cleanup = mount({ container, signal: controller.signal });
  visits.push(() => { controller.abort(); if (typeof cleanup === 'function') cleanup(); });
  const predict = container.querySelector<HTMLSelectElement>('[data-field="prediction"]')!;
  predict.value = 'unchanged';
  const reveal = () => container.querySelector<HTMLButtonElement>('[data-action="reveal"]')!.click();
  return { container, reveal };
}
describe('DP02 visual/numeric input boundary (presentation mocked)', () => {
  it('rejects algebraic e notation on the visual surface instead of computing scientific 0.01', () => {
    const { container, reveal } = visit(); const field = container.querySelector('textarea')!;
    field.value = '1e-2+3j'; field.dispatchEvent(new Event('input')); reveal();
    expect(container.querySelector('.dp-message')!.textContent).toContain('visual field treats e and E as symbols');
    expect((container.querySelector('.dp-results') as HTMLElement).hidden).toBe(true);
  });
  it('keeps numeric exponent entry and writes a decimal visual draft before parsing', () => {
    const { container, reveal } = visit(); const real = container.querySelector<HTMLInputElement>('[data-field="sigma"]')!;
    real.value = '1e-7'; real.dispatchEvent(new Event('input'));
    expect(container.querySelector('textarea')!.value).toBe('s=0.0000001+3j');
    reveal(); expect((container.querySelector('.dp-results') as HTMLElement).hidden).toBe(false);
    expect(container.querySelector('.dp-results')!.textContent).toContain('s = 1e-7 + 3j');
  });
  it('retains numeric underflow feedback instead of converting the draft to zero', () => {
    const { container } = visit(); const real = container.querySelector<HTMLInputElement>('[data-field="sigma"]')!;
    real.value = '1e-999'; real.dispatchEvent(new Event('input'));
    expect(container.querySelector('.dp-message')!.textContent).toContain('σ is nonzero but too small');
    expect(container.querySelector('textarea')!.value).toBe('');
  });
  it.each([
    ['omega', 'ω'], ['period', 'target T'], ['reference', 'reference T'], ['count', 'sample count'],
  ])('rejects raw underflow in %s and clears a previously revealed mapping', (name, label) => {
    const { container, reveal } = visit(); reveal();
    const results = container.querySelector<HTMLElement>('.dp-results')!;
    expect(results.hidden).toBe(false);
    const field = container.querySelector<HTMLInputElement>(`[data-field="${name}"]`)!;
    field.value = '1e-999'; field.dispatchEvent(new Event('input'));
    expect(results.hidden).toBe(true); expect(results.childElementCount).toBe(0);
    if (name !== 'omega') reveal();
    expect(container.querySelector('.dp-message')!.textContent).toContain(`${label} is nonzero but too small`);
    expect(results.hidden).toBe(true); expect(results.childElementCount).toBe(0);
  });
  it.each(['0', '0e-999', '-0e-999'])('preserves intentional native zero %s for both pole components', raw => {
    const { container, reveal } = visit();
    const real = container.querySelector<HTMLInputElement>('[data-field="sigma"]')!;
    const imaginary = container.querySelector<HTMLInputElement>('[data-field="omega"]')!;
    real.value = raw; imaginary.value = raw; real.dispatchEvent(new Event('input'));
    expect(container.querySelector('textarea')!.value).toBe('s=0+0j');
    reveal();
    expect(container.querySelector<HTMLElement>('.dp-results')!.hidden).toBe(false);
    const sample = container.querySelectorAll('.dp-table tbody tr')[1].querySelectorAll('td');
    expect(Number(sample[2].textContent)).toBe(1); expect(Number(sample[3].textContent)).toBe(1);
  });
  it('uses exponent-entered periods and integer count in independently expected samples', () => {
    const { container, reveal } = visit();
    for (const [name, raw] of [['period', '2e-2'], ['reference', '1e-2'], ['count', '4e1']]) {
      const field = container.querySelector<HTMLInputElement>(`[data-field="${name}"]`)!;
      field.value = raw; field.dispatchEvent(new Event('input'));
    }
    container.querySelector<HTMLSelectElement>('[data-field="prediction"]')!.value = 'inward';
    reveal();
    expect(container.querySelector('.dp-message')!.textContent).toContain('Correct prediction. Radius moves inward');
    expect(container.querySelector<HTMLElement>('.dp-results')!.hidden).toBe(false);
    const sample = container.querySelectorAll('.dp-table tbody tr')[1].querySelectorAll('td');
    expect(Number(sample[1].textContent)).toBe(.02);
    expect(Number(sample[2].textContent)).toBeCloseTo(Math.exp(-.04) * Math.cos(.06), 5);
    expect(Number(sample[3].textContent)).toBeCloseTo(Math.exp(-.04), 5);
    expect(container.querySelector('.dp-results')!.textContent).toContain('40 intervals');
  });
  it.each([
    ['sigma', '1001', 'Use |σ| ≤ 1000'], ['omega', '10001', 'Use |σ| ≤ 1000'],
    ['period', '0.0009', 'Sample period T must be from'], ['reference', '11', 'Sample period T must be from'],
    ['count', '3', 'Choose 4 to 100 sample intervals'], ['count', '101', 'Choose 4 to 100 sample intervals'],
    ['count', '4.5', 'Choose 4 to 100 sample intervals'],
  ])('retains local bounds for %s = %s', (name, raw, expected) => {
    const { container, reveal } = visit(); reveal();
    const field = container.querySelector<HTMLInputElement>(`[data-field="${name}"]`)!;
    field.value = raw; field.dispatchEvent(new Event('input')); reveal();
    expect(container.querySelector('.dp-message')!.textContent).toContain(expected);
    const results = container.querySelector<HTMLElement>('.dp-results')!;
    expect(results.hidden).toBe(true); expect(results.childElementCount).toBe(0);
  });
});
