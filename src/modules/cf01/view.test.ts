import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const el = document.createElement('p'); el.textContent = label + ': ' + value; return el; },
  createEquationInput: (options: { value: string; label: string; signal: AbortSignal; onChange: (value: unknown) => void }) => {
    const element = document.createElement('div'), field = document.createElement('textarea'); field.value = options.value; field.setAttribute('aria-label', options.label); element.append(field);
    const getValue = () => ({ latex: field.value, empty: !field.value, hasPlaceholders: false, syntaxIssues: [] });
    field.addEventListener('input', () => options.onChange(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { field.value = value; }, destroy: () => element.remove() };
  },
}));
import { mount } from './view';
const visits: (() => void)[] = [];
afterEach(() => { visits.splice(0).forEach(close => close()); document.body.replaceChildren(); });
function visit() {
  const container = document.createElement('div'), controller = new AbortController(); container.dataset.module = 'CF01'; document.body.append(container);
  const cleanup = mount({ container, signal: controller.signal });
  const close = () => { controller.abort(); cleanup?.(); }; visits.push(close);
  const click = (name: string) => container.querySelector<HTMLButtonElement>('[data-action="' + name + '"]')!.click();
  const input = (name: string, value: string) => { const el = container.querySelector<HTMLInputElement>('[name="' + name + '"]')!; el.value = value; el.dispatchEvent(new Event('input')); };
  const select = (name: string, value: string) => { const el = container.querySelector<HTMLSelectElement>('[name="' + name + '"]')!; el.value = value; el.dispatchEvent(new Event('change')); };
  const equation = (value: string) => { const el = container.querySelector('textarea')!; el.value = value; el.dispatchEvent(new Event('input')); };
  return { container, click, input, select, equation, close };
}
describe('CF01 exercise flow (mocked equation UI)', () => {
  it('separates the4s guideline from measured settling and checks the student prediction', () => {
    const v = visit(); expect(v.container.querySelectorAll('svg')).toHaveLength(2);
    v.select('prediction', 'not'); v.click('reveal');
    expect(v.container.querySelector('.cf1-feedback')!.textContent).toContain('Correct.');
    expect(v.container.querySelector('.cf1-table')!.textContent).toContain('4 s (approximate)');
    expect(v.container.querySelector('.cf1-table')!.textContent).toContain('4.038174 s');
  });
  it('adds a slow pole without replacing edited target-pair data and permits a longer horizon', () => {
    const v = visit(), changed = '16/(s^2+4s+16)'; v.equation(changed); v.click('slow'); v.click('reveal');
    expect(v.container.querySelector('textarea')!.value).toBe(changed);
    expect(v.container.querySelector('.cf1-status')!.textContent).toContain('Not established');
    expect(v.container.querySelector('.cf1-reasoning')!.textContent).toContain('-0.2');
    v.input('horizon', '40'); v.click('compute');
    expect(v.container.querySelector('.cf1-status')!.textContent).not.toContain('Not established');
    v.click('remove'); expect(v.container.querySelector<HTMLInputElement>('[name="include-pole"]')!.checked).toBe(false);
  });
  it('clears stale output on native underflow, accepts ordinary exponents and preserves a valid cursor plot', () => {
    const v = visit(), prior = v.container.querySelector('.cf1-response')!.innerHTML;
    v.input('time', '1e-400'); expect(v.container.querySelector('.cf1-inspection')!.textContent).toContain('nonzero but too small');
    expect(v.container.querySelector('.cf1-response')!.innerHTML).toBe(prior);
    v.input('time', '0e-400'); expect(v.container.querySelector('.cf1-inspection')!.textContent).toContain('At t=0 s');
    v.click('reveal'); v.input('horizon', '1e-400'); v.click('compute');
    expect(v.container.querySelector('.cf1-status')!.textContent).toContain('nonzero but too small');
    expect(v.container.querySelector('svg')).toBeNull(); expect(v.container.querySelector<HTMLElement>('.cf1-answer')!.hidden).toBe(true);
    v.input('horizon', '1e1'); v.click('compute'); expect(v.container.querySelector('.cf1-status')!.textContent).toContain('0…10 s');
  });
  it('reports visual meaning errors and keeps band/rise edits isolated from old answers', () => {
    const v = visit(); v.click('reveal'); v.equation('4/(s^(2)+2s+4)'); v.click('compute');
    expect(v.container.querySelector('.cf1-status')!.textContent).toContain('power box'); expect(v.container.querySelector('svg')).toBeNull();
    v.equation('4/(s^{2}+2s+4)'); v.click('compute'); v.click('reveal'); v.select('band', '5');
    expect(v.container.querySelector<HTMLElement>('.cf1-answer')!.hidden).toBe(true);
    v.select('rise', '0-100'); v.click('compute'); v.click('reveal');
    expect(v.container.querySelector('.cf1-table')!.textContent).toContain('2.644547 s');
    expect(v.container.querySelector('.cf1-table')!.textContent).toContain('1.2092 s');
  });
  it('restores all baseline data and a fresh visit after a zero experiment', () => {
    const v = visit(); v.click('zero'); v.click('reveal');
    expect(v.container.querySelector('.cf1-reasoning')!.textContent).toContain('Added zero at 1');
    v.click('baseline'); expect(v.container.querySelector<HTMLInputElement>('[name="include-zero"]')!.checked).toBe(false);
    expect(v.container.querySelector<HTMLInputElement>('[name="horizon"]')!.value).toBe('10');
    expect(v.container.querySelector<HTMLElement>('.cf1-answer')!.hidden).toBe(true); v.close();
    const next = visit(); expect(next.container.querySelector('textarea')!.value).toContain('s^2+2s+4');
    expect(next.container.querySelector<HTMLInputElement>('[name="pole"]')!.disabled).toBe(true);
  });
});
