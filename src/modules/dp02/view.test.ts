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
    expect(container.querySelector('.dp-message')!.textContent).toContain('nonzero value for σ is too small');
    expect(container.querySelector('textarea')!.value).toBe('');
  });
});
