import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({
  createEquationInput: (options: { label: string; value: string; signal: AbortSignal; onChange?: (draft: unknown) => void }) => {
    const element = document.createElement('div'), input = document.createElement('textarea'); input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    const getValue = () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: input.value.includes('\\placeholder'), syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal });
    const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (v: string) => { input.value = v; }, destroy, focus: () => input.focus() };
  },
  createEquationDisplay: (latex: string, label: string) => { const e = document.createElement('div'); e.setAttribute('aria-label', label); e.textContent = latex; return e; },
}));
import { mountView } from './view';
const hide = vi.fn();
beforeEach(() => { Object.defineProperty(window, 'mathVirtualKeyboard', { configurable: true, value: { hide } }); hide.mockClear(); });
afterEach(() => { document.body.replaceChildren(); });
function open() {
  const container = document.createElement('div'), controller = new AbortController(); container.dataset.module = 'CS05'; document.body.append(container);
  const cleanup = mountView({ container, signal: controller.signal });
  const field = <T extends HTMLElement = HTMLInputElement>(label: string) => container.querySelector<T>(`[aria-label="${label}"]`)!;
  const button = (name: string) => [...container.querySelectorAll('button')].find(b => b.textContent === name)!;
  const change = (label: string, value: string) => { const input = field<HTMLInputElement>(label); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const reveal = () => button('Derive intervals and reveal').click();
  const close = () => { controller.abort(); if (typeof cleanup === 'function') cleanup(); };
  return { container, controller, field, button, change, reveal, close };
}
describe('CS05 complete exercise wiring with presentation mocked only', () => {
  it('requires reveal, gives the complete audited interval and checks independent predictions', () => {
    const t = open(); expect(t.container.querySelector<HTMLElement>('.cs05-output')!.hidden).toBe(true);
    t.change('Your selected-gain prediction', 'Strictly stable'); t.change('Your number of stable intervals', '1'); t.change('Your unbounded stable-tail prediction', 'No'); t.reveal();
    expect(t.container.textContent).toContain('K\\in(0,70)'); expect(t.container.textContent).toContain('Gain prediction matches'); expect(t.container.textContent).toContain('Interval count matches'); expect(t.container.textContent).toContain('Tail prediction matches');
    expect(t.container.querySelectorAll('tbody tr')).toHaveLength(3); expect(t.container.querySelectorAll('svg')).toHaveLength(2); t.close(); expect(t.container.children.length).toBe(0);
  });
  it('updates the full root list and exact gain verdict from equation/range controls', () => {
    const t = open(); t.reveal(); t.change('Selected gain K', '80'); expect(t.container.textContent).toContain('Not strictly stable'); expect(t.container.querySelectorAll('tbody tr')).toHaveLength(3);
    t.change('Gain cursor', '20'); expect(t.field<HTMLTextAreaElement>('Selected gain K').value).toBe('20'); expect(t.container.textContent).toContain('Strictly stable: every exact'); t.close();
  });
  it('exposes two complete stable ranges and changed cubic48 without stacking models', () => {
    const t = open(); t.button('Two stable ranges').click(); t.reveal(); expect(t.container.textContent).toContain('(\\frac{1}{3},1)\\cup(3,\\infty)');
    t.button('Changed cubic').click(); expect(t.container.querySelector<HTMLElement>('.cs05-output')!.hidden).toBe(true); t.reveal(); expect(t.container.textContent).toContain('K\\in(0,48)'); t.close();
  });
  it('retains an exact irrational endpoint across repeated reveals and clears it on a real edit', () => {
    const t = open(); t.button('Irrational boundaries').click(); t.reveal(); t.button('Inspect endpoint 3').click();
    expect(t.container.textContent).toContain('Not strictly stable'); expect(t.container.textContent).toContain('retains the exact algebraic endpoint'); expect(t.field<HTMLTextAreaElement>('Selected gain K').value).toContain('sqrt');
    t.reveal(); expect(t.container.textContent).toContain('retains the exact algebraic endpoint'); expect(t.container.textContent).not.toContain('Selected gain needs attention');
    t.change('Selected gain K', '.5'); expect(t.container.textContent).toContain('Strictly stable: every exact'); expect(t.container.textContent).not.toContain('retains the exact algebraic endpoint');
    t.button('Inspect endpoint 4').click(); t.button('Course cubic').click(); expect(t.field<HTMLTextAreaElement>('Selected gain K').value).toBe('20'); t.reveal(); expect(t.container.textContent).toContain('K\\in(0,70)'); t.close();
  });
  it('inspects every baseline endpoint using the same full characteristic polynomial', () => {
    const t = open(); t.reveal(); t.button('Inspect endpoint 2').click(); expect(t.container.textContent).toContain('K=70'); expect(t.container.textContent).toContain('3.1622777'); expect(t.container.textContent).toContain('remaining pole≈−a₂=-7');
    expect(t.container.textContent).toContain('Not strictly stable'); expect(t.container.querySelectorAll('tbody tr')).toHaveLength(3);
    t.button('Inspect endpoint 1').click(); expect(t.container.textContent).toContain('K=0'); expect(t.container.querySelectorAll('tbody tr')).toHaveLength(3); t.close();
  });
  it.each(['1e-999', '-1e-999'])('rejects native nonzero plot underflow%s and hides stale results', value => {
    const t = open(); t.reveal(); t.change('Locus maximum gain', value); t.reveal(); expect(t.container.textContent).toContain('nonzero but too small'); expect(t.container.querySelector<HTMLElement>('.cs05-output')!.hidden).toBe(true); t.close();
  });
  it('accepts native ordinary exponents and handles a fine range cursor without uncaught exact-parser errors', () => {
    const t = open(); t.change('Locus maximum gain', '1e2'); t.reveal(); expect(t.container.querySelector<HTMLElement>('.cs05-output')!.hidden).toBe(false);
    t.change('Locus maximum gain', '.00123456789123'); t.reveal(); t.change('Gain cursor', '.00000123456789123'); expect(t.container.textContent).toContain('Strictly stable: every exact'); t.close();
  });
  it.each(['0', '0e-999', '-1', '10001'])('retains local plot range limits for%s', value => {
    const t = open(); t.change('Locus maximum gain', value); t.reveal(); expect(t.container.textContent).toContain('from0.001 to10,000'); t.close();
  });
  it.each(['', '\\placeholder{}', '2\\frac12', '1e-2', 's'])('explains invalid gain%s without replacing valid exact intervals', value => {
    const t = open(); t.reveal(); t.change('Selected gain K', value); expect(t.container.textContent).toContain('Selected gain needs attention'); expect(t.container.textContent).toContain('K\\in(0,70)'); expect(t.container.querySelectorAll('tbody tr')).toHaveLength(0); t.close();
  });
  it('uses the shared native reader for optional count predictions too', () => {
    const t = open(); t.change('Your number of stable intervals', '1e-999'); t.reveal(); expect(t.container.textContent).toContain('nonzero but too small');
    t.change('Your number of stable intervals', '0e-999'); t.reveal(); expect(t.container.textContent).toContain('There is 1 stable interval'); t.close();
  });
  it('rejects unsupported model degrees and clears previous derived output', () => {
    const t = open(); t.reveal(); t.change('Fixed numerator N(s)', 's^3'); t.reveal(); expect(t.container.textContent).toContain('strictly lower numerator degree'); expect(t.container.querySelector<HTMLElement>('.cs05-output')!.hidden).toBe(true); t.close();
  });
  it('has independent visits and signal-owned Escape handling', () => {
    const t = open(), field = t.field('Selected gain K'), later = vi.fn(); field.addEventListener('keydown', later);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); field.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); expect(later).not.toHaveBeenCalled(); expect(hide).toHaveBeenCalledOnce();
    t.button('Two stable ranges').click(); t.reveal(); t.close(); const next = open(); expect(next.field<HTMLTextAreaElement>('Fixed numerator N(s)').value).toBe('1'); expect(next.field<HTMLTextAreaElement>('Selected gain K').value).toBe('20'); expect(next.container.querySelector<HTMLElement>('.cs05-output')!.hidden).toBe(true); next.close();
  });
});
