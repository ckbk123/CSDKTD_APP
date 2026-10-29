import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const out = document.createElement('div'); out.textContent = latex; out.setAttribute('aria-label', label); return out; },
  createEquationInput: (options: { label: string; value: string; signal: AbortSignal; onChange: (draft: unknown) => void }) => {
    const element = document.createElement('div'), input = document.createElement('input');
    input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    const getValue = () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: /\\placeholder/.test(input.value), syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { input.value = value; }, destroy: () => element.remove() };
  },
}));
import { mount } from './view';
const visits: { controller: AbortController; cleanup: ReturnType<typeof mount> }[] = [];
function open(): HTMLElement {
  const container = document.createElement('div'), controller = new AbortController(); document.body.append(container);
  visits.push({ controller, cleanup: mount({ container, signal: controller.signal }) }); return container;
}
afterEach(() => { visits.splice(0).forEach(v => { v.controller.abort(); if (typeof v.cleanup === 'function') v.cleanup(); }); document.body.replaceChildren(); });
function click(root: HTMLElement, text: string): void {
  const button = [...root.querySelectorAll('button')].find(b => b.textContent === text); expect(button).toBeDefined(); button!.click();
}
function control(root: HTMLElement, label: string): HTMLInputElement | HTMLSelectElement {
  const input = root.querySelector<HTMLInputElement | HTMLSelectElement>('[aria-label="' + label + '"]'); expect(input).not.toBeNull(); return input!;
}
function change(input: HTMLInputElement | HTMLSelectElement, value: string): void { input.value = value; input.dispatchEvent(new Event('input')); }
const reveal = (root: HTMLElement): void => click(root, 'Reveal and check construction');
const rows = (root: HTMLElement): string[][] => [...root.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(td => td.textContent!));
const output = (root: HTMLElement): HTMLElement => root.querySelector('.dr03-results')!;
const plant = (root: HTMLElement): HTMLInputElement | HTMLSelectElement => control(root, 'Discrete transfer function G(z), before additional input delay');

describe('DR03 teaching flow using only a public equation API stub', () => {
  it('reveals the independently expected mechanical response and one scalar state per delay', () => {
    const root = open(); expect(output(root).hidden).toBe(true); reveal(root);
    expect(rows(root)).toHaveLength(21); expect(rows(root)[0][3]).toBe('0');
    expect(Number(rows(root)[10][3])).toBeCloseTo(.5 - Math.exp(-1) + .5 * Math.exp(-2), 7);
    expect(rows(root)[10].slice(3).every(v => v === rows(root)[10][3])).toBe(true);
    expect(root.querySelectorAll('.dr03-delay')).toHaveLength(4);
    expect(root.textContent).toContain('History register: n=2, m=0, 4 scalar');
  });
  it('selects each row/output and advances all memory cells together with a prediction', () => {
    const root = open(); change(plant(root), '(2z^2+3z+4)/(z^2-.5z+.125)');
    change(control(root, 'y[−1]'), '1'); change(control(root, 'y[−2]'), '-2');
    change(control(root, 'u[−1]'), '3'); change(control(root, 'u[−2]'), '-1');
    change(control(root, 'Predicted selected result'), '7.75'); click(root, 'Check prediction');
    expect(root.textContent).toContain('Prediction matches'); expect(rows(root)[0][3]).toBe('7.75');
    change(control(root, 'Equation to inspect'), '1');
    expect(root.querySelector('[aria-label="Selected row arithmetic"]')!.textContent).toContain('x_{2}[1]');
    expect(root.textContent).not.toContain('Prediction matches');
    change(control(root, 'Predicted selected result'), '1'); click(root, 'Check prediction'); expect(root.textContent).toContain('Prediction matches');
    click(root, 'Next simultaneous update'); expect(control(root, 'Inspect sample k').value).toBe('1');
    expect(root.querySelector('.dr03-current')!.getAttribute('data-sample')).toBe('1');
    expect(root.querySelector('[aria-label="Old state and current input"]')!.textContent).toContain('7.75');
    change(control(root, 'Equation to inspect'), 'y');
    expect(root.querySelector('[aria-label="Selected row arithmetic"]')!.textContent).toContain('y[1]');
  });
  it('updates shape and includes nonzero input prehistory for a changed delay', () => {
    const root = open(); change(plant(root), '(2z^2+3z+4)/(z^2-.5z+.125)');
    change(control(root, 'Additional input delay m (samples)'), '2');
    ['1', '-2', '3', '-1', '2', '-2'].forEach((value, i) => change(control(root, ['y[−1]', 'y[−2]', 'u[−1]', 'u[−2]', 'u[−3]', 'u[−4]'][i]), value));
    reveal(root);
    expect(rows(root).slice(0, 4).map(row => row[3])).toEqual(['-3.25', '9.25', '12.03125', '21.85938']);
    expect(root.querySelectorAll('.dr03-delay')).toHaveLength(6); expect(root.textContent).toContain('4 scalar states');
    rows(root).forEach(row => expect(row.slice(3).every(v => v === row[3])).toBe(true));
  });
  it('selects a delay cell through its keyboard control and the numeric alternative stays synchronized', () => {
    const root = open(); reveal(root);
    const cell = root.querySelector('[data-state-index="3"]')!;
    expect(cell.closest('svg')!.getAttribute('role')).toBe('group');
    cell.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(control(root, 'Equation to inspect').value).toBe('3');
    expect(root.querySelector('[data-state-index="3"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('[aria-label="Selected row arithmetic"]')!.textContent).toContain('x_{4}[1]');
    change(control(root, 'Equation to inspect'), 'y');
    expect(root.querySelectorAll('[data-state-index][aria-pressed="true"]')).toHaveLength(0);
  });
  it('keeps singular-map feedback separate from the valid history/recurrence response', () => {
    const root = open(); change(plant(root), '(z-1)/(z^2-1)');
    change(control(root, 'y[−1]'), '1'); change(control(root, 'y[−2]'), '-2');
    change(control(root, 'u[−1]'), '3'); change(control(root, 'u[−2]'), '-1'); change(control(root, 'Sequence amplitude A'), '0');
    reveal(root); expect(root.textContent).toContain('Canonical comparison unavailable');
    expect(rows(root)[0].slice(3)).toEqual(['2', '2', 'Unavailable', 'Unavailable']);
    expect(root.querySelector('.dr03-plot svg')).not.toBeNull();
  });
  it('supports zero-state-count gains, then actual pure input storage', () => {
    const root = open(); change(plant(root), '3'); change(control(root, 'Sequence amplitude A'), '2'); reveal(root);
    expect(root.querySelectorAll('.dr03-delay')).toHaveLength(0); expect(rows(root)[0][3]).toBe('6');
    expect(root.textContent).toContain('zero storage cells');
    change(control(root, 'Additional input delay m (samples)'), '2');
    change(control(root, 'u[−1]'), '5'); change(control(root, 'u[−2]'), '-2'); reveal(root);
    expect(rows(root).slice(0, 4).map(row => row[3])).toEqual(['-6', '15', '6', '6']);
    expect(root.querySelectorAll('.dr03-delay')).toHaveLength(2);
  });
  it('uses native recurrence weights with the displayed sign convention and exponent alternative', () => {
    const root = open(); change(control(root, 'Recurrence order n'), '1');
    change(control(root, 'Past-output weight α1'), '.5'); change(control(root, 'Input weight β0'), '0'); change(control(root, 'Input weight β1'), '1e-2');
    click(root, 'Apply recurrence weights to equation'); reveal(root);
    expect(rows(root).slice(0, 4).map(row => row[3])).toEqual(['0', '0.01', '0.015', '0.0175']);
    expect(plant(root).value).not.toMatch(/[eE]/);
    change(control(root, 'Input weight β1'), '1e-999'); click(root, 'Apply recurrence weights to equation'); expect(root.textContent).toContain('too small to represent');
    expect(rows(root)[1][3]).toBe('0.01');
  });
  it('changes only physical time on T edit and explicitly regenerates the source coefficients', () => {
    const root = open(); reveal(root); const prior = rows(root).map(row => row[3]);
    change(control(root, 'Sample period T (s)'), '.2'); reveal(root); expect(rows(root).map(row => row[3])).toEqual(prior); expect(rows(root)[10][1]).toBe('2');
    click(root, 'Regenerate mechanical ZOH model at T'); reveal(root);
    expect(Number(rows(root)[10][3])).toBeCloseTo(.5 - Math.exp(-2) + .5 * Math.exp(-4), 7);
    expect(control(root, 'Additional input delay m (samples)').value).toBe('0');
  });
  it('rejects underflow while preserving intentional zero and ordinary native exponent input', () => {
    const root = open(); reveal(root); change(control(root, 'Sequence amplitude A'), '1e-999'); reveal(root);
    expect(output(root).hidden).toBe(true); expect(root.textContent).toContain('too small to represent');
    change(control(root, 'Sequence amplitude A'), '0e-999'); reveal(root); expect(rows(root).every(row => row[3] === '0')).toBe(true);
    change(control(root, 'Sequence amplitude A'), '1e-2'); reveal(root);
    expect(Number(rows(root)[10][3])).toBeCloseTo(.01 * (.5 - Math.exp(-1) + .5 * Math.exp(-2)), 9);
  });
  it('retains an invalid raw inspection index through Reveal and displays only new experiment results', () => {
    const root = open(); reveal(root); change(control(root, 'Inspect sample k'), '1e-999');
    change(control(root, 'Sequence amplitude A'), '2'); reveal(root);
    expect(control(root, 'Inspect sample k').value).toBe('1e-999'); expect(root.textContent).toContain('too small to represent');
    expect(Number(rows(root)[10][3])).toBeCloseTo(1 - 2 * Math.exp(-1) + Math.exp(-2), 7);
    expect(root.querySelector('[aria-label="Selected row arithmetic"]')).toBeNull();
    change(control(root, 'Inspect sample k'), '0e-999'); expect(root.querySelector('[aria-label="Selected row arithmetic"]')).not.toBeNull();
    change(control(root, 'Inspect sample k'), '999'); expect(control(root, 'Inspect sample k').value).toBe('20');
    change(control(root, 'Inspect sample k'), '-1'); expect(control(root, 'Inspect sample k').value).toBe('-1'); expect(root.textContent).toContain('nonnegative integer');
  });
  it('rejects an optional prediction with browser badInput and clears stale assessment after edits', () => {
    const root = open(), prediction = control(root, 'Predicted selected result') as HTMLInputElement;
    const validity = vi.spyOn(prediction, 'validity', 'get').mockReturnValue({ badInput: true } as ValidityState);
    reveal(root); expect(output(root).hidden).toBe(true); expect(root.textContent).toContain('finite number');
    validity.mockRestore(); change(prediction, '0'); click(root, 'Check prediction');
    expect(root.textContent).toContain('Prediction matches'); change(prediction, '2'); expect(root.textContent).not.toContain('Prediction matches');
    change(prediction, '1e-999'); reveal(root); expect(output(root).hidden).toBe(true); expect(root.textContent).toContain('too small');
  });
  it('reports incomplete/unsupported equations and invalid sampling without stale tables', () => {
    const root = open(); reveal(root); change(plant(root), ''); reveal(root); expect(root.textContent).toContain('Complete G(z)'); expect(rows(root)).toEqual([]);
    change(plant(root), '1/(z^3+1)'); reveal(root); expect(output(root).hidden).toBe(true);
    change(plant(root), '1/(z-.5)'); change(control(root, 'Additional input delay m (samples)'), '.5'); reveal(root); expect(root.textContent).toContain('never rounded');
    change(control(root, 'Additional input delay m (samples)'), '0'); change(control(root, 'Sample instants including k=0'), '121'); reveal(root); expect(root.textContent).toContain('4–120');
  });
  it('cleans controls on abort and reopens with fresh baseline and hidden results', () => {
    const root = open(); change(plant(root), '3'); reveal(root);
    const visit = visits.pop()!; visit.controller.abort(); if (typeof visit.cleanup === 'function') { visit.cleanup(); visit.cleanup(); }
    expect(root.childElementCount).toBe(0);
    const fresh = open(); expect(output(fresh).hidden).toBe(true); expect(control(fresh, 'Sequence amplitude A').value).toBe('1');
    reveal(fresh); expect(rows(fresh)[0][3]).toBe('0'); expect(fresh.querySelectorAll('.dr03-delay')).toHaveLength(4);
  });
});
