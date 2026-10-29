import { afterEach, describe, expect, it, vi } from 'vitest';
// Public equation API stub. Actual MathLive browser checks remain separate.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const e = document.createElement('div'); e.textContent = latex; e.setAttribute('aria-label', label); return e; },
  createEquationInput: (options: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    const element = document.createElement('div'), input = document.createElement('input');
    input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    input.addEventListener('input', options.onChange, { signal: options.signal });
    return { element, getValue: () => ({ latex: input.value, empty: !input.value, syntaxIssues: [], hasPlaceholders: false }),
      setValue: (value: string) => { input.value = value; }, destroy: () => element.remove() };
  },
}));
import { mount } from './view';
const visits: { controller: AbortController; cleanup: ReturnType<typeof mount> }[] = [];
function open(): HTMLElement {
  const root = document.createElement('div'); root.dataset.module = 'CR06'; document.body.append(root);
  const controller = new AbortController(); visits.push({ controller, cleanup: mount({ container: root, signal: controller.signal }) }); return root;
}
afterEach(() => { visits.splice(0).forEach(v => { v.controller.abort(); if (typeof v.cleanup === 'function') v.cleanup(); }); document.body.replaceChildren(); });
function click(root: HTMLElement, text: string): void { const b = [...root.querySelectorAll('button')].find(b => b.textContent === text); expect(b).toBeDefined(); b!.click(); }
function control(root: HTMLElement, label: string): HTMLInputElement | HTMLSelectElement {
  const l = [...root.querySelectorAll('label')].find(l => l.firstChild?.textContent === label); expect(l).toBeDefined(); return l!.querySelector('input,select')!;
}
function change(input: HTMLInputElement | HTMLSelectElement, value: string): void { input.value = value; input.dispatchEvent(new Event('input')); }
const rows = (root: HTMLElement): string[][] => [...root.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(e => e.textContent!));
const results = (root: HTMLElement): HTMLElement => [...root.querySelectorAll('section')].find(s => s.querySelector('h3')?.textContent?.startsWith('4.'))!;

describe('CR06 teaching flow with equation API stub', () => {
  it('builds the input-dependent diagram and reveals independently expected state/output values', () => {
    const root = open(); click(root, 'Build integrator diagram');
    expect(root.querySelectorAll('svg [role="button"]')).toHaveLength(2);
    expect(root.querySelector('[aria-label="Selected integrator derivative"]')!.textContent).toContain('(1)x_{2}');
    click(root, 'Select state x2'); change(control(root, 'Prediction for selected derivative at t=0 (optional)'), '1'); click(root, 'Reveal state response');
    expect(root.textContent).toContain('Prediction matched');
    const p = rows(root)[20]; expect(p[0]).toBe('1'); expect(Number(p[8])).toBeCloseTo(.5 - Math.exp(-1) + .5 * Math.exp(-2), 7);
    expect(Number(p[9])).toBeCloseTo(.5 + Math.exp(-1) - .5 * Math.exp(-2), 7);
  });
  it('selects integrators with keyboard and keeps checked prediction tied to its original state', () => {
    const root = open(); click(root, 'Reveal state response');
    const target = root.querySelector('svg [aria-label="Select integrator 2, output state x2"]')!;
    target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(target.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('[aria-label="Selected integrator derivative"]')!.textContent).toContain('(-3)x_{2}');
    expect(root.querySelector('svg[role="img"]')!.getAttribute('aria-label')).toContain('State x2');
    expect(root.textContent).toContain('Derivative checked for x1');
  });
  it('compares initial states while retaining identical forced values', () => {
    const root = open(); click(root, 'Reveal state response'); const forced = rows(root).map(r => r[3]);
    change(control(root, 'Initial A: x₁(0)'), '2'); expect(results(root).hidden).toBe(true); click(root, 'Reveal state response');
    expect(rows(root).map(r => r[3])).toEqual(forced); expect(rows(root)[0][4]).toBe('2, 0');
  });
  it('shows hidden unstable state and reduced transfer channel together', () => {
    const root = open(); click(root, 'Hidden unstable state'); click(root, 'Reveal state response');
    expect(root.textContent).toContain('1 dynamic factor(s) cancel');
    expect(root.querySelector('[aria-label="All original state modes"]')!.textContent).toContain('1');
    const p = rows(root)[20]; expect(Number(p[5].split(',')[0])).toBeCloseTo(Math.E, 6); expect(p[8]).toBe(p[9]);
  });
  it('supports scalar dimensions, native exponent helper and feedthrough', () => {
    const root = open(), dimension = control(root, 'State dimension n');
    dimension.value = '1'; dimension.dispatchEvent(new Event('change'));
    change(control(root, 'D entry 1,1'), '2'); change(control(root, 'B entry 1,1'), '1e-2');
    click(root, 'Apply numeric entries to equations'); click(root, 'Reveal state response');
    expect(root.querySelectorAll('svg [role="button"]')).toHaveLength(1);
    expect(rows(root)[0][8]).toBe('2');
    expect(Number(rows(root)[20][8])).toBeCloseTo(2 + .01 * (1 - Math.exp(-1)), 6);
  });
  it('rejects raw native underflow and invalid dimensions without stale results', () => {
    const root = open(); click(root, 'Reveal state response');
    change(control(root, 'Constant input U for t ≥ 0'), '1e-999'); click(root, 'Reveal state response');
    expect(root.textContent).toContain('too small to represent'); expect(results(root).hidden).toBe(true);
    change(control(root, 'Constant input U for t ≥ 0'), '0e-999'); click(root, 'Reveal state response'); expect(rows(root)[20][8]).toBe('0');
    const field = root.querySelector<HTMLInputElement>('[aria-label="Input column B"]')!;
    change(field, '\\begin{bmatrix}1&2\\end{bmatrix}'); click(root, 'Reveal state response');
    expect(root.textContent).toContain('2 rows and 1 columns'); expect(results(root).hidden).toBe(true);
  });
  it('handles singular A, insufficient numerical work and inspection bounds', () => {
    const root = open(); click(root, 'Two integrators'); click(root, 'Reveal state response'); expect(rows(root)[20][8]).toBe('0.5');
    change(control(root, 'Inspect drawing point k'), '999'); expect(root.textContent).toContain('Choose a drawing point from 0');
    change(control(root, 'Drawing points'), '20'); click(root, 'Reveal state response'); expect(root.textContent).toContain('21 to 401');
  });
  it('cleans owned controls and reopens with fresh mechanical baseline', () => {
    const root = open(); click(root, 'Hidden unstable state');
    const v = visits.pop()!; v.controller.abort(); if (typeof v.cleanup === 'function') v.cleanup(); expect(root.childElementCount).toBe(0);
    const next = open(); click(next, 'Reveal state response'); expect(next.textContent).not.toContain('1 dynamic factor(s) cancel'); expect(rows(next)[0][4]).toBe('0, 0');
  });
});
