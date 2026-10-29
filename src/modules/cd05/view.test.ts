import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const out = document.createElement('div'); out.textContent = latex; out.setAttribute('aria-label', label); return out; },
  createEquationInput: (options: { label: string; value: string; signal: AbortSignal; onChange: (value: unknown) => void }) => {
    const element = document.createElement('div'), input = document.createElement('input');
    input.setAttribute('aria-label', options.label); input.value = options.value; element.append(input);
    const getValue = () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: /\\placeholder/.test(input.value), syntaxIssues: [] });
    input.addEventListener('input', () => options.onChange(getValue()), { signal: options.signal });
    return { element, getValue, setValue: (value: string) => { input.value = value; }, destroy: () => element.remove() };
  },
}));
import { mount } from './view';
import { parseLead } from './input';
const visits: { controller: AbortController; cleanup: ReturnType<typeof mount> }[] = [];
function open(): HTMLElement {
  const container = document.createElement('div'), controller = new AbortController(); document.body.append(container);
  visits.push({ controller, cleanup: mount({ container, signal: controller.signal }) }); return container;
}
afterEach(() => { visits.splice(0).forEach(v => { v.controller.abort(); if (typeof v.cleanup === 'function') v.cleanup(); }); document.body.replaceChildren(); });
function click(root: HTMLElement, text: string): void { const out = [...root.querySelectorAll('button')].find(b => b.textContent === text); expect(out).toBeDefined(); out!.click(); }
function control(root: HTMLElement, label: string): HTMLInputElement { const out = root.querySelector<HTMLInputElement>('[aria-label="' + label + '"]'); expect(out).not.toBeNull(); return out!; }
function change(input: HTMLInputElement, value: string): void { input.value = value; input.dispatchEvent(new Event('input')); }
const reveal = (root: HTMLElement): void => click(root, 'Reveal full-loop checks');
const output = (root: HTMLElement): HTMLElement => root.querySelector('.cd05-results')!;

describe('CD05 teaching flow with public equation API stub', () => {
  it('reveals the actual source crossover, full characteristic and response comparison', () => {
    const root = open(); expect(output(root).hidden).toBe(true); reveal(root);
    expect(root.querySelector('[aria-label="Actual crossover and phase margin comparison"]')!.textContent).toContain('64.47122');
    expect(root.querySelector('[aria-label="Velocity constant and unit-ramp error"]')!.textContent).toContain('0.5');
    expect(root.textContent).toContain('Proposal: 3 physical states'); expect(root.textContent).toContain('Baseline: 2 physical states');
    expect(root.querySelectorAll('svg')).toHaveLength(5); expect(root.textContent).toContain('Meets — Actual phase margin');
    expect(root.textContent).toContain('Meets — Sampled 2% settling');
    change(control(root, 'Maximum 2% settling time (s)'), '1'); reveal(root);
    expect(root.textContent).toContain('Does not meet — Sampled 2% settling');
  });
  it('separates corner construction from gain matching and checks the actual target', () => {
    const root = open(); click(root, 'Choose phase and center corners');
    const beforeGain = parseLead(control(root, 'Proposed controller C(s)').value); expect(beforeGain.K).toBe(4);
    click(root, 'Set gain for target crossover'); const afterGain = parseLead(control(root, 'Proposed controller C(s)').value);
    expect(afterGain.K).toBeGreaterThan(4); expect(afterGain.alpha).toBeCloseTo(.5887907064808635, 12);
    reveal(root); expect(root.querySelector('[aria-label="Actual crossover and phase margin comparison"]')!.textContent).toContain('PM=60');
    expect(root.textContent).toContain('Meets — Actual crossover');
  });
  it('applies native gain/corners and recomputes a changed actual crossover', () => {
    const root = open(); reveal(root); change(control(root, 'Controller DC gain K'), '8'); click(root, 'Apply numeric parameters');
    expect(output(root).hidden).toBe(true); reveal(root); expect(root.textContent).toContain('Does not meet — Actual crossover');
    const old = control(root, 'Proposed controller C(s)').value;
    change(control(root, 'Lead zero frequency ωz (rad/s)'), '10'); change(control(root, 'Lead pole frequency ωp (rad/s)'), '1'); click(root, 'Apply corner frequencies');
    expect(control(root, 'Proposed controller C(s)').value).toBe(old); expect(root.querySelector('.cd05-status')!.textContent).toContain('ratio');
  });
  it('keeps valid frequency/pole evidence when the full-response work is unavailable', () => {
    const root = open(); change(control(root, 'Lead time T (s)'), '.01'); change(control(root, 'Lead ratio α'), '.02'); click(root, 'Apply numeric parameters'); reveal(root);
    expect(output(root).hidden).toBe(false); expect(root.textContent).toContain('Proposal response unavailable'); expect(root.textContent).toContain('40000');
    expect(root.textContent).toContain('Unconfirmed — Observed overshoot'); expect(root.querySelector('[aria-label="Full loop magnitude comparison"]')).not.toBeNull();
  });
  it('uses insufficient-horizon feedback rather than false settling success', () => {
    const root = open(); change(control(root, 'Response horizon (s)'), '.1'); reveal(root);
    expect(root.textContent).toContain('does not confirm settling'); expect(root.textContent).toContain('Unconfirmed — Sampled 2% settling');
  });
  it('retains invalid raw cursors through new results and recovers meaningful inspection', () => {
    const root = open(); reveal(root); change(control(root, 'Inspect frequency ω (rad/s)'), '1e-999');
    change(control(root, 'Response horizon (s)'), '5'); reveal(root);
    expect(control(root, 'Inspect frequency ω (rad/s)').value).toBe('1e-999'); expect(root.textContent).toContain('too small to represent');
    expect(root.querySelector('[aria-label="Frequency magnitude values"]')).toBeNull();
    change(control(root, 'Inspect frequency ω (rad/s)'), '1e-2'); expect(root.querySelector('[aria-label="Frequency magnitude values"]')).not.toBeNull();
    expect(root.querySelector('.cd05-status')!.textContent).not.toContain('too small');
    change(control(root, 'Inspect response sample k'), '0e-999'); expect(root.textContent).toContain('Response sample 0: t=0');
    change(control(root, 'Inspect response sample k'), '999'); expect(control(root, 'Inspect response sample k').value).toBe('400');
    change(control(root, 'Inspect response sample k'), '-1'); expect(control(root, 'Inspect response sample k').value).toBe('-1');
  });
  it('checks the phase attempt and rejects optional native browser badInput', () => {
    const root = open(), guess = control(root, 'Predicted required phase boost (degrees, optional)');
    change(guess, '15'); click(root, 'Check phase prediction'); expect(root.textContent).toContain('prediction matches');
    change(guess, '14'); expect((root.querySelector('.cd05-assessment') as HTMLElement).hidden).toBe(true);
    change(guess, '1e-999'); reveal(root); expect(output(root).hidden).toBe(true); expect(root.textContent).toContain('too small');
    change(guess, ''); const validity = vi.spyOn(guess, 'validity', 'get').mockReturnValue({ badInput: true } as ValidityState);
    reveal(root); expect(output(root).hidden).toBe(true); expect(root.textContent).toContain('finite number'); validity.mockRestore();
  });
  it('rejects empty/unsupported equations and native underflow without stale results', () => {
    const root = open(); reveal(root); change(control(root, 'Plant G(s)'), ''); reveal(root); expect(output(root).hidden).toBe(true); expect(root.textContent).toContain('Complete G(s)');
    change(control(root, 'Plant G(s)'), '1/(s(s+2))'); change(control(root, 'Proposed controller C(s)'), '(1+s)/(1+2s)'); reveal(root); expect(root.textContent).toContain('lag section');
    click(root, 'Use baseline constant controller'); change(control(root, 'Baseline constant gain C₀'), '1e-999'); reveal(root); expect(root.textContent).toContain('too small');
  });
  it('keeps the triple full characteristic and cleans/reopens a fresh two-editor workspace', () => {
    const root = open(); change(control(root, 'Plant G(s)'), '1/(s(s+1))'); change(control(root, 'Proposed controller C(s)'), '.5(1+s)/(1+.5s)'); reveal(root);
    expect(root.querySelector('tbody')!.textContent).toBe('-103'); expect(root.textContent).toContain('Proposal: 3 physical states');
    const visit = visits.pop()!; visit.controller.abort(); if (typeof visit.cleanup === 'function') { visit.cleanup(); visit.cleanup(); } expect(root.childElementCount).toBe(0);
    const fresh = open(); expect(output(fresh).hidden).toBe(true); expect(control(fresh, 'Response horizon (s)').value).toBe('10');
    reveal(fresh); expect(fresh.querySelectorAll('tbody tr').length).toBeGreaterThan(1);
  });
});
