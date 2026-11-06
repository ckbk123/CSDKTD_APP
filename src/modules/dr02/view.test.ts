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
  it('opens on usable old slots without revealing the answer or requiring setup panels', () => {
    const { container, close } = visit(), first = container.querySelector('section')!;
    expect(first.querySelector('h3')?.textContent).toBe('Execute one sample through memory');
    expect(container.querySelectorAll('details.setup-panel')).toHaveLength(2);
    expect([...container.querySelectorAll<HTMLDetailsElement>('details.setup-panel')].every(panel => !panel.open)).toBe(true);
    expect(first.querySelectorAll('.registers button')).toHaveLength(3);
    expect(first.getAttribute('data-phase')).toBe('read');
    expect(first.querySelector('[aria-label="Selected source product"]')?.textContent).toContain('=?');
    expect(first.querySelector('[aria-label="Revealed output at current sample"]')).toBeNull();
    expect(container.querySelectorAll('svg [data-sample]')).toHaveLength(0);
    close();
  });
  it('selects a memory source directly, retains keyboard focus and only reveals its product on demand', () => {
    const { container, click, close } = visit();
    const source = () => container.querySelector<HTMLButtonElement>('.registers [data-source="y:1"]')!;
    source().focus(); source().click();
    expect(document.activeElement).toBe(source());
    expect(source().getAttribute('aria-pressed')).toBe('true');
    expect(container.querySelector('.selected-detail')?.textContent).toContain('y[k−1] → multiply → sum');
    expect(container.querySelector('[aria-label="Selected source product"]')?.textContent).toContain('=?');
    expect(container.textContent).not.toContain('Next snapshot · not written yet');
    click('Reveal arithmetic');
    expect(source().getAttribute('aria-pressed')).toBe('true');
    const afterReveal = source(); afterReveal.focus(); afterReveal.click();
    expect(document.activeElement).toBe(source());
    expect(container.querySelector('[aria-label="Selected source product"]')?.textContent).toBe('(0.90483742)\\times(0)=0');
    expect(source().dataset.value).toBe('0');
    expect(container.querySelector('section')?.getAttribute('data-phase')).toBe('commit');
    close();
  });
  it('previews every second-order write from the old snapshot and commits them simultaneously', () => {
    const { container, click, close } = visit(); click('Second-order example');
    for (const [label, value] of [['y[−1] initial memory', '2'], ['y[−2] initial memory', '3'], ['u[−1] initial memory', '4'], ['u[−2] initial memory', '5']]) {
      const input = container.querySelector<HTMLInputElement>('[aria-label="' + label + '"]')!; input.value = value; input.dispatchEvent(new Event('input'));
    }
    click('Restart with this history'); click('Reveal arithmetic');
    expect(container.querySelector('[aria-label="Revealed output at current sample"]')?.textContent).toBe('y[0]=3.875');
    const shifts = () => [...container.querySelectorAll<HTMLElement>('.shift-row')].map(row => [row.dataset.destination, row.querySelector('.old-value')?.textContent, row.querySelector('.next-value')?.textContent]);
    const expected = [['u:1', '4', '1'], ['u:2', '5', '4'], ['y:1', '2', '3.875'], ['y:2', '3', '2']];
    expect(shifts()).toEqual(expected);
    expect(container.querySelector<HTMLElement>('.registers [data-source="u:2"]')?.dataset.value).toBe('5');
    click('Commit sample & shift memory');
    expect(shifts()).toEqual(expected);
    expect(container.querySelector<HTMLElement>('.registers [data-source="u:2"]')?.dataset.value).toBe('4');
    expect(container.querySelector<HTMLElement>('.registers [data-source="y:2"]')?.dataset.value).toBe('2');
    expect(container.textContent).toContain('Last simultaneous write: k = 0 → 1');
    expect(container.querySelector('[aria-label="Selected committed output and history contribution"]')?.textContent).toContain('y[0]=3.875,\\quad y_{0}[0]=0');
    expect(container.querySelector('[aria-label="Revealed output at current sample"]')).toBeNull();
    close();
  });
  it('scrubs committed results with number, range, plot and table without advancing live memory', () => {
    const { container, click, close } = visit();
    for (let k = 0; k < 3; k++) { click('Reveal arithmetic'); click('Commit sample & shift memory'); }
    const cursor = container.querySelector<HTMLInputElement>('[aria-label="Inspect committed sample k"]')!;
    cursor.value = '1'; cursor.dispatchEvent(new Event('input'));
    expect(container.querySelector('.trace-readout h4')?.textContent).toContain('sample k = 1');
    expect(container.querySelector('[aria-label="Selected committed output and history contribution"]')?.textContent).toContain('y[1]=0.09516258');
    const slider = container.querySelector<HTMLInputElement>('[aria-label="Committed sample cursor"]')!;
    slider.value = '0'; slider.dispatchEvent(new Event('input'));
    expect(container.querySelector('.trace-readout h4')?.textContent).toContain('sample k = 0');
    container.querySelector<SVGElement>('svg [data-sample="2"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(cursor.value).toBe('2');
    const tableButton = container.querySelector<HTMLButtonElement>('table button[data-sample="1"]')!;
    tableButton.focus(); tableButton.click();
    expect(document.activeElement).toBe(container.querySelector('table button[data-sample="1"]'));
    expect(cursor.value).toBe('1');
    cursor.value = '-1'; cursor.dispatchEvent(new Event('input'));
    expect(container.querySelector('.trace-readout h4')?.textContent).toContain('sample k = 1');
    expect(container.textContent).toContain('Choose a committed sample from 0 to 2.');
    expect(container.textContent).toContain('Current sample k = 3');
    expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Commit sample & shift memory')?.disabled).toBe(true);
    close();
  });
  it('removes pending products, write previews and old trace inspection as soon as settings change', () => {
    const { container, click, close } = visit(); click('Reveal arithmetic'); click('Commit sample & shift memory'); click('Reveal arithmetic');
    const input = container.querySelector<HTMLInputElement>('[aria-label="Input amplitude / ramp slope"]')!; input.value = '2'; input.dispatchEvent(new Event('input'));
    expect(container.querySelector('section')?.getAttribute('data-phase')).toBe('pending');
    expect(container.querySelector('.selected-detail')?.children).toHaveLength(0);
    expect(container.querySelector('.shift-view')?.children).toHaveLength(0);
    expect(container.querySelector('.trace-readout')?.children).toHaveLength(0);
    expect((container.querySelector('.trace-controls') as HTMLElement).hidden).toBe(true);
    expect(container.querySelector('[aria-label="Revealed output at current sample"]')).toBeNull();
    close();
  });
  it('uses sparse native text axes outside the scaled graphic while retaining the true samples', () => {
    const { container, click, close } = visit();
    click('Reveal arithmetic'); click('Commit sample & shift memory'); click('Reveal arithmetic'); click('Commit sample & shift memory');
    const chart = container.querySelector('.sample-chart')!;
    expect(chart.querySelector('figcaption')?.textContent).toBe('Output y (arbitrary units)');
    expect(chart.querySelectorAll('svg text')).toHaveLength(0);
    expect([...chart.querySelectorAll('.y-scale span')].map(node => node.textContent)).toEqual(['0.0952', '0.0476', '0']);
    expect([...chart.querySelectorAll('.x-scale span')].map(node => node.textContent)).toEqual(['0', '1']);
    expect(chart.querySelector('svg')?.getAttribute('preserveAspectRatio')).toBe('none');
    expect(chart.querySelector('[data-sample="1"]')?.getAttribute('cy')).toBe('12');
    expect(chart.querySelectorAll('[data-sample]')).toHaveLength(2);
    close();
  });
  it('revokes old prediction grading when its draft changes without discarding the frozen calculation', () => {
    const { container, click, close } = visit();
    const guess = container.querySelector<HTMLInputElement>('[aria-label="Your predicted y[k] (optional)"]')!;
    guess.value = '0'; guess.dispatchEvent(new Event('input')); click('Reveal arithmetic');
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Prediction agrees');
    guess.value = '1'; guess.dispatchEvent(new Event('input'));
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Prediction edited. Reveal again to check it');
    expect(container.querySelector('[role="status"]')?.textContent).not.toContain('Prediction agrees');
    expect(container.querySelector('[aria-label="Revealed output at current sample"]')?.textContent).toBe('y[0]=0');
    expect([...container.querySelectorAll('button')].find(button => button.textContent === 'Commit sample & shift memory')?.disabled).toBe(false);
    click('Commit sample & shift memory');
    expect(container.textContent).toContain('Current sample k = 1');
    close();
  });
  it('finishes at the 128-sample boundary without allowing an extra reveal or write', () => {
    const { container, close } = visit();
    const reveal = [...container.querySelectorAll('button')].find(button => button.textContent === 'Reveal arithmetic')!;
    const commit = [...container.querySelectorAll('button')].find(button => button.textContent === 'Commit sample & shift memory')!;
    for (let k = 0; k < 128; k++) { reveal.click(); commit.click(); }
    expect(container.querySelector('section')?.getAttribute('data-phase')).toBe('complete');
    expect(reveal.disabled).toBe(true); expect(commit.disabled).toBe(true);
    expect(container.querySelector('[aria-label="Committed sample cursor"]')?.getAttribute('max')).toBe('127');
    expect(container.querySelectorAll('svg [data-sample]')).toHaveLength(128);
    reveal.click(); commit.click();
    expect(container.querySelectorAll('svg [data-sample]')).toHaveLength(128);
    close();
  }, 15000); // Executes every real UI transition through the complete bounded run.
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
