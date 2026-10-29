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
  const container = document.createElement('div'), controller = new AbortController(); container.dataset.module = 'CP05'; document.body.append(container); const cleanup = mountView({ container, signal: controller.signal });
  const field = <T extends HTMLElement = HTMLInputElement>(label: string) => container.querySelector<T>(`[aria-label="${label}"]`)!;
  const button = (name: string) => [...container.querySelectorAll('button')].find(b => b.textContent === name)!;
  const change = (label: string, value: string) => { const input = field<HTMLInputElement>(label); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); };
  const prepare = () => button('Prepare contour').click(), reveal = () => button('Reveal checked curve').click(), close = () => { controller.abort(); if (typeof cleanup === 'function') cleanup(); };
  return { container, field, button, change, prepare, reveal, close };
}
describe('CP05 contour/prediction/frequency exercise wiring', () => {
  it('shows the source and predicted point before revealing the computed curve', () => {
    const t = open(); expect(t.container.querySelector<HTMLElement>('.cp05-workspace')!.hidden).toBe(true); t.prepare(); expect(t.container.querySelectorAll('svg')).toHaveLength(2);
    expect(t.container.querySelector('[aria-label="Selected mapped coordinates"]')).toBeNull(); t.change('Predicted mapped real part', '.4'); t.change('Predicted mapped imaginary part', '-1.2'); t.button('Add predicted point').click();
    expect(t.container.querySelectorAll('.cp05-prediction')).toHaveLength(1); expect(t.container.querySelector('[aria-label="Selected mapped coordinates"]')).toBeNull();
    t.reveal(); expect(t.container.querySelectorAll('svg')).toHaveLength(4); expect(t.container.textContent).toContain('Prediction1: matches'); expect(t.container.querySelector('[aria-label="Checked frequency response"]')!.textContent).toContain('0.4-1.2j');
    t.close(); expect(t.container.children.length).toBe(0);
  });
  it('keeps three source-associated predictions bounded and clears them deliberately', () => {
    const t = open(); t.prepare(); t.change('Predicted mapped real part', '0'); t.change('Predicted mapped imaginary part', '0');
    for (const w of ['1', '2', '3']) { t.change('Bode frequency ω (rad/s)', w); t.button('Add predicted point').click(); }
    expect(t.container.querySelectorAll('.cp05-prediction')).toHaveLength(3); t.button('Add predicted point').click(); expect(t.container.textContent).toContain('Three predictions are already');
    t.reveal(); expect(t.container.querySelectorAll('[aria-label="Prediction source and placed point"]')).toHaveLength(3); t.button('Clear predictions').click(); expect(t.container.querySelectorAll('.cp05-prediction')).toHaveLength(0); t.close();
  });
  it('separates an origin indent point from the undefined Bode value and exposes the limit', () => {
    const t = open(); t.button('Origin pole').click(); t.prepare(); t.change('Bode frequency ω (rad/s)', '0'); t.reveal();
    expect(t.container.querySelector('[aria-label="Selected contour coordinates"]')!.textContent).toContain('0.1+0j'); expect(t.container.textContent).toContain('off-axis arc point');
    expect(t.container.querySelector('[aria-label="Selected mapped coordinates"]')!.textContent).toContain('10+0j'); expect(t.container.textContent).toContain('denominator is zero'); expect(t.container.textContent).toContain('unbounded, locally of order ε^−1'); t.close();
  });
  it('retains the original excluded removable point instead of silently canceling it', () => {
    const t = open(); t.button('Removable original point').click(); t.prepare(); t.change('Bode frequency ω (rad/s)', '0'); t.reveal();
    expect(t.container.textContent).toContain('original N/D is still undefined'); expect(t.container.querySelector('[aria-label="Finite removable extension"]')!.textContent).toContain('1+0j'); t.close();
  });
  it('updates every sample cursor without treating off-axis arcs as frequency evaluations', () => {
    const t = open(); t.prepare(); t.reveal(); const max = t.field<HTMLInputElement>('Contour sample index').max;
    t.change('Contour sample index', String(Number(max) - 64)); expect(t.container.textContent).toContain('Contour part: closing outer semicircle'); expect(t.container.textContent).toContain('off-axis arc point');
    t.change('Contour sample cursor', '0'); expect(t.container.textContent).toContain('negative-frequency trace'); expect(t.field<HTMLInputElement>('Bode frequency ω (rad/s)').value).toBe('10'); t.close();
  });
  it('reports selected values clipped outside the mapped window and recovers live', () => {
    const t = open(); t.prepare(); t.reveal(); t.change('Mapped half-span (gain units)', '.01'); expect(t.container.textContent).toContain('selected checked value is outside');
    t.change('Mapped half-span (gain units)', '3'); expect(t.container.textContent).not.toContain('selected checked value is outside'); t.close();
  });
  it.each([
    ['Contour radius R (s⁻¹)', '1e-999', 'Prepare contour'],
    ['Indent radius ε (s⁻¹)', '1e-999', 'Prepare contour'],
    ['Bode frequency ω (rad/s)', '1e-999', 'Reveal checked curve'],
    ['Contour sample index', '1e-999', 'Reveal checked curve'],
    ['Mapped half-span (gain units)', '1e-999', 'Reveal checked curve'],
  ])('rejects native nonzero underflow in%s', (label, value, action) => {
    const t = open(); t.prepare(); t.reveal(); t.change(label, value); t.button(action).click(); expect(t.container.textContent).toContain('nonzero but too small'); t.close();
  });
  it('preserves ordinary native exponents and genuine zero in a valid frequency cursor', () => {
    const t = open(); t.change('Contour radius R (s⁻¹)', '1e1'); t.prepare(); t.change('Bode frequency ω (rad/s)', '0e-999'); t.reveal();
    expect(t.container.querySelector('[aria-label="Checked frequency response"]')!.textContent).toContain('2+0j'); t.change('Bode frequency ω (rad/s)', '1e0'); expect(t.container.querySelector('[aria-label="Checked frequency response"]')!.textContent).toContain('0.4-1.2j'); t.close();
  });
  it('keeps model/cursor error recovery usable and hides stale computed plots', () => {
    const t = open(); t.prepare(); t.reveal(); t.change('Bode frequency ω (rad/s)', '11'); expect(t.container.textContent).toContain('Choose Bode frequency'); expect(t.container.querySelectorAll('svg')).toHaveLength(4); // old nodes are hidden, never shown as a fresh result
    const plotsHost = t.container.querySelector('.cp05-plots')!.parentElement!; expect(plotsHost.hidden).toBe(true); t.change('Bode frequency ω (rad/s)', '1'); expect(plotsHost.hidden).toBe(false);
    t.change('Loop numerator N(s)', String.raw`\frac1\;2`); t.prepare(); expect(t.container.querySelector<HTMLElement>('.cp05-workspace')!.hidden).toBe(true); expect(t.container.textContent).toContain('Complete both fraction boxes'); t.close();
  });
  it('rejects a contour through a pole and can recover with a changed radius', () => {
    const t = open(); t.button('Unstable open-loop example').click(); t.change('Contour radius R (s⁻¹)', '1'); t.prepare(); expect(t.container.textContent).toContain('outer semicircle');
    t.change('Contour radius R (s⁻¹)', '5'); t.prepare(); t.reveal(); expect(t.container.querySelectorAll('svg')).toHaveLength(4); t.close();
  });
  it('guards signal-owned keyboard handling and independent visits', () => {
    const t = open(), input = t.field('Loop numerator N(s)'), later = vi.fn(); input.addEventListener('keydown', later);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }); input.dispatchEvent(event); expect(event.defaultPrevented).toBe(true); expect(later).not.toHaveBeenCalled(); expect(hide).toHaveBeenCalledOnce();
    t.button('Repeated origin pole').click(); t.prepare(); t.reveal(); t.close(); const next = open(); expect(next.field<HTMLTextAreaElement>('Loop numerator N(s)').value).toBe('4'); expect(next.field<HTMLInputElement>('Bode frequency ω (rad/s)').value).toBe('1'); expect(next.container.querySelector<HTMLElement>('.cp05-workspace')!.hidden).toBe(true); next.close();
  });
});
