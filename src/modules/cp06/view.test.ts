import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mountView } from './view';
const state = vi.hoisted(() => ({ count: 0, failAt: 0, releases: 0 }));
// Flow/lifecycle wiring only. Real MathLive editing, fonts and plot geometry require browser checks.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const output = document.createElement('div'); output.setAttribute('aria-label', label); output.dataset.latex = latex; output.textContent = latex; return output; },
  createEquationInput: (options: EquationInputOptions) => {
    state.count++; if (state.failAt && state.count === state.failAt) throw new Error('Synthetic partial editor failure');
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: field.value.includes('\\placeholder'), syntaxIssues: field.value === 'bad-notation' ? ['synthetic-notation'] : [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal }); let destroyed = false;
    const destroy = () => { if (destroyed) return; destroyed = true; state.releases++; element.remove(); };
    options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy };
  },
}));
const visits: { controller: AbortController; cleanup: () => void; root: HTMLElement }[] = [];
function visit() { const root = document.createElement('div'); root.dataset.module = 'CP06'; document.body.append(root); const controller = new AbortController(), cleanup = mountView({ container: root, signal: controller.signal }) || (() => {}); const result = { root, controller, cleanup }; visits.push(result); return result; }
function control<T extends HTMLElement>(root: HTMLElement, label: string): T { const result = root.querySelector(`[aria-label="${label}"]`); expect(result).not.toBeNull(); return result as T; }
function press(root: HTMLElement, title: string): void { const button = [...root.querySelectorAll('button')].find(item => item.textContent === title); expect(button).toBeDefined(); button!.click(); }
function setNumber(root: HTMLElement, title: string, value: string, invalidate = false): void { const input = control<HTMLInputElement>(root, title); input.value = value; if (invalidate) input.dispatchEvent(new Event('input')); }
function choose(root: HTMLElement, title: string, value: string): void { const input = control<HTMLSelectElement>(root, title); input.value = value; input.dispatchEvent(new Event('change')); }
function construct(root: HTMLElement): void { press(root, 'Construct and check'); }
afterEach(() => { for (const v of visits.splice(0)) { v.controller.abort(); v.cleanup(); v.root.remove(); } state.count = state.failAt = state.releases = 0; });

describe('CP06 teaching flow and mount isolation', () => {
  it('starts with editable baseline inputs and reveals no computed result until requested', () => {
    const { root } = visit(); expect(root.querySelectorAll('textarea')).toHaveLength(2); expect(root.querySelector('svg')).toBeNull(); construct(root);
    expect(control(root, 'Complete selected characteristic polynomial').getAttribute('data-latex')).toContain('s^{3}+7s^{2}+10s+70');
    expect(root.querySelectorAll('.cp-plane-region > svg')).toHaveLength(1); expect(root.textContent).toContain('3.162278');
  });
  it.each([['0', 's^{3}+7s^{2}+10s+70'], ['1', 's^{3}+7s^{2}+30s+20'], ['2', 's^{3}+5s^{2}+11s+25'], ['3', 's^{3}+3s^{2}+3s+9'], ['4', 's^{2}+4s-5'], ['5', String.raw`s^{3}+2s^{2}+\frac{27}{20}s+\frac{27}{10}`], ['6', 's^{2}+2']])('computes changed preset %s independently from its input', (preset, expected) => {
    const { root } = visit(); choose(root, 'Exercise preset', preset); construct(root); expect(control(root, 'Complete selected characteristic polynomial').getAttribute('data-latex')).toContain(expected);
  });
  it('maps the optional predictions to actual construction and point checks', () => {
    const { root } = visit(); choose(root, 'Predicted branches to infinity', '3'); choose(root, 'Predicted candidate membership', 'yes'); construct(root);
    expect(root.textContent).toContain('Infinity-branch prediction correct'); expect(root.textContent).toContain('Candidate prediction correct');
    choose(root, 'Predicted branches to infinity', '1'); setNumber(root, 'Candidate real part (s⁻¹)', '1'); setNumber(root, 'Candidate imaginary part (rad/s)', '1'); press(root, 'Test candidate'); expect(root.textContent).toContain('Infinity-branch prediction differs'); expect(root.textContent).toContain('Candidate prediction differs');
  });
  it('keeps angle, gain and branch-rule reveals independent', () => {
    const { root } = visit(); construct(root); const details = [...root.querySelectorAll('details')]; expect(details.every(item => !item.open)).toBe(true);
    const open = (title: string) => { const item = details.find(d => d.querySelector('summary')?.textContent === title)!; item.open = true; item.dispatchEvent(new Event('toggle')); };
    open('Real-axis segments'); expect(root.querySelectorAll('.cp-real-segment').length).toBeGreaterThan(0); expect(root.querySelectorAll('.cp-asymptote')).toHaveLength(0);
    open('Asymptotes and centroid'); expect(root.querySelectorAll('.cp-asymptote')).toHaveLength(3);
    expect(details.find(d => d.querySelector('summary')?.textContent === 'Reveal candidate gain and full check')?.open).toBe(false);
  });
  it('updates a valid candidate while retaining the existing trace and disclosures', () => {
    const { root } = visit(); construct(root); const previousPaths = [...root.querySelectorAll('.cp-branch')].map(p => p.getAttribute('d'));
    setNumber(root, 'Candidate real part (s⁻¹)', '-1'); setNumber(root, 'Candidate imaginary part (rad/s)', '0'); press(root, 'Test candidate');
    expect(control(root, 'Candidate point').getAttribute('data-latex')).toContain('-1+0'); expect([...root.querySelectorAll('.cp-branch')].map(p => p.getAttribute('d'))).toEqual(previousPaths);
  });
  it.each(['1e-999', '', '101'])('retains the last valid candidate after invalid numeric point %s', value => {
    const { root } = visit(); construct(root); const previous = control(root, 'Candidate point').getAttribute('data-latex'); setNumber(root, 'Candidate real part (s⁻¹)', value); press(root, 'Test candidate');
    expect(root.querySelector('[role="status"]')?.textContent).toContain('last valid candidate'); expect(control(root, 'Candidate point').getAttribute('data-latex')).toBe(previous); expect(root.querySelector('svg')).not.toBeNull();
  });
  it.each(['1e-999', '', '-1', '1001'])('rejects invalid selected gain %s and removes stale results', value => {
    const { root } = visit(); construct(root); setNumber(root, 'Selected gain K or Kp', value); construct(root); expect(root.querySelector('svg')).toBeNull(); expect(root.querySelector('[role="status"]')?.textContent).not.toContain('Construction computed');
  });
  it('preserves intentional zero and native exponent syntax', () => {
    const { root } = visit(); setNumber(root, 'Selected gain K or Kp', '0e-999'); construct(root); expect(control(root, 'Complete selected characteristic polynomial').getAttribute('data-latex')).toBe('Q(s,0)=s^{3}+7s^{2}+10s');
    setNumber(root, 'Selected gain K or Kp', '1e-2'); construct(root); expect(control(root, 'Complete selected characteristic polynomial').getAttribute('data-latex')).toContain(String.raw`\frac{1}{100}`);
  });
  it('rejects a selected gain beyond its trace bound', () => { const { root } = visit(); setNumber(root, 'Trace maximum gain', '10'); construct(root); expect(root.textContent).toContain('within the trace range'); expect(root.querySelector('svg')).toBeNull(); });
  it('handles malformed drafts and model edits without stale output', () => {
    const { root } = visit(); construct(root); const field = control<HTMLTextAreaElement>(root, 'Numerator polynomial N(s)'); field.value = String.raw`2\frac12`; field.dispatchEvent(new Event('input')); expect(root.querySelector('svg')).toBeNull(); construct(root); expect(root.querySelector('[role="status"]')?.textContent).toContain('adjacency');
    for (const text of ['', String.raw`\placeholder{}`, 'bad-notation']) { field.value = text; construct(root); expect(root.querySelector('svg')).toBeNull(); }
  });
  it('shows complete retained fixed modes and the full-Q roots', () => {
    const { root } = visit(); choose(root, 'Exercise preset', '4'); construct(root); expect(root.textContent).toContain('retained fixed modes'); expect(root.textContent).toContain('Right half-plane'); expect(root.querySelectorAll('.cp-fixed')).toHaveLength(1); expect(root.querySelectorAll('.cp-selected')).toHaveLength(2);
  });
  it('clears changed state on local baseline restore and a new visit', () => {
    const { root, cleanup } = visit(); choose(root, 'Exercise preset', '5'); construct(root); press(root, 'Restore baseline'); expect(root.querySelector('svg')).toBeNull(); expect(control<HTMLSelectElement>(root, 'Varying parameter').value).toBe('gain'); expect(control<HTMLInputElement>(root, 'Selected gain K or Kp').value).toBe('70');
    cleanup(); cleanup(); expect(root.children).toHaveLength(0); const next = visit(); expect(next.root.querySelector('svg')).toBeNull(); expect(control<HTMLInputElement>(next.root, 'Selected gain K or Kp').value).toBe('70');
  });
  it('releases the first editor after a partial second-editor failure', () => {
    state.failAt = 2; const container = document.createElement('div'); expect(() => mountView({ container, signal: new AbortController().signal })).toThrow('Synthetic'); expect(state.releases).toBe(1); expect(container.children).toHaveLength(0);
  });
});
