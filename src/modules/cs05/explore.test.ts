import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { locus, solveRegions } from './gains';
import { mountView } from './view';
vi.mock('./gains', async original => { const actual = await original<typeof import('./gains')>(); return { ...actual, solveRegions: vi.fn(actual.solveRegions), locus: vi.fn(actual.locus) }; });
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const n = document.createElement('div'); n.textContent = value; n.setAttribute('aria-label', label); return n; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: field.value.includes('placeholder'), syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, destroy, focus: () => field.focus() };
  },
}));
const visits: { root: HTMLElement; controller: AbortController; cleanup: () => void }[] = [];
function open() { const root = document.createElement('div'); root.dataset.module = 'CS05'; document.body.append(root); const controller = new AbortController(), cleanup = mountView({ container: root, signal: controller.signal }) || (() => {}); const v = { root, controller, cleanup }; visits.push(v); return v; }
function field<T extends HTMLElement = HTMLInputElement>(root: HTMLElement, label: string): T { return root.querySelector<T>(`[aria-label="${label}"]`)!; }
function press(root: HTMLElement, label: string) { const b = [...root.querySelectorAll('button')].find(n => n.textContent === label); expect(b).toBeDefined(); b!.click(); }
function input(root: HTMLElement, label: string, value: string) { const n = field<HTMLInputElement>(root, label); n.value = value; n.dispatchEvent(new Event('input', { bubbles: true })); }
const gainText = (root: HTMLElement) => field(root, 'Selected exact gain').textContent;
afterEach(() => { for (const v of visits.splice(0)) { v.controller.abort(); v.cleanup(); v.root.remove(); } vi.clearAllMocks(); vi.unstubAllGlobals(); });

describe('CS05 immediate exact-gain exploration', () => {
  it('opens with the exact baseline interval, both diagrams and every selected root', () => {
    const { root } = open(); expect(root.querySelectorAll('.cs05-responsive-plane > svg, .cs05-interactive-strip > svg')).toHaveLength(2); expect(field(root, 'Complete exact stable gain set').textContent).toBe('K\\in(0,70)'); expect(root.querySelectorAll('.cs05-inspector li')).toHaveLength(3); expect(gainText(root)).toBe('K=20');
    expect(root.textContent).toContain('Strictly stable · every exact inequality is positive');
  });
  it('reuses the exact region and finite trace while gain changes, keeping axes fixed', () => {
    const { root } = open(), solves = vi.mocked(solveRegions).mock.calls.length, traces = vi.mocked(locus).mock.calls.length;
    const paths = [...root.querySelectorAll('.cs05-responsive-plane .cs05-branch')].map(n => n.getAttribute('d')), ticks = [...root.querySelectorAll('.cs05-responsive-plane text')].map(n => n.textContent);
    input(root, 'Numeric gain K', '80'); expect(root.textContent).toContain('Not strictly stable ·'); expect(root.querySelectorAll('.cs05-inspector li')).toHaveLength(3);
    input(root, 'Numeric gain K', '10000'); expect(root.textContent).toContain('Some selected roots are outside this view');
    expect(vi.mocked(solveRegions).mock.calls).toHaveLength(solves); expect(vi.mocked(locus).mock.calls).toHaveLength(traces); expect([...root.querySelectorAll('.cs05-responsive-plane .cs05-branch')].map(n => n.getAttribute('d'))).toEqual(paths); expect([...root.querySelectorAll('.cs05-responsive-plane text')].map(n => n.textContent)).toEqual(ticks);
  });
  it('selects the exact crossing and keeps all three baseline roots', () => {
    const { root } = open(); press(root, 'Select endpoint 2'); expect(gainText(root)).toBe('K=70'); expect(root.textContent).toContain('Not strictly stable ·'); expect(root.textContent).toContain('Exact endpoint identity retained'); expect(root.textContent).toContain('3.162278'); expect(root.textContent).toContain('-7');
  });
  it('preserves exact surd identity across a view-only range change and an unchanged rational-gain action', () => {
    const { root } = open(); press(root, 'Irrational boundaries'); press(root, 'Select endpoint 3'); const endpoint = gainText(root), solves = vi.mocked(solveRegions).mock.calls.length;
    expect(endpoint).toContain('sqrt'); expect(root.textContent).toContain('Not strictly stable ·'); input(root, 'Locus maximum gain', '5'); press(root, 'Apply view range'); expect(gainText(root)).toBe(endpoint); expect(vi.mocked(solveRegions).mock.calls).toHaveLength(solves);
    press(root, 'Apply rational gain'); expect(gainText(root)).toBe(endpoint); input(root, 'Numeric gain K', '.5'); expect(gainText(root)).toBe('K=\\frac{1}{2}'); expect(root.textContent).not.toContain('Exact endpoint identity retained'); expect(root.textContent).toContain('Strictly stable ·');
  });
  it('retains multiple/unbounded ranges, negative numerator and zero numerator support', () => {
    const { root } = open(); press(root, 'Two stable ranges'); expect(field(root, 'Complete exact stable gain set').textContent).toContain('(\\frac{1}{3},1)\\cup(3,\\infty)');
    press(root, 'Stable from zero'); input(root, 'Numeric gain K', '0'); expect(field(root, 'Complete exact stable gain set').textContent).toBe('K\\in[0,2)'); expect(root.textContent).toContain('Strictly stable ·'); input(root, 'Numeric gain K', '3'); expect(root.textContent).toContain('Not strictly stable ·');
    input(root, 'Fixed numerator N(s)', '0'); input(root, 'Fixed denominator D(s)', 's+1'); press(root, 'Apply model'); expect(field(root, 'Complete exact stable gain set').textContent).toBe('K\\in[0,\\infty)'); expect(root.querySelectorAll('.cs05-inspector li')).toHaveLength(1);
  });
  it('rejects nonzero numeric underflow and invalid models with an honest last-checked visual', () => {
    const { root } = open(), before = gainText(root); input(root, 'Numeric gain K', '1e-999'); expect(gainText(root)).toBe(before); expect(root.textContent).toContain('last checked result is retained');
    input(root, 'Fixed numerator N(s)', 's^3'); press(root, 'Apply model'); expect(root.textContent).toContain('last checked model'); expect(field(root, 'Complete exact stable gain set').textContent).toBe('K\\in(0,70)'); expect(field<HTMLInputElement>(root, 'Numeric gain K').disabled).toBe(true);
    press(root, 'Discard model draft'); expect(field<HTMLInputElement>(root, 'Numeric gain K').disabled).toBe(false); input(root, 'Numeric gain K', '0e-999'); expect(gainText(root)).toBe('K=0');
  });
  it('keeps fine range cursors nonzero and separates range validation from the cached region', () => {
    const { root } = open(), solves = vi.mocked(solveRegions).mock.calls.length; input(root, 'Locus maximum gain', '1e-999'); press(root, 'Apply view range'); expect(root.textContent).toContain('nonzero but too small');
    input(root, 'Locus maximum gain', '.00123456789123'); press(root, 'Apply view range'); input(root, 'Live gain cursor', '.00000123456789123'); expect(gainText(root)).not.toBe('K=0'); expect(root.textContent).toContain('Strictly stable ·'); expect(vi.mocked(solveRegions).mock.calls).toHaveLength(solves);
  });
  it('gives Practice a fresh hidden-answer attempt while preserving the Explore model', () => {
    const { root } = open(); press(root, 'Changed cubic'); press(root, 'Practice'); const practice = root.querySelector<HTMLElement>('[data-learning-mode="practice"]')!;
    expect(practice.querySelector('svg')).toBeNull(); expect(practice.querySelector<HTMLElement>('.cs05-output')!.hidden).toBe(true); press(practice, 'Derive intervals and reveal'); expect(practice.textContent).toContain('K\\in(0,70)');
    press(root, 'Explore'); const explore = root.querySelector<HTMLElement>('[data-learning-mode="explore"]')!; expect(field(explore, 'Complete exact stable gain set').textContent).toBe('K\\in(0,48)');
  });
});
