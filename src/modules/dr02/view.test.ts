import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
import { mount } from './view';

// Tests caller state and lifecycle only. Interactive MathLive is checked in a real browser.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const node = document.createElement('div'); node.textContent = latex; node.setAttribute('aria-label', label); return node; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea');
    field.setAttribute('aria-label', options.label); field.value = options.value; element.append(field);
    const getValue = (): EquationDraft => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: false, syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (v: string) => { field.value = v; }, focus: () => field.focus(), destroy };
  },
}));
afterEach(() => document.body.replaceChildren());
function visit() {
  const container = document.createElement('div'); container.dataset.module = 'DR02'; document.body.append(container);
  const controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
  const click = (label: string) => { const button = [...container.querySelectorAll('button')].find(b => b.textContent === label)!; button.click(); return button; };
  return { container, click, close: () => { controller.abort(); cleanup?.(); } };
}
describe('DR02 exercise state transitions', () => {
  it('dismisses the keyboard before raw-notation Escape handling and removes the listener on abort', () => {
    const previous=window.mathVirtualKeyboard,hide=vi.fn();Object.defineProperty(window,'mathVirtualKeyboard',{value:{hide},configurable:true});
    try{
      const {container,click,close}=visit(),field=container.querySelector<HTMLTextAreaElement>('[aria-label="Transfer function G(z)"]')!,editor=vi.fn();field.addEventListener('keydown',editor);
      const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});field.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(true);expect(editor).not.toHaveBeenCalled();expect(hide).toHaveBeenCalledOnce();
      click('Baseline');expect(container.textContent).toContain('Ready at k = 0');close();
      field.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(hide).toHaveBeenCalledOnce();
    }finally{Object.defineProperty(window,'mathVirtualKeyboard',{value:previous,configurable:true});}
  });
  it.each([['0',0],['0e-999',0],['1e-2',.01],['1e-999',null],['',null]])('reads native amplitude %s without silently rounding a nonzero value to zero', (raw, value) => {
    const {container,click}=visit();
    const field=container.querySelector<HTMLTextAreaElement>('[aria-label="Transfer function G(z)"]')!;
    field.value='1';field.dispatchEvent(new Event('input'));click('Apply transfer function');
    const amplitude=container.querySelector<HTMLInputElement>('[aria-label="Input amplitude / ramp slope"]')!;
    amplitude.value=raw;amplitude.dispatchEvent(new Event('input'));click('Restart with this history');
    const reveal=[...container.querySelectorAll('button')].find(b=>b.textContent==='Reveal arithmetic')!;
    if(value===null){expect(reveal.disabled).toBe(true);expect(container.textContent).toContain(raw?'too small to represent':'as a finite number');}
    else {reveal.click();click('Commit sample & shift memory');expect(container.textContent).toContain(`Committed y[0] = ${value}`);}
  });
  it('invalidates a previous model when copied exponent boundaries are ambiguous', () => {
    const {container,click}=visit();click('Reveal arithmetic');
    const field=container.querySelector<HTMLTextAreaElement>('[aria-label="Transfer function G(z)"]')!;
    field.value='\\frac1{z^{0}2+1}';field.dispatchEvent(new Event('input'));click('Apply transfer function');
    expect(container.textContent).toContain('following number');
    expect(container.querySelector('[aria-label="Transfer function in z"]')).toBeNull();
    expect([...container.querySelectorAll('button')].find(b=>b.textContent==='Commit sample & shift memory')?.disabled).toBe(true);
  });
  it('applies and commits a signed compact visual fraction as a negative gain', () => {
    const { container, click } = visit();
    const field=container.querySelector<HTMLTextAreaElement>('[aria-label="Transfer function G(z)"]')!;
    field.value='-\\frac12';field.dispatchEvent(new Event('input'));click('Apply transfer function');click('Reveal arithmetic');click('Commit sample & shift memory');
    expect(container.querySelector('[aria-label="Scrollable committed sample table"]')?.textContent).toContain('-0.5');
    expect(container.textContent).toContain('Committed y[0] = -0.5');
  });
  it('rejects the visual e/E expression instead of revealing a scientific-notation gain', () => {
    const { container, click } = visit();
    const field = container.querySelector<HTMLTextAreaElement>('[aria-label="Transfer function G(z)"]')!;
    field.value = '1e-2'; field.dispatchEvent(new Event('input'));
    click('Apply transfer function');
    expect(container.textContent).toContain('visual editor treats e/E as symbols');
    expect(container.querySelector('[aria-label="Transfer function in z"]')).toBeNull();
    expect([...container.querySelectorAll('button')].find(b => b.textContent === 'Reveal arithmetic')?.disabled).toBe(true);
  });
  it('reveals without shifting, commits once, then compares altered history', () => {
    const { container, click, close } = visit();
    const commit = [...container.querySelectorAll('button')].find(b => b.textContent === 'Commit sample & shift memory')!;
    expect(commit.disabled).toBe(true);
    click('Reveal arithmetic');
    expect(container.textContent).toContain('Current sample k = 0');
    expect(container.textContent).toContain('Old memory is frozen');
    click('Commit sample & shift memory');
    expect(container.textContent).toContain('Current sample k = 1');
    expect(commit.disabled).toBe(true);
    click('Reveal arithmetic'); click('Commit sample & shift memory');
    expect(container.querySelector('[aria-label="Scrollable committed sample table"]')?.textContent).toContain('0.09516258');
    click('Try nonzero memory'); click('Reveal arithmetic'); click('Commit sample & shift memory');
    expect(container.querySelector('[aria-label="Scrollable committed sample table"]')?.textContent).toContain('0.90483742');
    close(); expect(container.children.length).toBe(0);
  });
  it('invalidates old calculations on edits and gives a causality explanation', () => {
    const { container, click } = visit();
    click('Reveal arithmetic');
    const input = container.querySelector<HTMLInputElement>('[aria-label="Sample period T (s)"]')!;
    input.value = '0'; input.dispatchEvent(new Event('input'));
    expect([...container.querySelectorAll('button')].find(b => b.textContent === 'Commit sample & shift memory')?.disabled).toBe(true);
    click('Restart with this history'); expect(container.textContent).toContain('Sample period T must be between');
    click('Future-input example'); expect(container.textContent).toContain('future input');
    expect(container.querySelector('svg')).toBeNull();
  });
  it('new visits discard old values and aborted listeners cannot mutate a new page', () => {
    const first = visit(); first.click('Try nonzero memory');
    const oldButton = [...first.container.querySelectorAll('button')].find(b => b.textContent === 'Reveal arithmetic')!;
    first.close(); const next = visit(); oldButton.click();
    expect(next.container.textContent).toContain('Current sample k = 0');
    expect(next.container.querySelector<HTMLInputElement>('[aria-label="y[−1] initial memory"]')?.value).toBe('0');
    expect(next.container.textContent).toContain('Output is hidden'); next.close();
  });
});
