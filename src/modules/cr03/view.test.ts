import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateLatex } from 'mathlive/ssr';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
import { mount } from './view';

// Caller state and generated notation only; real editor/fonts/keyboard need browser QA.
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const node = document.createElement('div'); node.textContent = latex; node.setAttribute('aria-label', label); node.dataset.equation = 'true'; return node; },
  createEquationInput: (options: EquationInputOptions) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = (): EquationDraft => ({ latex: field.value, empty: !field.value.trim(), hasPlaceholders: false, syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, focus: () => field.focus(), destroy };
  },
}));
afterEach(() => document.body.replaceChildren());
function visit() {
  const container = document.createElement('div'); container.dataset.module = 'CR03'; document.body.append(container); const controller = new AbortController(), cleanup = mount({ container, signal: controller.signal });
  const click = (label: string) => { const node = [...container.querySelectorAll('button')].find(node => node.textContent === label)!; node.click(); return node; };
  const field = (label: string) => container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  const change = (label: string, value: string) => { const node = field(label); node.value = value; node.dispatchEvent(new Event('input', { bubbles: true })); };
  const reveal = () => click('Reveal construction & coordinate check');
  const answers = () => container.querySelector<HTMLElement>('[data-ui="answers"]')!;
  const equation = (label: string) => container.querySelector<HTMLElement>(`[aria-label="${label}"]`)!.textContent!;
  return { container, click, field, change, reveal, answers, equation, close: () => { controller.abort(); cleanup?.(); } };
}

describe('CR03 exercise state and representation flow', () => {
  it('clears a checked answer when hidden grouping is rejected and recovers with visible parentheses', () => {
    const view=visit();view.reveal();view.change('Given transfer function',String.raw`\frac1{{s+2}s}`);view.click('Apply given model');
    expect(view.answers().hidden).toBe(true);expect(view.container.textContent).toContain('visible parentheses');view.reveal();expect(view.answers().hidden).toBe(true);
    view.change('Given transfer function',String.raw`\frac1{(s+2)s}`);view.click('Apply given model');view.click('Use canonical construction');view.reveal();expect(view.answers().hidden).toBe(false);expect(view.container.textContent).toContain('candidate reproduces');view.close();
  });
  it('reveals the baseline and maps nonzero initial data through the proposed physical coordinates', () => {
    const view = visit(); view.reveal(); expect(view.answers().hidden).toBe(false); expect(view.container.textContent).toContain('candidate reproduces');
    view.click('Numerator / input-derivative example'); view.click('Output-derivative coordinates'); view.click('Nonzero initial state'); view.change('Predict y(0+)', '4'); view.reveal();
    expect(view.equation('Mapped initial states')).toContain('4\\\\-2');
    expect(view.equation('Physical derivative-corrected state equations')).toContain('\\begin{bmatrix}1\\\\1\\end{bmatrix}u');
    expect(view.equation('Modified state w 2')).toBe("w_2=y'-(1)u");
    expect(view.container.textContent).toContain('prediction agrees'); view.close();
  });
  it('accepts an input/output-equivalent candidate with different matrix entries', () => {
    const view = visit();
    for (const [label, value] of [['A row 1 column 1', 1 / 7], ['A row 1 column 2', 12 / 7], ['A row 2 column 1', -10 / 7], ['A row 2 column 2', -22 / 7], ['B row 1 column 1', -1], ['B row 2 column 1', 3], ['C row 1 column 1', 3 / 7], ['C row 1 column 2', 1 / 7]] as const) view.change(label, String(value));
    view.reveal(); expect(view.container.textContent).toContain('candidate reproduces');
    view.change('C row 1 column 1', '1'); view.reveal(); expect(view.container.textContent).toContain('candidate differs'); expect(view.answers().hidden).toBe(false); view.close();
  });
  it('invalidates a changed given and applies ordinary visual ODE data separately from initial state', () => {
    const view = visit(); view.click('Nonzero initial state'); view.reveal();
    view.change('Given form', 'ode'); view.change('Given linear ODE', "y''+3y'+2y=2u''+7u'+9u"); view.reveal();
    expect(view.answers().hidden).toBe(true); expect(view.container.textContent).toContain('Apply the given model');
    view.click('Apply given model'); expect(view.field('x1(0−)').value).toBe('0');
    view.click('Use canonical construction'); view.change('Predict y(0+)', '2'); view.reveal();
    expect(view.equation('Direct term and strictly proper remainder')).toContain('D=2');
    expect(view.equation('Canonical state and output equations')).toContain('\\begin{bmatrix}5&1\\end{bmatrix}');
    expect(view.container.textContent).toContain('prediction agrees'); view.close();
  });
  it('recovers a supplied hidden mode without claiming a unique canonical initial state', () => {
    const view = visit(); view.click('Hidden mode example'); view.click('Nonzero initial state'); view.reveal();
    expect(view.equation('Applied zero-state transfer function')).toContain('s^{2}+s-2');
    expect(view.container.textContent).toContain('controllability rank 1/2'); expect(view.container.textContent).toContain('observability rank 2/2');
    expect(view.container.textContent).toContain('need not have an invertible state map'); view.close();
  });
  it('hides stale answers for singular T or native numeric underflow', () => {
    const view = visit(); view.reveal();
    view.change('T row 1 column 2', '1'); view.change('T row 2 column 1', '1'); view.reveal();
    expect(view.answers().hidden).toBe(true); expect(view.container.textContent).toContain('singular');
    view.click('Identity coordinates'); view.change('T row 1 column 1', '1e-999'); view.reveal();
    expect(view.answers().hidden).toBe(true); expect(view.container.textContent).toContain('nonzero but too small'); view.close();
  });
  it('does not accept a zero candidate as equivalent to a small nonzero given gain', () => {
    const view = visit(); view.change('Given transfer function', 'G(s)=0.0000000001/(s+1)'); view.click('Apply given model');
    view.change('Matrix dimension', '0'); view.reveal(); expect(view.answers().hidden).toBe(false);
    expect(view.container.textContent).toContain('candidate differs'); view.close();
  });
  it('handles a native static matrix gain and the output jump without state rows', () => {
    const view = visit(); view.change('Given form', 'matrix'); view.change('Matrix dimension', '0'); view.change('D direct term', '3'); view.click('Apply given model');
    view.change('Constant command u (t ≥ 0)', '2'); view.change('Predict y(0+)', '6'); view.reveal();
    expect(view.answers().hidden).toBe(false); expect(view.container.textContent).toContain('no dynamic states'); expect(view.container.textContent).toContain('both outputs are approximately 6');
    expect(view.container.querySelectorAll('[data-ui="rows"] button').length).toBe(0); view.close();
  });
  it('rejects mixed-number given data without retaining a previous result and can recover a fourth-order model', () => {
    const view = visit(); view.reveal(); view.change('Given transfer function', String.raw`G(s)=2\frac12`); view.click('Apply given model'); view.reveal();
    expect(view.answers().hidden).toBe(true);
    view.change('Given transfer function', 'G(s)=1/((s+1)(s+2)(s+3)(s+4))'); view.click('Apply given model'); view.click('Use canonical construction'); view.reveal();
    expect(view.answers().hidden).toBe(false); expect(view.container.querySelectorAll('[data-ui="rows"] button').length).toBe(4);
    expect(view.container.textContent).toContain('candidate reproduces'); view.close();
  });
  it('keeps generated mathematical notation valid for the supplied examples and a static gain', () => {
    const view = visit();
    for (const preset of ['Baseline', 'Numerator / input-derivative example', 'Biproper example', 'Hidden mode example']) {
      view.click(preset); view.reveal();
      for (const node of view.container.querySelectorAll<HTMLElement>('[data-equation]')) expect(validateLatex(node.textContent!), node.getAttribute('aria-label')!).toEqual([]);
    }
    view.close();
  });
  it('captures Escape before raw-notation handling and destroys old state/listeners on abort', () => {
    const previous = window.mathVirtualKeyboard, hide = vi.fn(); Object.defineProperty(window, 'mathVirtualKeyboard', { value: { hide }, configurable: true });
    try {
      const first = visit(), field = first.field('Given transfer function'), editor = vi.fn(); field.addEventListener('keydown', editor);
      const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); field.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(true); expect(editor).not.toHaveBeenCalled(); expect(hide).toHaveBeenCalledOnce();
      first.click('Nonzero initial state'); const old = first.click('Shear coordinates'); first.close();
      const second = visit(); old.click(); expect(second.field('x1(0−)').value).toBe('0'); expect(second.field('T row 1 column 2').value).toBe('0');
      field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(hide).toHaveBeenCalledOnce(); second.close(); expect(second.container.children.length).toBe(0);
    } finally { Object.defineProperty(window, 'mathVirtualKeyboard', { value: previous, configurable: true }); }
  });
});
