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


describe('DF01 integration native input semantics', () => {
  it.each(['period', 'horizon'])('clears stale results for nonzero native underflow in %s', name => {
    const v = open(); v.click('reveal'); v.input(name, '1e-999'); v.click('plot');
    expect(v.container.querySelector('.df-status')!.textContent).toContain('nonzero but too small'); expect(v.container.querySelector('svg')).toBeNull(); expect(v.container.querySelector<HTMLElement>('.df-answer')!.hidden).toBe(true); v.close();
  });
  it('preserves normal native exponents and integer horizon bounds', () => {
    const v = open(); v.input('period', '1e-2'); v.input('horizon', '6e1'); v.click('plot'); expect(v.container.querySelector('.df-status')!.textContent).toContain('time 0…0.6 s');
    v.input('horizon', '4.5'); v.click('plot'); expect(v.container.querySelector('svg')).toBeNull(); v.close();
  });
  it('rejects an underflowing inspector without moving to zero and accepts intentional zero', () => {
    const v = open(); v.input('inspect', '2'); v.input('inspect', '1e-999'); expect(v.container.querySelector('.df-inspector')!.textContent).toContain('nonzero but too small');
    expect(v.container.querySelector('svg')!.textContent).toContain('inspect k=2'); v.input('inspect', '0e-999'); expect(v.container.querySelector('.df-inspector')!.textContent).toContain('k = 0;'); v.close();
  });
  it.each(['peak', 'settling'])('does not accept an underflowing optional %s prediction as zero', name => {
    const v = open(); v.click('reveal'); v.input(name, '1e-999'); v.click('reveal'); expect(v.container.querySelector('.df-feedback')!.textContent).toContain('nonzero but too small'); expect(v.container.querySelector<HTMLElement>('.df-answer')!.hidden).toBe(true);
    v.input(name, '0e-999'); v.click('reveal'); expect(v.container.querySelector<HTMLElement>('.df-answer')!.hidden).toBe(false); expect(v.container.querySelector('.df-feedback')!.textContent).not.toContain('nonzero but too small'); v.close();
  });
  it('retains optional blanks and ignores the unused settling guess when not-established is selected', () => {
    const v = open(); v.click('reveal'); expect(v.container.querySelector<HTMLElement>('.df-answer')!.hidden).toBe(false);
    v.input('settling', '1e-999'); v.container.querySelector<HTMLInputElement>('[name="unestablished"]')!.checked = true; v.click('reveal'); expect(v.container.querySelector<HTMLElement>('.df-answer')!.hidden).toBe(false);
    v.input('peak', '6e1'); v.click('reveal'); expect(v.container.querySelector('.df-feedback')!.textContent).toContain('correct'); v.close();
  });
});
