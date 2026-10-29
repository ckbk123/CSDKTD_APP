import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
import { mount } from './view';

vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const element = document.createElement('div'); element.textContent = latex; element.setAttribute('aria-label', label); return element; },
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
  const container = document.createElement('div'); container.dataset.module = 'DP04'; document.body.append(container);
  const controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
  visits.push(() => { controller.abort(); if (typeof cleanup === 'function') cleanup(); });
  const button = (name: string) => container.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!;
  const numeric = (name: string, value: string) => { const field = container.querySelector<HTMLInputElement>(`[data-number="${name}"]`)!; field.value = value; field.dispatchEvent(new Event('input')); };
  const editor = (source: string) => { const field = container.querySelector('textarea')!; field.value = source; field.dispatchEvent(new Event('input')); };
  const reveal = () => { button('build').click(); button('reveal').click(); };
  return { container, controller, button, numeric, editor, reveal };
}
describe('DP04 model/attempt/reveal wiring (mocked equation presentation only)', () => {
  it('checks a real-axis prediction before revealing both baseline roots', () => {
    const { container, button } = visit(); button('build').click();
    expect((container.querySelector('.rl-results') as HTMLElement).hidden).toBe(true);
    const intervals = container.querySelectorAll<HTMLInputElement>('[data-interval]'); expect(intervals).toHaveLength(4);
    intervals[0].checked = true; intervals[2].checked = true; button('reveal').click();
    expect(container.querySelector('.rl-message')!.textContent).toContain('Correct interval prediction');
    expect(container.querySelectorAll('.rl-selected tbody tr')).toHaveLength(2);
    expect(container.querySelector('.rl-selected')!.textContent).toContain('0.4472136j');
    expect(container.querySelector('.rl-selected')!.textContent).toContain('Numerically inside');
  });
  it('distinguishes adjacent interval endpoints and grades its odd boundary count', () => {
    const { container, button, editor } = visit(); editor('(z-0.9999999999999999)/(z(z-1))'); button('build').click();
    const intervals = container.querySelectorAll<HTMLInputElement>('[data-interval]');
    expect(intervals[2].parentElement!.textContent).toBe('(0.9999999999999999, 1)');
    intervals[0].checked = true; intervals[2].checked = true; button('reveal').click();
    expect(container.querySelector('.rl-message')!.textContent).toContain('Correct interval prediction');
    const row = container.querySelectorAll('.rl-construction tbody tr')[2];
    expect([...row.querySelectorAll('td')].map(cell => cell.textContent)).toEqual(['(0.9999999999999999, 1)', '1', 'Yes', 'Yes']);
  });
  it('shows the entire boundary and unstable root set when K changes', () => {
    const { container, reveal, numeric } = visit(); reveal(); numeric('gain', '2.5');
    expect(container.querySelector('.rl-selected')!.textContent).toContain('Boundary or numerically near-boundary');
    expect(container.querySelectorAll('.rl-selected tbody tr')).toHaveLength(2);
    numeric('gain', '3'); expect(container.querySelector('.rl-selected')!.textContent).toContain('Outside:');
    expect(container.querySelector('.rl-selected')!.textContent).toContain('-1.6324555');
  });
  it('retains a fixed unstable root rather than canceling a common factor', () => {
    const { container, reveal, numeric } = visit(); container.querySelector<HTMLButtonElement>('[data-preset="common"]')!.click(); numeric('gain', '0.25'); reveal();
    const rows = container.querySelectorAll('.rl-selected tbody tr'); expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('2'); expect(rows[1].textContent).toContain('-0.75');
    expect(container.querySelector('.rl-selected')!.textContent).toContain('Outside:');
  });
  it('invalidates old work and computes a changed visual model', () => {
    const { container, reveal, numeric, editor } = visit(); reveal(); editor('(z+.5)/(z(z-1))');
    expect((container.querySelector('.rl-results') as HTMLElement).hidden).toBe(true);
    numeric('gain', '2'); reveal(); expect(container.querySelector('.rl-selected')!.textContent).toContain('0.8660254j');
    expect(container.querySelector('.rl-selected')!.textContent).toContain('Boundary or numerically near-boundary');
  });
  it('rejects native nonzero underflow while preserving genuine zero and exponents', () => {
    const { container, reveal, numeric } = visit(); reveal(); numeric('gain', '1e-999');
    expect((container.querySelector('.rl-results') as HTMLElement).hidden).toBe(true);
    expect(container.querySelector('.rl-message')!.textContent).toContain('nonzero but too small');
    numeric('gain', '0e-999'); expect((container.querySelector('.rl-results') as HTMLElement).hidden).toBe(false);
    expect(container.querySelector('.rl-selected')!.textContent).toContain('Displayed gain K = 0');
    numeric('gain', '1e-2'); expect(container.querySelector('.rl-selected')!.textContent).toContain('Displayed gain K = 0.01');
    numeric('gain', '1e-101'); expect((container.querySelector('.rl-results') as HTMLElement).hidden).toBe(true);
    expect(container.querySelector('.rl-message')!.textContent).toContain('at least 10⁻¹⁰⁰');
  });
  it('uses both angle and magnitude and applies the candidate gain to all roots', () => {
    const { container, reveal, numeric, button } = visit(); reveal(); numeric('pointReal', '-1'); numeric('pointImag', '0'); button('point').click();
    expect(button('usePoint').disabled).toBe(false); button('usePoint').click();
    expect(container.querySelector('.rl-selected')!.textContent).toContain('Boundary or numerically near-boundary');
    expect(container.querySelectorAll('.rl-selected tbody tr')).toHaveLength(2);
    numeric('pointReal', '.5'); numeric('pointImag', '.5'); button('point').click();
    expect(button('usePoint').disabled).toBe(true); expect(container.querySelector('.rl-point-feedback')!.textContent).toContain('conditions fail');
  });
  it('retains the previous valid plotted point when a new numeric candidate underflows', () => {
    const { container, reveal, numeric, button } = visit(); reveal(); button('point').click();
    const before = container.querySelector('.rl-plot figcaption')!.textContent;
    expect(before).toContain('Last plotted point:'); numeric('pointReal', '1e-999'); button('point').click();
    expect(container.querySelector('.rl-plot figcaption')!.textContent).toBe(before);
    expect(container.querySelector('.rl-point-feedback')!.textContent).toContain('previous valid plotted point');
    expect(button('usePoint').disabled).toBe(true);
  });
  it('explains singular candidate points without applying an invented gain', () => {
    const { container, reveal, numeric, button } = visit(); reveal(); numeric('pointReal', '-.2'); numeric('pointImag', '0'); button('point').click();
    expect(container.querySelector('.rl-point-feedback')!.textContent).toContain('no finite magnitude gain'); expect(button('usePoint').disabled).toBe(true);
  });
  it('rejects visually mixed input before constructing a model', () => {
    const { container, button, editor } = visit(); editor(String.raw`\frac{2\frac12}{z(z-1)}`); button('build').click();
    expect(container.querySelector('.rl-message')!.textContent).toContain('explicit + or ×');
    expect((container.querySelector('.rl-quiz') as HTMLElement).hidden).toBe(true);
  });
  it.each([['period', '0'], ['maximum', '0'], ['range', '1'], ['intervals', '4.5']])('validates %s bounds', (name, value) => {
    const { container, numeric, button } = visit(); numeric(name, value); button('build').click();
    expect((container.querySelector('.rl-quiz') as HTMLElement).hidden).toBe(true);
    expect(container.querySelector('.rl-message')!.textContent).not.toContain('Pole/zero view built');
  });
  it('aborts old controls and initializes fresh visit state', () => {
    const first = visit(); first.numeric('gain', '3'); first.controller.abort(); first.button('build').click();
    expect((first.container.querySelector('.rl-quiz') as HTMLElement).hidden).toBe(true);
    const next = visit(); expect(next.container.querySelector<HTMLInputElement>('[data-number="gain"]')!.value).toBe('1');
    expect((next.container.querySelector('.rl-results') as HTMLElement).hidden).toBe(true);
  });
});
