import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const el = document.createElement('p'); el.textContent = `${label}: ${value}`; return el; },
  createEquationInput: (options: { value: string; onChange: (draft: unknown) => void; signal: AbortSignal }) => {
    const element = document.createElement('div'), field = document.createElement('textarea');
    field.value = options.value; element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value, hasPlaceholders: false, syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (v: string) => { field.value = v; }, focus: () => field.focus(), destroy: () => element.remove() };
  },
}));
import { mount } from './view';
afterEach(() => document.body.replaceChildren());
function open() {
  const container = document.createElement('div'), controller = new AbortController();
  container.dataset.module = 'DF01'; document.body.append(container);
  const cleanup = mount({ container, signal: controller.signal });
  const click = (action: string) => container.querySelector<HTMLButtonElement>(`[data-action="${action}"]`)!.click();
  const input = (name: string, value: string) => { const el = container.querySelector<HTMLInputElement>(`[name="${name}"]`)!; el.value = value; el.dispatchEvent(new Event('input')); };
  return { container, click, input, close: () => { controller.abort(); if (cleanup) cleanup(); } };
}
describe('DF01 visit-owned result transitions (mocked equations, not browser evidence)', () => {
  it('invalidates old results when physical time changes and recomputes seconds', () => {
    const v = open();
    v.input('settling', '18'); v.input('peak', '60'); v.click('reveal');
    expect(v.container.querySelector('.df-feedback')!.textContent).toContain('correct');
    expect(v.container.querySelector('.df-summary')!.textContent).toContain('1.8 s');
    v.input('period', '.2');
    expect(v.container.querySelector<HTMLElement>('.df-answer')!.hidden).toBe(true);
    expect(v.container.querySelector('svg')).toBeNull();
    v.click('plot'); v.click('reveal');
    expect(v.container.querySelector('.df-summary')!.textContent).toContain('3.6 s');
    v.close();
  });
  it('removes stale answers after invalid model edits; reopening restores baseline', () => {
    const v = open(); v.click('oscillatory'); v.click('reveal');
    expect(v.container.querySelector('.df-summary')!.textContent).toContain('25%');
    const field = v.container.querySelector('textarea')!;
    field.value = '1/(z-2)'; field.dispatchEvent(new Event('input'));
    v.click('plot');
    expect(v.container.querySelector('svg')).toBeNull();
    expect(v.container.querySelector('.df-status')!.textContent).toContain('strictly inside');
    v.close();
    const next = open(); next.click('reveal');
    expect(next.container.querySelector('.df-summary')!.textContent).toContain('kₛ = 18');
    expect(next.container.querySelector<HTMLInputElement>('[name="peak"]')!.value).toBe('');
    next.close();
  });
});
