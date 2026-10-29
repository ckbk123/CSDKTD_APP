import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';

// Test exercise state/validation without treating this as real MathLive evidence.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => {
    const e = document.createElement('div'); e.setAttribute('role', 'math'); e.setAttribute('aria-label', label); e.textContent = latex; return e;
  },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea');
    field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = (): EquationDraft => ({ latex: field.value, empty: !field.value, hasPlaceholders: false, syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy: () => element.remove() };
  },
}));
import { mount } from './view';

const cleanup: (() => void)[] = [];
afterEach(() => cleanup.splice(0).forEach(fn => fn()));
function open() {
  const container = document.createElement('section'); container.dataset.module = 'CP03'; document.body.append(container);
  const controller = new AbortController(), dispose = mount({ container, signal: controller.signal });
  cleanup.push(() => { controller.abort(); if (typeof dispose === 'function') dispose(); container.remove(); });
  const button = (text: string) => [...container.querySelectorAll('button')].find(b => b.textContent === text)!;
  const field = (text: string) => [...container.querySelectorAll('label')].find(l => l.textContent?.includes(text))!.querySelector('input')!;
  const change = (input: HTMLInputElement | HTMLTextAreaElement, value: string) => { input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const apply = () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  return { container, controller, button, field, change, apply };
}

describe('CP03 exercise flow and ownership', () => {
  it('keeps the checked answer hidden until markers can be placed, then compares them', () => {
    const v = open();
    expect(v.container.textContent).toContain('Stable steady-state experiment');
    expect(v.container.querySelector('.cp03-checked')?.textContent).toBe('');
    v.change(v.field('Output peak'), String(v.field('Input peak').valueAsNumber + Math.atan(3)));
    v.change(v.field('Output amplitude marker'), String(1 / Math.sqrt(10)));
    v.button('Reveal calculation and linked plots').click();
    expect(v.container.textContent).toContain('-71.565');
    expect(v.container.querySelectorAll('figure')).toHaveLength(4);
    expect(v.container.querySelector('.cp03-message[role="status"]')?.textContent).toContain('gain 0, phase 0°');
  });
  it('invalidates stale results immediately, computes changed data and explains an improper plant', () => {
    const v = open(); v.button('Reveal calculation and linked plots').click();
    v.change(v.field('Frequency ω'), '2');
    expect(v.container.querySelector('figure')).toBeNull();
    v.apply(); v.button('Reveal calculation and linked plots').click();
    expect(v.container.textContent).toContain('-108.43');
    const plant = v.container.querySelector('textarea')!;
    v.change(plant, 's^2/(s+1)'); v.apply();
    expect(v.container.textContent).toContain('improper plant');
    expect(v.container.querySelector('figure')).toBeNull();
  });
  it('distinguishes unsettled actual data and unstable analytic evaluation', () => {
    const v = open();
    v.button('Slow transient').click(); expect(v.container.textContent).toContain('Not settled');
    v.button('Unstable model').click(); expect(v.container.textContent).toContain('Unstable model: analytic frequency evaluation only');
    const toggle = v.container.querySelector('input[type="checkbox"]')!;
    toggle.dispatchEvent(new Event('change'));
    expect(v.container.textContent).toContain('need not approach it');
  });
  it('rejects empty numeric values and clears owned content on abort; reopening is fresh', () => {
    const v = open(); v.change(v.field('Input amplitude A'), ''); v.apply();
    expect(v.container.textContent).toContain('Enter input amplitude');
    v.controller.abort(); expect(v.container.childElementCount).toBe(0);
    const next = open(); expect(next.field('Input amplitude A').value).toBe('1');
    expect(next.container.querySelector('.cp03-checked')?.textContent).toBe('');
    v.button('Course baseline')?.click(); expect(next.field('Input amplitude A').value).toBe('1');
  });
});
