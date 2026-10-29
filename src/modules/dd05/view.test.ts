import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateLatex } from 'mathlive/ssr';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
import { mount } from './view';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const e = document.createElement('div'); e.textContent = latex; e.dataset.resultLatex = latex; e.setAttribute('aria-label', label); return e; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; element.append(field);
    const getValue = (): EquationDraft => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: false, syntaxIssues: [] }); field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy: () => element.remove() };
  },
}));
const visits: (() => void)[] = [];
afterEach(() => { visits.splice(0).forEach(fn => fn()); document.body.replaceChildren(); });
function visit() {
  const container = document.createElement('div'); container.dataset.module = 'DD05'; document.body.append(container); const controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
  visits.push(() => { controller.abort(); if (typeof cleanup === 'function') cleanup(); });
  const action = (name: string) => container.querySelector<HTMLButtonElement>(`[data-action="${name}"]`)!.click();
  const preset = (name: string) => container.querySelector<HTMLButtonElement>(`[data-preset="${name}"]`)!.click();
  const select = (name: string, value: string) => { const f = container.querySelector<HTMLSelectElement>(`[data-choice="${name}"]`)!; f.value = value; f.dispatchEvent(new Event('change', { bubbles: true })); };
  const numeric = (name: string, value: string) => { const f = container.querySelector<HTMLInputElement>(`[data-number="${name}"]`)!; f.value = value; f.dispatchEvent(new Event('input', { bubbles: true })); };
  const edit = (value: string) => { const f = container.querySelector('textarea')!; f.value = value; f.dispatchEvent(new Event('input', { bubbles: true })); };
  const predict = (stability = 'inside', error = 'comparator') => { select('stability', stability); select('error', error); select('pair', 'no'); action('check'); };
  const hidden = () => (container.querySelector('.ap-results') as HTMLElement).hidden;
  const text = (selector: string) => container.querySelector(selector)!.textContent!;
  return { container, controller, cleanup, action, preset, select, numeric, edit, predict, hidden, text };
}
describe('DD05 teaching flow (mocked equation presentation, not browser evidence)', () => {
  it('produces valid result notation for both complete controller structures', () => {
    for (const preset of ['source', 'pid']) {
      const v = visit(); v.preset(preset); v.action('prepare'); v.predict(); v.action('solve');
      for (const node of v.container.querySelectorAll<HTMLElement>('[data-result-latex]')) expect(validateLatex(node.dataset.resultLatex!), node.getAttribute('aria-label') ?? '').toEqual([]);
    }
  });
  it('requires predictions, checks the actual candidate then solves every PI coefficient', () => {
    const v = visit(); v.action('prepare'); expect(v.hidden()).toBe(true); v.action('check'); expect(v.text('.ap-message')).toContain('all three'); v.predict();
    expect(v.text('.ap-grade')).toContain('Correct full-pole'); expect(v.text('.ap-candidate-check')).toContain('coefficient residual'); expect(v.text('.ap-solution')).toBe('');
    v.action('solve'); expect(v.text('.ap-solution')).toContain('8.9947334'); expect(v.text('.ap-solution')).toContain('6.1567097'); expect(v.text('.ap-solution')).toContain('Full match');
    expect(v.text('.ap-derivation')).toContain('no derivative-delay state'); expect(v.text('.ap-derivation')).not.toContain('zero derivative-delay mode');
    expect(v.container.querySelector('[aria-label="Matched solution full closed-loop poles"]')!.querySelectorAll('tbody tr')).toHaveLength(2); expect(v.container.querySelectorAll('svg')).toHaveLength(3);
    expect(v.text('.ap-performance')).toContain('93.12564'); expect(v.text('.ap-performance')).toContain('-19');
  });
  it('solves the exact PI fixture and inspects independently known controller memory', () => {
    const v = visit(); v.preset('pi'); v.action('prepare'); v.predict(); v.action('solve'); v.numeric('sample', '1');
    expect(v.text('.ap-solution')).toContain('1.48'); expect(v.text('.ap-solution')).toContain('4.4'); expect(v.text('.ap-inspection')).toContain('2.2'); expect(v.text('.ap-inspection')).toContain('2.48');
    expect(v.text('.ap-performance')).toContain('rise is not complete'); expect(v.text('.ap-performance')).toContain('horizon is insufficient');
    v.numeric('sample', '40'); expect(v.text('.ap-inspection')).toContain('no additional controller update'); expect(v.text('.ap-inspection')).toContain('Terminal');
  });
  it('retains the additional full PID mode and actual changed peak', () => {
    const v = visit(); v.preset('pid'); v.action('prepare'); v.predict(); v.action('solve');
    expect(v.text('.ap-solution')).toContain('1.592'); expect(v.text('.ap-solution')).toContain('0.104');
    expect(v.text('.ap-derivation')).toContain('zero derivative-delay mode');
    const roots = v.container.querySelector('[aria-label="Matched solution full closed-loop poles"]')!; expect(roots.querySelectorAll('tbody tr')).toHaveLength(3); expect(roots.textContent).toContain('-0.2');
    expect(v.text('.ap-performance')).toContain('30');
  });
  it('explains incompatible physical tracking then recovers with calibrated F=H', () => {
    const v = visit(); v.preset('pi'); v.select('tracking', 'physical'); v.action('prepare'); v.predict(); v.action('solve');
    expect(v.text('.ap-solution')).toContain('incompatible'); expect(v.text('.ap-performance')).toContain('-1');
    v.select('preweight', 'calibrated'); expect(v.hidden()).toBe(true); v.action('prepare'); v.predict('inside', 'both'); v.action('solve');
    expect(v.text('.ap-solution')).toContain('Full match'); expect(v.text('.ap-solution')).not.toContain('not satisfied'); expect(v.text('.ap-grade')).toContain('Correct error-convention');
  });
  it('distinguishes signed-gain constraints from causal coefficient solvability', () => {
    const v = visit(); v.preset('pid'); v.numeric('extra', '.2'); v.action('prepare'); v.predict(); v.action('solve'); expect(v.text('.ap-solution')).toContain('negative PID gain');
    v.select('gainConstraint', 'signed'); v.action('prepare'); v.predict(); v.action('solve'); expect(v.text('.ap-solution')).toContain('Full match');
  });
  it('does not validate unused derivative/extra/continuous controls in a direct-pair PI exercise', () => {
    const v = visit(); v.preset('pi'); v.numeric('kd', '1e-999'); v.numeric('extra', ''); v.numeric('zeta', ''); v.numeric('wn', ''); v.action('prepare'); v.predict(); v.action('solve');
    expect(v.hidden()).toBe(false); expect(v.text('.ap-solution')).toContain('Full match'); expect(v.container.querySelector<HTMLInputElement>('[data-number="kd"]')!.disabled).toBe(true);
  });
  it('hides stale results for alias, work and nonzero-underflow inputs, preserving native exponents and zero', () => {
    const v = visit(); v.action('prepare'); v.predict(); v.numeric('kp', '1e-999'); v.action('prepare'); expect(v.hidden()).toBe(true); expect(v.text('.ap-message')).toContain('too small');
    v.numeric('kp', '0e-999'); v.numeric('ki', '1e-2'); v.action('prepare'); v.predict(); expect(v.hidden()).toBe(false);
    v.numeric('wn', '4'); v.numeric('zeta', '.1'); v.action('prepare'); expect(v.text('.ap-message')).toContain('Nyquist');
    v.preset('pi'); v.numeric('intervals', '10.5'); v.action('prepare'); expect(v.text('.ap-message')).toContain('integer'); v.numeric('intervals', '2001'); v.action('prepare'); expect(v.text('.ap-message')).toContain('between');
  });
  it('keeps gain-limit feedback separate from the still-inspectable candidate', () => {
    const v = visit(); v.numeric('period', '.001'); v.numeric('sensor', '.001'); v.edit('.05/(100s+1)'); v.action('prepare'); v.predict('boundary'); v.action('solve');
    expect(v.text('.ap-solution')).toContain('No bounded coefficient solution'); expect(v.container.querySelector('[aria-label="Candidate full closed-loop poles"]')).not.toBeNull();
  });
  it('does not show partial response/effort after growth, and recovers the sample inspector', () => {
    const v = visit(); v.numeric('kp', '1000'); v.numeric('ki', '1000'); v.action('prepare'); v.predict('outside'); expect(v.text('.ap-performance')).toContain('no partial');
    expect(v.container.querySelector<HTMLInputElement>('[data-number="sample"]')!.disabled).toBe(true); v.action('solve'); expect(v.container.querySelector<HTMLInputElement>('[data-number="sample"]')!.disabled).toBe(false);
    expect(v.text('.ap-performance')).toContain('Matched solution'); expect(v.text('.ap-performance')).toContain('93.12564');
  });
  it('removes invalid sample details, preserves zero-input qualification and rejects unsupported notation', () => {
    const v = visit(); v.preset('pi'); v.numeric('reference', '0'); v.select('tracking', 'physical'); v.action('prepare'); v.predict('inside', 'both'); v.action('solve'); expect(v.text('.ap-performance')).toContain('trivially zero');
    v.numeric('sample', '1.5'); expect(v.text('.ap-inspection')).toContain('integer'); expect(v.container.querySelector('.ap-inspection table')).toBeNull();
    v.edit(String.raw`\frac{2\frac12}{s+1}`); v.action('prepare'); expect(v.text('.ap-message')).toContain('explicit + or ×');
    v.edit('1e-2/(s+1)'); v.action('prepare'); expect(v.text('.ap-message')).toContain('e/E');
  });
  it('grades incorrect predictions against computed results and fresh whole-model editor sessions', () => {
    const v = visit(), first = v.container.querySelector('textarea')!; v.preset('pi'); expect(first.isConnected).toBe(false); v.action('prepare'); v.select('stability', 'outside'); v.select('error', 'physical'); v.select('pair', 'yes'); v.action('check');
    expect(v.text('.ap-grade')).toContain('Revisit candidate stability'); expect(v.text('.ap-grade')).toContain('Revisit the distinction'); expect(v.text('.ap-grade')).toContain('third PID mode');
    v.controller.abort(); if (typeof v.cleanup === 'function') { v.cleanup(); v.cleanup(); } expect(v.container.querySelector('.ap-tool')).toBeNull();
    const fresh = visit(); fresh.action('prepare'); fresh.predict(); fresh.action('solve'); expect(fresh.text('.ap-solution')).toContain('8.9947334');
  });
});
