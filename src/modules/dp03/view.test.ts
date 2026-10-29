import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationInputOptions } from '../../shared/equations/input';
import { mountView } from './view';

// This mock verifies exercise wiring; actual editor behavior remains browser QA.
vi.mock('../../shared/equations/input', () => ({
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value, syntaxIssues: [], hasPlaceholders: false });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, destroy: () => element.remove(), focus: () => field.focus() };
  },
  createEquationDisplay: (latex: string, label: string) => {
    const element = document.createElement('div'); element.dataset.latex = latex; element.setAttribute('aria-label', label); return element;
  },
}));
const disposers: (() => void)[] = [];
afterEach(() => { disposers.splice(0).forEach(dispose => dispose()); document.body.replaceChildren(); });
function open() {
  const container = document.createElement('div'), controller = new AbortController(); document.body.append(container);
  const release = mountView({ container, signal: controller.signal }); disposers.push(() => { controller.abort(); release?.(); });
  const button = (name: string) => {
    const control = [...container.querySelectorAll('button')].find(node => node.textContent === name); expect(control).toBeDefined(); control!.click();
  };
  const field = (name: string) => {
    const label = [...container.querySelectorAll('label')].find(node => node.firstChild?.textContent === name); expect(label).toBeDefined(); return label!.querySelector('input')!;
  };
  const set = (name: string, value: string) => { const input = field(name); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const visible = () => !container.querySelector<HTMLElement>('.dp03-output')!.hidden;
  return { container, button, field, set, visible, reveal: () => button('Reveal and compare frequency plots') };
}
describe('DP03 linked exercise flow', () => {
  it('dismisses Escape before editor mode changes and keeps presets usable', () => {
    const previous = Object.getOwnPropertyDescriptor(window, 'mathVirtualKeyboard'), hide = vi.fn();
    Object.defineProperty(window, 'mathVirtualKeyboard', { configurable: true, value: { hide } });
    try {
      const visit = open(), field = visit.container.querySelector('textarea')!, defaultModeChange = vi.fn();
      field.addEventListener('keydown', event => { if (!event.defaultPrevented) defaultModeChange(); });
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); field.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(true); expect(defaultModeChange).not.toHaveBeenCalled(); expect(hide).toHaveBeenCalledOnce();
      visit.button('First-order variation'); visit.set('Normalized Ω (rad/sample)', '0'); visit.reveal();
      expect(visit.visible()).toBe(true); expect(visit.container.textContent).toContain('|G|≈2');
    } finally {
      if (previous) Object.defineProperty(window, 'mathVirtualKeyboard', previous); else Reflect.deleteProperty(window, 'mathVirtualKeyboard');
    }
  });
  it('waits for reveal and checks independent first-order gain/phase predictions', () => {
    const visit = open(); expect(visit.visible()).toBe(false);
    visit.button('First-order variation'); visit.set('Sample period T (s)', '2'); visit.set('Normalized Ω (rad/sample)', String(Math.PI / 2));
    visit.set('Your magnitude |G|', String(Math.sqrt(.8))); visit.set('Your phase (degrees)', '-26.56505118'); visit.reveal();
    expect(visit.visible()).toBe(true); expect(visit.container.textContent).toContain('Magnitude prediction matches. Phase prediction matches.');
    expect(visit.container.textContent).toContain('|G|≈0.8944272'); expect(visit.container.textContent).toContain('Unwarped approximation');
    expect(visit.container.querySelector('[aria-label="Exact frequency evaluation"]')!.getAttribute('data-latex')).toContain('0.8-0.4j');
    expect(visit.container.querySelectorAll('svg')).toHaveLength(4);
  });
  it('drives results from numeric and keyboard-equivalent range cursor changes', () => {
    const visit = open(); visit.button('First-order variation'); visit.reveal();
    visit.set('Normalized Ω (rad/sample)', '0');
    expect(visit.container.textContent).toContain('|G|≈2');
    // DC is reported numerically and never drawn as a false log-zero point.
    expect(visit.container.querySelectorAll('svg[aria-label^="Magnitude"] circle')).toHaveLength(0);
    const slider = visit.field('Unit-circle cursor Ω (arrow keys or numeric entry)'); slider.value = String(Math.PI / 2); slider.dispatchEvent(new Event('input'));
    expect(Number(visit.field('Normalized Ω (rad/sample)').value)).toBeCloseTo(Math.PI / 2, 2);
    expect(visit.container.textContent).toContain('Checked unit-circle cursor');
  });
  it('preserves source DC singularity in direct and transformed output, and gives undefined phase at a zero', () => {
    const visit = open(); visit.set('Normalized Ω (rad/sample)', '0'); visit.reveal();
    expect(visit.visible()).toBe(true); expect(visit.container.textContent).toContain('Warped construction: The denominator is zero');
    visit.button('Two-tap average'); visit.set('Normalized Ω (rad/sample)', String(Math.PI)); visit.reveal();
    expect(visit.container.textContent).toContain('phase is undefined'); expect(visit.container.textContent).toContain('w at infinity');
  });
  it('maps a signed repeated physical frequency and invalidates it when T changes', () => {
    const visit = open(); visit.button('First-order variation'); visit.reveal();
    visit.set('Requested physical ω (rad/s)', String(-1 - 20 * Math.PI)); visit.button('Map physical frequency');
    expect(Number(visit.field('Normalized Ω (rad/sample)').value)).toBeCloseTo(.1, 12);
    expect(visit.container.textContent).toContain('This repeats an existing unit-circle frequency');
    expect(visit.container.textContent).toContain('Signed alias evaluation at Ω=-0.1');
    visit.set('Sample period T (s)', '.2'); expect(visit.visible()).toBe(false);
    visit.reveal(); expect(visit.container.textContent).not.toContain('Signed alias evaluation');
  });
  it('rejects bad notation, invalid T and excessive order without leaving stale plots visible', () => {
    const visit = open(); visit.reveal();
    const editor = visit.container.querySelector('textarea')!;
    for (const [expression, fragment] of [['1e-2', 'e/E scientific notation'], [String.raw`2\frac12`, 'mixed number'], [String.raw`q{+1}`, 'visible parentheses'], ['1/(1+q^5)', 'order 4'], ['', 'Complete the visual transfer function']]) {
      editor.value = expression; editor.dispatchEvent(new Event('input')); visit.reveal();
      expect(visit.visible()).toBe(false); expect(visit.container.querySelector('.dp03-message')!.textContent).toContain(fragment);
    }
    visit.button('First-order variation'); visit.set('Sample period T (s)', '0'); visit.reveal();
    expect(visit.visible()).toBe(false); expect(visit.container.querySelector('.dp03-message')!.textContent).toContain('Sample period');
  });
  it('keeps independent visits and ordinary numeric scientific entry separate from the visual grammar', () => {
    const first = open(); first.button('First-order variation'); first.set('Sample period T (s)', '1e-2'); first.reveal(); expect(first.visible()).toBe(true);
    const second = open(); expect(second.visible()).toBe(false); expect(Number(second.field('Sample period T (s)').value)).toBe(.1);
    expect(second.container.querySelector('textarea')!.value).toContain('1.741');
  });
  it.each(['Sample period T (s)', 'Normalized Ω (rad/sample)', 'Requested physical ω (rad/s)', 'Nyquist half-span (gain units)'])('rejects raw nonzero native underflow in %s', label => {
    const visit = open(); visit.reveal(); visit.set(label, '1e-999');
    if (label === 'Requested physical ω (rad/s)') visit.button('Map physical frequency'); else visit.reveal();
    expect(visit.visible()).toBe(false); expect(visit.container.querySelector('.dp03-message')!.textContent).toContain('nonzero but too small');
  });
  it('preserves intentional zero mantissas in numeric frequency controls', () => {
    const visit = open(); visit.button('First-order variation'); visit.set('Normalized Ω (rad/sample)', '0e-999'); visit.reveal();
    expect(visit.visible()).toBe(true); expect(visit.container.textContent).toContain('|G|≈2');
    visit.set('Requested physical ω (rad/s)', '-0e-999'); visit.button('Map physical frequency');
    expect(visit.visible()).toBe(true); expect(visit.container.textContent).toContain('Signed alias evaluation at Ω=0');
  });
  it('explains a Nyquist point outside the chosen window instead of hiding it silently', () => {
    const visit = open(); visit.button('First-order variation'); visit.set('Nyquist half-span (gain units)', '.01'); visit.reveal();
    expect(visit.container.textContent).toContain('selected point is outside this window');
    visit.set('Nyquist half-span (gain units)', '10');
    expect(visit.container.textContent).not.toContain('selected point is outside this window');
    expect(visit.container.querySelectorAll('.dp03-scroll[tabindex="0"]')).toHaveLength(4);
  });
});
