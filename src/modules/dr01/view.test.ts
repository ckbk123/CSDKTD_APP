import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
import { mountView } from './view';

// These tests verify exercise wiring, not MathLive fonts, editing or keyboard behavior.
vi.mock('../../shared/equations/input', () => ({
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), input = document.createElement('textarea');
    input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    const getValue = (): EquationDraft => ({ latex: input.value, empty: !input.value, hasPlaceholders: false, syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { input.value = value; }, focus: () => input.focus(), destroy: () => element.remove() };
  },
  createEquationDisplay: (latex: string, label: string) => {
    const element = document.createElement('div'); element.dataset.latex = latex; element.setAttribute('aria-label', label); return element;
  },
}));

const cleanups: (() => void)[] = [];
afterEach(() => { cleanups.splice(0).forEach(cleanup => cleanup()); document.body.replaceChildren(); });
function open() {
  const container = document.createElement('div'), controller = new AbortController(); container.dataset.module = 'DR01'; document.body.append(container);
  const release = mountView({ container, signal: controller.signal });
  cleanups.push(() => { controller.abort(); release?.(); });
  const click = (name: string) => {
    const button = [...container.querySelectorAll('button')].find(node => node.textContent === name);
    expect(button).toBeDefined(); button!.click();
  };
  const set = (label: string, value: string) => {
    const wrapper = [...container.querySelectorAll('label')].find(node => node.firstChild?.textContent === label);
    const input = wrapper!.querySelector('input')!; input.value = value; input.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const field = container.querySelector('textarea')!;
  const rows = () => [...container.querySelectorAll('tbody tr')].map(row => [...row.querySelectorAll('td')].map(cell => cell.textContent));
  const reveal = () => click('Reveal and check sequence');
  return { container, click, set, field, rows, reveal };
}

describe('DR01 exercise flow with an equation-interface mock', () => {
  it('waits for reveal, checks predictions and links selected sample arithmetic', () => {
    const visit = open();
    expect(visit.container.querySelector('.dr01-results')!.hasAttribute('hidden')).toBe(true);
    visit.set('Your x[0]', '1'); visit.set('Your x[1]', '.8'); visit.set('Your x[2]', '.1'); visit.reveal();
    expect(visit.rows().slice(0, 3)).toEqual([['0', '0', '1', '1'], ['1', '0.1', '0.8', '0.8'], ['2', '0.2', '0.64', '0.64']]);
    expect(visit.container.textContent).toContain('x[0]: matches'); expect(visit.container.textContent).toContain('x[2]: your 0.1; computed 0.64');
    visit.set('Selected sample k', '2');
    expect(visit.container.querySelector('.dr01-results')!.textContent).toContain('Memory x[1] = 0.8');
    expect(visit.container.querySelector('tr.dr01-highlight')!.getAttribute('data-k')).toBe('2');
    visit.container.querySelector<HTMLButtonElement>('[aria-label="Inspect sample 1"]')!.click();
    expect(visit.container.querySelector('tr.dr01-highlight')!.getAttribute('data-k')).toBe('1');
  });
  it('adds initial-history response while preserving the entered zero-history transform', () => {
    const visit = open(), original = visit.field.value; visit.set('Initial x[−1]', '2'); visit.reveal();
    expect(visit.rows()[0]).toEqual(['0', '0', '1', '2.6']); expect(visit.field.value).toBe(original);
    expect(visit.container.querySelector('[aria-label="History-corrected unilateral transform"]')!.getAttribute('data-latex')).toContain('2.6');
  });
  it('distinguishes sum and average gains and first samples', () => {
    const visit = open(); visit.click('Moving sum (4)'); visit.reveal();
    expect(visit.rows().slice(0, 5).map(row => row[2])).toEqual(['1', '1', '1', '1', '0']);
    expect(visit.container.textContent).toContain('X₀(1) ≈ 4');
    visit.click('Moving average (4)'); visit.reveal();
    expect(visit.rows().slice(0, 5).map(row => row[2])).toEqual(['0.25', '0.25', '0.25', '0.25', '0']);
    expect(visit.container.textContent).toContain('X₀(1) ≈ 1');
  });
  it('builds a changed delayed sequence and handles empty/future-input errors', () => {
    const visit = open(); visit.set('Gain c', '2'); visit.set('Geometric pole a', '-0.5'); visit.set('Delay d (samples)', '2');
    visit.click('Build transform'); visit.reveal();
    expect(visit.rows().slice(0, 6).map(row => row[3])).toEqual(['0', '0', '2', '-1', '0.5', '-0.25']);
    for (const [expression, message] of [['', 'Complete the visual equation'], ['z', 'future samples']]) {
      visit.field.value = expression; visit.field.dispatchEvent(new Event('input')); visit.reveal();
      expect(visit.container.querySelector('.dr01-results')!.hasAttribute('hidden')).toBe(true);
      expect(visit.container.querySelector('.dr01-message')!.textContent).toContain(message);
    }
  });
  it('starts a second visit from the baseline after changed data', () => {
    const first = open(); first.click('Conjugate poles'); first.set('Initial x[−2]', '3'); first.reveal();
    const second = open(); second.reveal();
    expect(second.rows().slice(0, 3).map(row => row[3])).toEqual(['1', '0.8', '0.64']);
    expect(second.field.value).toBe(String.raw`\frac{z}{z-0.8}`);
  });
});
