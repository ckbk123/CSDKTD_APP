import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({
  createEquationInput: (options: { label: string; value: string; signal: AbortSignal; onChange?: (draft: unknown) => void }) => {
    const element = document.createElement('div'), input = document.createElement('textarea'); input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    const getValue = () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: input.value.includes('\\placeholder'), syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange?.(getValue()), { signal: options.signal }); const destroy = () => element.remove(); options.signal.addEventListener('abort', destroy, { once: true });
    return { element, getValue, setValue: (v: string) => { input.value = v; }, destroy, focus: () => input.focus() };
  },
  createEquationDisplay: (latex: string, label: string) => { const e = document.createElement('div'); e.setAttribute('aria-label', label); e.textContent = latex; return e; },
}));
import { mountView } from './view';
const hide = vi.fn();
beforeEach(() => { Object.defineProperty(window, 'mathVirtualKeyboard', { configurable: true, value: { hide } }); hide.mockClear(); });
afterEach(() => { document.body.replaceChildren(); });
function open() {
  const container = document.createElement('div'), controller = new AbortController(); container.dataset.module = 'CF05'; document.body.append(container); const cleanup = mountView({ container, signal: controller.signal });
  const field = <T extends HTMLElement = HTMLInputElement>(label: string) => container.querySelector<T>(`[aria-label="${label}"]`)!;
  const button = (name: string) => [...container.querySelectorAll('button')].find(b => b.textContent === name)!;
  const change = (label: string, value: string) => { const input = field<HTMLInputElement>(label); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const prepare = () => button('Prepare frequency estimate').click(), reveal = () => button('Reveal full response').click(), close = () => { controller.abort(); if (typeof cleanup === 'function') cleanup(); };
  return { container, field, button, change, prepare, reveal, close };
}
describe('CF05 conditional estimate and complete response exercise', () => {
  it('withholds the full response, then retains both estimate and checked result with student feedback', () => {
    const t = open(); expect(t.container.querySelectorAll('svg')).toHaveLength(0); t.prepare(); expect(t.container.querySelectorAll('svg')).toHaveLength(1);
    expect(t.container.textContent).toContain('Second-order estimate:'); expect(t.container.textContent).not.toContain('Full response: overshoot');
    t.change('Predicted full overshoot (%)', '7.925'); t.change('Predicted full settling time (s)', '1'); t.change('Assumption explanation', 'modes'); t.reveal();
    expect(t.container.querySelectorAll('svg')).toHaveLength(2); expect(t.container.textContent).toContain('Second-order estimate:'); expect(t.container.textContent).toContain('overshoot prediction matches');
    expect(t.container.textContent).toContain('settling prediction differs'); expect(t.container.textContent).toContain('Explanation: appropriate'); expect(t.container.querySelectorAll('[aria-label="Full characteristic pole"]')).toHaveLength(3); expect(t.container.textContent).toContain('4.321392%'); t.close();
  });
  it('preserves a comparison while changing gain and clears it deliberately', () => {
    const t = open(); t.prepare(); t.reveal(); t.button('Keep this result for comparison').click(); expect(t.container.textContent).toContain('Retained comparison');
    t.change('Loop gain multiplier', '2'); expect(t.container.querySelector('[aria-label="Retained loop"]')).not.toBeNull(); t.prepare(); t.reveal();
    expect(t.container.querySelectorAll('.cf05-previous')).toHaveLength(1); t.button('Clear retained result').click(); expect(t.container.querySelectorAll('.cf05-previous')).toHaveLength(0); t.close();
  });
  it('changes the real zero without changing its constant and adds the actual loop pole', () => {
    const t = open(); t.button('Move real zero; keep numerator constant term').click(); expect(t.field<HTMLTextAreaElement>('Loop numerator N(s)').value).toBe('8s+32');
    t.field<HTMLInputElement>('Add a loop pole').checked = true; t.field('Add a loop pole').dispatchEvent(new Event('input', { bubbles: true })); t.change('Added loop-pole rate (s⁻¹)', '2');
    t.prepare(); t.reveal(); expect(t.container.querySelectorAll('[aria-label="Full characteristic pole"]')).toHaveLength(4); t.close();
  });
  it('offers the bandwidth route and a canonical changed-data check', () => {
    const t = open(); t.button('Canonical second-order loop').click(); t.change('Estimate frequency route', 'bandwidth'); t.prepare(); t.reveal();
    expect(t.container.textContent).toContain('Route:bandwidth'); expect(t.container.textContent).toContain('16.303'); expect(t.container.textContent).toContain('strictly Hurwitz'); t.close();
  });
  it('keeps insufficient-horizon and heuristic-ineligible results honest', () => {
    const t = open(); t.change('Response horizon (s)', '.5'); t.prepare(); t.reveal(); expect(t.container.textContent).toContain('settlingnot established'); expect(t.container.textContent).toContain('Settling is not established');
    t.button('Inverse-response variation').click(); t.prepare(); expect(t.container.textContent).toContain('nonminimum-phase'); t.reveal(); expect(t.container.textContent).toContain('Full response:'); t.close();
  });
  it.each(['Loop gain multiplier', 'Response horizon (s)', 'Predicted full overshoot (%)', 'Response cursor time (s)'])('rejects native underflow in%s and recovers', label => {
    const t = open(); t.prepare(); t.reveal(); t.change(label, '1e-999'); if (label === 'Response cursor time (s)') { expect(t.field(label).isConnected).toBe(true); } else t.reveal();
    expect(t.container.textContent).toContain('nonzero but too small'); t.change(label, label === 'Response horizon (s)' ? '12' : '1'); t.prepare(); t.reveal(); expect(t.container.textContent).toContain('Full response:'); t.close();
  });
  it('preserves normal native exponent/intentional zero cursor and hides stale output on invalid notation', () => {
    const t = open(); t.change('Loop gain multiplier', '1e0'); t.prepare(); t.reveal(); t.change('Response cursor time (s)', '0e-999'); expect(t.container.textContent).toContain('Nearest response sample:t=0s,y=0');
    t.change('Loop numerator N(s)', String.raw`\frac1\;2`); t.prepare(); expect(t.container.textContent).toContain('blank space cannot fill a box'); expect(t.container.querySelectorAll('section:not([hidden]) svg')).toHaveLength(0); t.close();
  });
  it('keeps an invalid response cursor recoverable without re-solving or leaving', () => {
    const t = open(); t.prepare(); t.reveal(); t.change('Response cursor time (s)', '-1'); expect(t.container.textContent).toContain('Choose response cursor'); expect(t.field('Response cursor time (s)').isConnected).toBe(true);
    t.change('Response cursor time (s)', '2'); expect(t.container.textContent).toContain('Nearest response sample:t=2'); t.close();
  });
  it('dismisses the math keyboard and resets every exercise state on independent visits', () => {
    const t = open(); const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); t.field('Loop numerator N(s)').dispatchEvent(event); expect(event.defaultPrevented).toBe(true); expect(hide).toHaveBeenCalledOnce();
    t.prepare(); t.reveal(); t.button('Keep this result for comparison').click(); t.close(); const next = open(); expect(next.field<HTMLTextAreaElement>('Loop numerator N(s)').value).toBe('12(s+8/3)'); expect(next.field<HTMLInputElement>('Loop gain multiplier').value).toBe('1'); expect(next.container.querySelectorAll('svg')).toHaveLength(0); next.close();
  });
});
