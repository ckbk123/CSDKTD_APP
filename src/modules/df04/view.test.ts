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
  const container = document.createElement('div'); container.dataset.module = 'DF04'; document.body.append(container);
  const controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
  visits.push(() => { controller.abort(); if (typeof cleanup === 'function') cleanup(); });
  const build = (policy = 'both') => container.querySelector<HTMLButtonElement>(`[data-build="${policy}"]`)!.click();
  const reveal = () => container.querySelector<HTMLButtonElement>('[data-action="reveal"]')!.click();
  const numeric = (name: string, value: string) => { const field = container.querySelector<HTMLInputElement>(`[data-number="${name}"]`)!; field.value = value; field.dispatchEvent(new Event('input', { bubbles: true })); };
  const editor = (source: string) => { const field = container.querySelector('textarea')!; field.value = source; field.dispatchEvent(new Event('input', { bubbles: true })); };
  const preset = (name: string) => container.querySelector<HTMLButtonElement>(`[data-preset="${name}"]`)!.click();
  return { container, controller, build, reveal, numeric, editor, preset };
}
describe('DF04 prediction/comparison wiring (mocked equation presentation)', () => {
  it('checks all six complete poles and the time-weighted prediction before revealing', () => {
    const { container, build, reveal } = visit(); build();
    expect((container.querySelector('.sp-results') as HTMLElement).hidden).toBe(true);
    const predictions = container.querySelectorAll<HTMLInputElement>('[data-predict]'); expect(predictions).toHaveLength(6); predictions.forEach(field => { field.checked = true; });
    (container.querySelector('[data-choice="sum"]') as HTMLSelectElement).value = 'weighted'; reveal();
    expect(container.querySelector('.sp-grade')!.textContent).toContain('Correct numerical stability predictions');
    expect(container.querySelector('.sp-grade')!.textContent).toContain('Correct: interval weights');
    expect(container.querySelectorAll('.sp-summary tbody tr')).toHaveLength(6);
    expect(container.querySelector('.sp-summary')!.textContent).toContain('0.71451225');
    expect(container.querySelector('.sp-detail')!.textContent).toContain('shared H = 5 s');
  });
  it('exposes raw-sum scaling with identical weighted ISE at a common horizon', () => {
    const { container, preset, build, reveal } = visit(); preset('raw'); build('fixed'); reveal();
    const rows = [...container.querySelectorAll('.sp-metrics tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent));
    expect(rows.map(row => [row[1], row[2], row[3], row[4], row[6]])).toEqual([['10', '10', '1', '1', '0'], ['5', '5', '1', '1', '0'], ['4', '4', '1', '1', '0']]);
    expect(container.querySelector('.sp-grade')!.textContent).toContain('raw sample sum changes scale');
  });
  it('keeps fixed-gain and physical-rate design as separate actions', () => {
    const { container, build, reveal, numeric } = visit(); numeric('rate', ''); build('fixed'); reveal();
    expect(container.querySelectorAll('.sp-summary tbody tr')).toHaveLength(3);
    expect(container.querySelector('.sp-summary')!.textContent).not.toContain('redesigned gain');
    numeric('rate', '3'); numeric('gain', ''); build('redesign'); reveal();
    expect(container.querySelectorAll('.sp-summary tbody tr')).toHaveLength(3);
    expect(container.querySelector('.sp-summary')!.textContent).not.toContain('fixed gain');
    expect(container.querySelector('.sp-detail')!.textContent).toContain('Redesign changes K and the tracking bias');
  });
  it('shows a partial interval and terminal observation without an extra weighted update', () => {
    const { container, build, reveal, numeric } = visit(); numeric('t1', String(Math.LN2)); numeric('horizon', String(2.5 * Math.LN2)); build('fixed'); reveal(); numeric('cursor', '2');
    expect(container.querySelector('.sp-detail')!.textContent).toContain('0.34657359');
    expect(container.querySelector('.sp-detail')!.textContent).toContain('0.64644661');
    expect(container.querySelector('.sp-detail')!.textContent).toContain('no extra interval or quadrature weight');
    expect(container.querySelector('.sp-metrics tbody tr')!.textContent).toContain('0.77979058');
  });
  it('invalidates prior comparisons and computes a changed visual plant', () => {
    const { container, build, reveal, editor } = visit(); build(); reveal(); editor(String.raw`\frac2{0.5s+1}`);
    expect((container.querySelector('.sp-results') as HTMLElement).hidden).toBe(true); build('fixed'); reveal();
    expect(container.querySelector('.sp-summary tbody tr')!.textContent).toContain('0.093653765');
  });
  it('keeps impossible redesign feedback separate from valid fixed-gain results', () => {
    const { container, build, reveal, numeric } = visit(); numeric('rate', '0.5'); build(); reveal();
    expect(container.querySelectorAll('.sp-metrics tbody tr')).toHaveLength(6);
    expect(container.querySelector('.sp-summary')!.textContent).toContain('lambda at least 1/tau');
    expect(container.querySelectorAll('[data-plot]')).toHaveLength(3);
  });
  it('does not grade an entirely unsupported comparison as a correct stability prediction', () => {
    const { container, build, reveal, numeric } = visit(); numeric('rate', '0.5'); build('redesign'); reveal();
    expect(container.querySelector('.sp-grade')!.textContent).toContain('No supported case');
    expect(container.querySelector('.sp-grade')!.textContent).not.toContain('Correct numerical stability');
    expect(container.querySelector<HTMLInputElement>('[data-number="cursor"]')!.disabled).toBe(true);
    numeric('rate', '3'); build('redesign'); reveal();
    expect(container.querySelector<HTMLInputElement>('[data-number="cursor"]')!.disabled).toBe(false);
  });
  it('reports growth without substituting partial-horizon metrics', () => {
    const { container, numeric, build, reveal } = visit(); numeric('gain', '100'); numeric('horizon', '60'); numeric('t1', '1'); build('fixed'); reveal();
    expect(container.querySelector('.sp-summary')!.textContent).toContain('no partial metrics');
    expect(container.querySelector('.sp-metrics tbody tr')!.textContent).toContain('Unavailable');
    expect(container.querySelector('.sp-detail')!.textContent).toContain('not reported as a steady limit');
  });
  it('does not turn unsupported native underflow into zero and preserves intentional zero', () => {
    const { container, numeric, build, reveal } = visit(); build(); reveal(); numeric('gain', '1e-999'); build('fixed');
    expect(container.querySelector('.sp-message')!.textContent).toContain('nonzero but too small');
    expect((container.querySelector('.sp-results') as HTMLElement).hidden).toBe(true);
    numeric('gain', '0e-999'); build('fixed'); reveal();
    const zeroCells = container.querySelector('.sp-metrics tbody tr')!.querySelectorAll('td');
    expect([zeroCells[2].textContent, zeroCells[3].textContent, zeroCells[6].textContent]).toEqual(['50', '5', '0']);
    numeric('gain', '1e-2'); build('fixed'); reveal(); expect(container.querySelector('.sp-summary tbody tr')!.textContent).toContain('0.01');
  });
  it('rejects displayed mixed fractions and ambiguous exponent tails before preparation', () => {
    const { container, editor, build } = visit(); editor(String.raw`\frac{2\frac12}{s+1}`); build();
    expect(container.querySelector('.sp-message')!.textContent).toContain('explicit + or ×');
    editor(String.raw`\frac1{s^1.0+s+1}`); build(); expect(container.querySelector('.sp-message')!.textContent).toContain('raised box');
    expect((container.querySelector('.sp-attempt') as HTMLElement).hidden).toBe(true);
  });
  it('uses explicit physical reconstruction and independent plot visibility controls', () => {
    const { container, build, reveal } = visit(); build(); reveal();
    expect(container.querySelector('.sp-output-plot figcaption')!.textContent).toContain('no connecting interpolation');
    const reconstruct = container.querySelector<HTMLInputElement>('[data-option="reconstruct"]')!; reconstruct.checked = true; reconstruct.dispatchEvent(new Event('change', { bubbles: true }));
    expect(container.querySelector('.sp-output-plot figcaption')!.textContent).toContain('continuous plant and held input');
    container.querySelectorAll<HTMLInputElement>('[data-plot]').forEach(field => { field.checked = false; });
    container.querySelector('[data-plot]')!.dispatchEvent(new Event('change', { bubbles: true }));
    expect(container.querySelector('.sp-output-plot')!.textContent).toContain('Select at least one complete case');
    expect(container.querySelectorAll('.sp-metrics tbody tr')).toHaveLength(6);
  });
  it('validates interval cursor separately and updates details on case selection', () => {
    const { container, numeric, build, reveal } = visit(); build(); reveal(); numeric('cursor', '1.5');
    expect(container.querySelector('.sp-detail')!.textContent).toContain('Choose an integer interval');
    const select = container.querySelector<HTMLSelectElement>('[data-choice="case"]')!; select.value = '1'; select.dispatchEvent(new Event('change', { bubbles: true }));
    expect(container.querySelector('.sp-detail')!.textContent).toContain('redesigned gain');
    expect(container.querySelector<HTMLInputElement>('[data-number="cursor"]')!.value).toBe('0');
  });
  it('isolates aborted controls and fresh mounts', () => {
    const old = visit(); old.numeric('gain', '7'); old.controller.abort(); old.build();
    expect((old.container.querySelector('.sp-attempt') as HTMLElement).hidden).toBe(true);
    const fresh = visit(); expect(fresh.container.querySelector<HTMLInputElement>('[data-number="gain"]')!.value).toBe('2');
    expect((fresh.container.querySelector('.sp-results') as HTMLElement).hidden).toBe(true);
  });
});
