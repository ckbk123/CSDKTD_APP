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
  const container = document.createElement('div'); container.dataset.module = 'DD04'; document.body.append(container);
  const controller = new AbortController(); const cleanup = mount({ container, signal: controller.signal });
  visits.push(() => { controller.abort(); if (typeof cleanup === 'function') cleanup(); });
  const button = (name: string) => container.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
  const numeric = (name: string, value: string) => { const field = container.querySelector<HTMLInputElement>(`[data-number="${name}"]`)!; field.value = value; field.dispatchEvent(new Event('input')); };
  return { container, controller, button, numeric };
}
describe('DD04 read/calculate/commit interface (mocked presentation only)', () => {
  it('keeps old memory unchanged until committing a checked sample', () => {
    const { container, button } = visit(); button('derive').click();
    const panel = container.querySelector('.pid-memory')!; const before = panel.textContent;
    button('calculate').click();
    expect(panel.textContent).toBe(before); expect(container.querySelector('.pid-pending')!.textContent).toContain('14.1');
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(button('commit').disabled).toBe(false);
    button('commit').click();
    expect(panel.textContent).toContain('u[1]14.1'); expect(container.querySelectorAll('tbody tr')).toHaveLength(1);
    button('calculate').click(); button('commit').click();
    expect(panel.textContent).toContain('u[2]4.3'); expect(container.querySelectorAll('tbody tr')).toHaveLength(2);
  });
  it('discards the current experiment after changed controller data', () => {
    const { container, button, numeric } = visit(); button('derive').click(); button('calculate').click();
    numeric('period', '0.2');
    expect((container.querySelector('.pid-lesson') as HTMLElement).hidden).toBe(true);
    button('commit').click(); button('derive').click();
    expect(container.querySelector('.pid-derivation')!.textContent).toContain('b₀=9.2');
    button('run').click(); expect(container.querySelector('tbody')!.textContent).toContain('9.2');
  });
  it('uses the edited visual samples rather than the shell preview', () => {
    const { container, button } = visit(); const field = container.querySelector('textarea')!;
    field.value = '[\\frac12,1]'; field.dispatchEvent(new Event('input'));
    button('derive').click(); button('calculate').click();
    expect(container.querySelector('.pid-pending')!.textContent).toContain('7.05');
  });
  it('preserves specified nonzero initial memory and restarts it explicitly', () => {
    const { container, button, numeric } = visit(); numeric('i0', '2.5'); button('derive').click(); button('calculate').click();
    expect(container.querySelector('.pid-pending')!.textContent).toContain('16.6'); button('commit').click(); button('restart').click();
    expect(container.querySelectorAll('tbody tr')).toHaveLength(0); expect(container.querySelector('.pid-memory')!.textContent).toContain('I[0]2.5');
  });
  it('aborts old controls and fresh visits restore baseline input', () => {
    const first = visit(); first.numeric('kp', '7'); first.controller.abort(); first.button('derive').click();
    expect((first.container.querySelector('.pid-lesson') as HTMLElement).hidden).toBe(true);
    const second = visit(); expect(second.container.querySelector<HTMLInputElement>('[data-number="kp"]')!.value).toBe('4');
  });
});
