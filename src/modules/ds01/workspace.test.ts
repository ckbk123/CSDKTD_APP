import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mount } from './workspace';

const mockState = vi.hoisted(() => ({ failNext: false }));

// Checks DS01's state/lifecycle wiring, not the real editor or browser rendering.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string) => {
    const element = document.createElement('div'); element.dataset.latex = latex; element.textContent = latex; return element;
  },
  createEquationInput: (options: EquationInputOptions) => {
    if (mockState.failNext) { mockState.failNext = false; throw new Error('Synthetic editor mount failure'); }
    const element = document.createElement('div'), field = document.createElement('textarea');
    field.setAttribute('aria-label', options.label); field.value = options.value; element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value, syntaxIssues: [], hasPlaceholders: false });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove();
    options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy };
  },
}));

const visits: { root: HTMLElement; abort: AbortController; cleanup: () => void }[] = [];
function start() {
  const root = document.createElement('div'); document.body.append(root); const abort = new AbortController();
  const cleanup = mount({ container: root, signal: abort.signal }) || (() => {});
  const visit = { root, abort, cleanup }; visits.push(visit); return visit;
}
async function open() { const visit = start(); await vi.waitFor(() => expect(visit.root.querySelector('textarea')).not.toBeNull()); return visit; }
function button(root: HTMLElement, text: string) { const found = Array.from(root.querySelectorAll('button')).find(b => b.textContent === text); expect(found).toBeDefined(); return found!; }
function experiment(root: HTMLElement, value: string) {
  const select = root.querySelector<HTMLSelectElement>('.ds-controls select')!; select.value = value; button(root, 'Load experiment').click();
}
afterEach(() => { for (const v of visits.splice(0)) { v.abort.abort(); v.cleanup(); v.root.remove(); } });

describe('DS01 teaching flow and isolation', () => {
  it('keeps a visible error and removes partial controls when editor mounting fails', async () => {
    mockState.failNext = true; const { root } = start();
    await vi.waitFor(() => expect(root.textContent).toContain('Equation controls could not load'));
    expect(root.querySelector('.ds01')).toBeNull();
    expect(root.querySelector('textarea')).toBeNull();
  });
  it('reveals the baseline and invalidates stale results on an edited pole', async () => {
    const { root } = await open();
    expect(root.querySelector<HTMLElement>('.ds-results')!.hidden).toBe(true);
    button(root, 'Reveal and check').click();
    expect(root.querySelector('.ds-results')!.textContent).toContain('All free responses decay to zero');
    const field = root.querySelector('textarea')!; field.value = '1.2'; field.dispatchEvent(new Event('input'));
    expect(root.querySelector<HTMLElement>('.ds-results')!.hidden).toBe(true);
    button(root, 'Reveal and check').click();
    expect(root.querySelector('.ds-results')!.textContent).toContain('Some free responses grow without bound');
  });
  it('checks the hidden-mode experiment and independent versus Jordan repetition', async () => {
    const { root } = await open(); experiment(root, 'hidden'); button(root, 'Reveal and check').click();
    expect(root.querySelector('.ds-results')!.textContent).toContain('Internal state: Some free responses grow without bound');
    expect(root.querySelector('.ds-results')!.textContent).toContain('Visible channel: BIBO stable');
    expect(root.querySelector('[data-latex^="G(z)"]')!.getAttribute('data-latex')).not.toContain('1.2');
    experiment(root, 'independent'); button(root, 'Reveal and check').click();
    expect(root.querySelector('.ds-results')!.textContent).toContain('some do not decay');
    experiment(root, 'jordan2'); button(root, 'Reveal and check').click();
    expect(root.querySelector('.ds-results')!.textContent).toContain('grow without bound');
  });
  it('reports malformed poles and invalid numeric controls without showing stale results', async () => {
    const { root } = await open(); const field = root.querySelector('textarea')!;
    field.value = 'NaN'; button(root, 'Reveal and check').click();
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Pole 1:');
    expect(root.querySelector<HTMLElement>('.ds-results')!.hidden).toBe(true);
    field.value = '.8'; root.querySelector<HTMLInputElement>('input[type="number"]')!.value = '';
    button(root, 'Reveal and check').click(); expect(root.querySelector('[role="status"]')!.textContent).toContain('Sample period');
  });
  it.each([[0, 'Sample period T (s)'], [1, 'Last sample k']] as const)('reports raw underflow in numeric control %s without retaining a result', async (index, label) => {
    const { root } = await open(); button(root, 'Reveal and check').click();
    const results = root.querySelector<HTMLElement>('.ds-results')!;
    expect(results.hidden).toBe(false);
    const control = root.querySelectorAll<HTMLInputElement>('input[type="number"]')[index];
    control.value = '1e-400';
    expect(control.valueAsNumber).toBe(0);
    button(root, 'Reveal and check').click();
    expect(root.querySelector('[role="status"]')!.textContent).toContain(`${label} is nonzero but too small to represent`);
    expect(results.hidden).toBe(true); expect(results.childElementCount).toBe(0);
    expect(control.value).toBe('1e-400');
  });
  it('accepts native exponents while keeping the sample horizon integer', async () => {
    const { root } = await open();
    const [period, horizon] = root.querySelectorAll<HTMLInputElement>('input[type="number"]');
    period.value = '2e-1'; horizon.value = '4e0'; button(root, 'Reveal and check').click();
    const results = root.querySelector<HTMLElement>('.ds-results')!;
    expect(results.hidden).toBe(false);
    const rows = root.querySelectorAll('.ds-samples tbody tr');
    expect(rows).toHaveLength(5);
    expect(Array.from(rows[4].children).map(cell => cell.textContent)).toEqual(['4', '0.8', '0.4096', '0.4096', '0.4096']);
    horizon.value = '4.5e0'; horizon.dispatchEvent(new Event('input'));
    expect(results.hidden).toBe(true); expect(results.childElementCount).toBe(0);
    button(root, 'Reveal and check').click();
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Last sample must be an integer from 4 to 80');
    expect(results.hidden).toBe(true);
  });
  it('retains positive module bounds after reading intentional zero', async () => {
    const { root } = await open();
    const [period, horizon] = root.querySelectorAll<HTMLInputElement>('input[type="number"]');
    period.value = '0'; button(root, 'Reveal and check').click();
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Sample period T must be between 0.001 and 10 seconds');
    period.value = '.1'; horizon.value = '0'; button(root, 'Reveal and check').click();
    expect(root.querySelector('[role="status"]')!.textContent).toContain('Last sample must be an integer from 4 to 80');
    expect(root.querySelector('[role="status"]')!.textContent).not.toContain('too small to represent');
    expect(root.querySelector<HTMLElement>('.ds-results')!.hidden).toBe(true);
  });
  it('does not assign a phase to a zero pole', async () => {
    const { root } = await open(); root.querySelector('textarea')!.value = '0'; button(root, 'Reveal and check').click();
    expect(root.querySelector('.ds-results')!.textContent).toContain('Undefined at zero');
    expect(root.querySelector('.ds-results')!.textContent).toContain('A zero pole has no defined angle');
    expect(root.querySelector('.ds-results')!.textContent).not.toContain('atan2');
  });
  it('restores baseline state on a fresh visit and supports removing/replacing rows', async () => {
    const first = await open(); experiment(first.root, 'jordan3'); first.abort.abort(); first.cleanup();
    const second = await open(); expect(Array.from(second.root.querySelectorAll('textarea')).map(f => f.value)).toEqual(['0.8', '-0.8']);
    button(second.root, 'Remove last pole').click(); expect(second.root.querySelectorAll('.ds-row')).toHaveLength(1);
    button(second.root, 'Add pole').click(); expect(second.root.querySelectorAll('.ds-row')).toHaveLength(2);
    expect(Array.from(second.root.querySelectorAll('textarea')).map(f => f.value)).toEqual(['0.8', '0']);
  });
  it.each(['abort', 'dispose'])('does not mount late equation controls after immediate %s', async action => {
    const visit = start(); if (action === 'abort') visit.abort.abort(); visit.cleanup();
    await new Promise(resolve => setTimeout(resolve, 20)); expect(visit.root.childNodes).toHaveLength(0);
  });
});
