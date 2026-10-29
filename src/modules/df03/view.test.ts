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
afterEach(() => { visits.splice(0).forEach(fn => fn()); document.body.replaceChildren(); });
function visit() {
  const container = document.createElement('div'); container.dataset.module = 'DF03'; document.body.append(container);
  const controller = new AbortController(), cleanup = mount({ container, signal: controller.signal }); visits.push(() => { controller.abort(); if (typeof cleanup === 'function') cleanup(); });
  const action = (name: string) => container.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!.click();
  const select = (name: string, value: string) => { const input = container.querySelector<HTMLSelectElement>(`[data-choice="${name}"]`)!; input.value = value; input.dispatchEvent(new Event('change', { bubbles: true })); };
  const numeric = (name: string, value: string) => { const input = container.querySelector<HTMLInputElement>(`[data-number="${name}"]`)!; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const edit = (value: string) => { const input = container.querySelector('textarea')!; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const predict = (stability = 'inside', crossings = '1') => { select('stability', stability); select('crossings', crossings); select('identity', 'no'); action('reveal'); };
  const hidden = () => (container.querySelector('.fq-results') as HTMLElement).hidden;
  const text = (selector: string) => container.querySelector(selector)!.textContent!;
  return { container, controller, action, select, numeric, edit, predict, hidden, text, cleanup };
}
describe('DF03 interaction wiring (mocked equation presentation, not browser evidence)', () => {
  it('requires three predictions then reveals the actual poles/crossings and sampled response', () => {
    const v = visit(); v.action('prepare'); expect(v.hidden()).toBe(true); v.action('reveal'); expect(v.text('.fq-message')).toContain('all three');
    v.predict(); expect(v.hidden()).toBe(false); expect(v.text('.fq-grade')).toContain('Correct full-pole'); expect(v.text('.fq-grade')).toContain('Correct crossing-set');
    expect(v.text('.fq-model')).toContain('0.3'); expect(v.text('.fq-response')).toContain('0.71428571'); expect(v.text('.fq-crossings')).toContain('3.6'); expect(v.container.querySelectorAll('svg')).toHaveLength(4);
  });
  it('clears stale results on changed inputs and checks Nyquist against the actual period', () => {
    const v = visit(); v.action('prepare'); v.predict(); v.numeric('period', '.5'); expect(v.hidden()).toBe(true); v.numeric('targetBandwidth', '10'); v.action('prepare'); v.predict();
    expect(v.text('.fq-targets')).toContain('at/above Nyquist'); expect(v.text('.fq-targets')).toContain('Ω=5');
  });
  it('handles wrong predictions without replacing the computed result', () => {
    const v = visit(); v.action('prepare'); v.select('stability', 'outside'); v.select('crossings', '0'); v.select('identity', 'yes'); v.action('reveal');
    expect(v.text('.fq-grade')).toContain('Revisit the full-pole'); expect(v.text('.fq-grade')).toContain('Revisit the gain crossing'); expect(v.text('.fq-grade')).toContain('not an exact identity');
  });
  it('shows every resonant crossing and preserves cancelled full modes', () => {
    const v = visit(); v.edit('.4z/(z^2-1.4z+.9)'); v.action('prepare'); v.predict('inside', '2');
    expect(v.text('.fq-grade')).toContain('Correct crossing-set'); expect(v.container.querySelector('[aria-label="All unit-gain crossings and signed phase margins"]')!.querySelectorAll('tbody tr')).toHaveLength(2);
    v.edit('.5(z-1)/(z(z-1))'); v.action('prepare'); v.predict('boundary', '0'); expect(v.text('.fq-model')).toContain('boundary'); expect(v.text('.fq-crossings')).toContain('indeterminate');
  });
  it('distinguishes constant-magnitude and negative-real continua from a finite margin list', () => {
    const v = visit(); v.edit('1/z'); v.action('prepare'); v.predict('boundary', 'continuum'); expect(v.text('.fq-crossings')).toContain('Unit-gain continuum');
    v.edit('z/(z^2+1)'); v.action('prepare'); v.predict('boundary', '2'); expect(v.text('.fq-crossings')).toContain('continuum of negative-real'); expect(v.text('.fq-crossings')).toContain('(1.5707963, 3.1415927]');
  });
  it('keeps exact cursor axes, handles Nyquist infinity and removes invalid cursor plots', () => {
    const v = visit(); v.action('prepare'); v.predict(); v.numeric('cursor', String(Math.PI)); v.select('axis', 'warped');
    expect(v.text('.fq-cursor-readout')).toContain('∞'); expect(v.text('.fq-cursor-readout')).toContain('beyond the finite warped plot');
    v.numeric('cursor', '3.2'); expect(v.text('.fq-cursor-readout')).toContain('between'); expect(v.container.querySelector('.fq-poles svg')).toBeNull();
    v.numeric('cursor', '.5'); expect(v.container.querySelector('.fq-poles svg')).not.toBeNull();
  });
  it('provides integer sample inspection without stale data or invented prehistory', () => {
    const v = visit(); v.action('prepare'); v.predict(); v.numeric('sample', '2'); expect(v.text('.fq-sample-readout')).toContain('0.65');
    v.numeric('sample', '1.5'); expect(v.text('.fq-sample-readout')).toContain('integer'); expect(v.container.querySelector('.fq-sample-readout table')).toBeNull();
    v.numeric('sample', '2001'); expect(v.text('.fq-sample-readout')).toContain('between');
  });
  it('keeps full poles/frequency reasoning when response growth is unavailable', () => {
    const v = visit(); v.edit('100/z'); v.action('prepare'); v.predict('outside', '0'); expect(v.text('.fq-response')).toContain('no partial response');
    expect(v.container.querySelector<HTMLInputElement>('[data-number="sample"]')!.disabled).toBe(true); expect(v.text('.fq-model')).toContain('-100');
    v.edit('.5/(z-.8)'); v.action('prepare'); v.predict(); expect(v.container.querySelector<HTMLInputElement>('[data-number="sample"]')!.disabled).toBe(false);
  });
  it('rejects numeric underflow while preserving genuine zero/native exponents', () => {
    const v = visit(); v.action('prepare'); v.predict(); v.numeric('targetBandwidth', '1e-999'); v.action('prepare'); expect(v.hidden()).toBe(true); expect(v.text('.fq-message')).toContain('too small');
    v.numeric('targetBandwidth', '0e-999'); v.action('prepare'); v.predict(); expect(v.hidden()).toBe(false);
    v.numeric('period', '1e-2'); v.action('prepare'); v.predict(); expect(v.text('.fq-targets')).toContain('Sampling frequency=100Hz');
    v.numeric('samples', '10.5'); v.action('prepare'); expect(v.text('.fq-message')).toContain('integer');
  });
  it('builds actual PI loops through the visual parser and reports their provenance', () => {
    const v = visit(); v.action('emulate'); v.predict('inside', '1'); const first = v.text('.fq-model'); expect(first).toContain('Actual emulation'); expect(first).toContain('backward'); expect(first).toContain('ZOH a');
    v.select('method', 'trapezoidal'); v.action('emulate'); v.predict('inside', '1'); expect(v.text('.fq-model')).toContain('trapezoidal'); expect(v.text('.fq-model')).not.toEqual(first);
    v.numeric('tau', '.01'); v.numeric('period', '1'); v.action('emulate'); expect(v.text('.fq-message')).toContain('T/tau'); expect(v.hidden()).toBe(true);
  });
  it('shows bounded visual parser errors and returns a fresh baseline after disposal', () => {
    const v = visit(); v.edit(String.raw`\frac{2\frac12}{z-.5}`); v.action('prepare'); expect(v.text('.fq-message')).toContain('explicit + or ×');
    v.edit('1e-2/(z-.5)'); v.action('prepare'); expect(v.text('.fq-message')).toContain('e/E');
    v.controller.abort(); if (typeof v.cleanup === 'function') { v.cleanup(); v.cleanup(); } expect(v.container.querySelector('.fq-tool')).toBeNull();
    const fresh = visit(); fresh.action('prepare'); fresh.predict(); expect(fresh.text('.fq-model')).toContain('0.3');
  });
});
