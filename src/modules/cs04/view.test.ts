import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const e = document.createElement('div'); e.textContent = value; e.setAttribute('aria-label', label); return e; },
  createEquationInput: ({ label, value, signal, onChange }: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    const input = document.createElement('input'); input.setAttribute('aria-label', label); input.value = value; input.addEventListener('input', onChange, { signal });
    return { element: input, getValue: () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: input.value.includes('\\placeholder'), syntaxIssues: [] }), setValue: (s: string) => { input.value = s; onChange(); }, destroy: () => input.remove() };
  },
}));
import { mount } from './view';
let clean: (() => void) | undefined;
afterEach(() => { clean?.(); clean = undefined; document.body.replaceChildren(); });
function visit() { const container = document.createElement('div'), parent = new AbortController(); document.body.append(container); clean = mount({ container, signal: parent.signal }) || undefined; return { container, parent }; }
function field(label: string): HTMLInputElement { return [...document.querySelectorAll('input')].find(e => e.getAttribute('aria-label') === label || e.closest('label')?.firstChild?.textContent === label)!; }
function set(label: string, value: string) { const input = field(label); input.value = value; input.dispatchEvent(new Event('input', { bubbles: true })); }
function button(label: string): HTMLButtonElement { return [...document.querySelectorAll('button')].find(e => e.textContent === label)!; }
const build = () => button('Build the selected loop and contour').click();
const checkP = (value: string) => { set('Your open-loop RHP pole count P', value); button('Check my open-loop pole count').click(); };
const reveal = (value = '0') => { if (!field('Your counterclockwise winding N').disabled) set('Your counterclockwise winding N', value); button('Check winding and reveal closed-loop count').click(); };
const feedback = () => document.querySelector('.cs04-feedback')!.textContent!;
const table = () => document.querySelector('table')?.textContent ?? '';
describe('staged Nyquist flow (mocked editors; actual browser checked separately)', () => {
  it('requires P before revealing the independent closed roots', () => {
    visit(); build(); expect(table()).toBe(''); expect(field('Your counterclockwise winding N').disabled).toBe(true);
    checkP('1'); expect(feedback()).toContain('incorrect'); expect(table()).toBe(''); expect(button('Check winding and reveal closed-loop count').disabled).toBe(true);
    checkP('0'); reveal(); expect(table()).toContain('0−(0)=0'); expect(document.querySelector('.cs04-answer')!.textContent).toContain('-1.5'); expect(document.querySelectorAll('svg')).toHaveLength(3);
  });
  it('makes the unstable open-loop count error visible before the answer', () => {
    visit(); button('No encirclement, unstable').click(); build(); checkP('0'); expect(feedback()).toContain('incorrect'); expect(table()).toBe('');
    checkP('1'); reveal(); expect(table()).toContain('1−(0)=1'); expect(document.querySelector('.cs04-answer')!.textContent).toContain('Unstable closed loop');
  });
  it('includes H and recomputes after changing the sensor', () => {
    visit(); button('Nonunit sensor trap').click(); build(); checkP('1'); reveal(); expect(table()).toContain('1−(0)=1'); expect(document.querySelector('.cs04-answer')!.textContent).toContain('0.25 + j0');
    set('Sensor gain H', '1'); expect(table()).toBe(''); expect(button('Check my open-loop pole count').disabled).toBe(true);
    build(); checkP('1'); reveal('1'); expect(table()).toContain('1−(1)=0'); expect(document.querySelector('.cs04-answer')!.textContent).toContain('Strictly stable');
  });
  it('uses multiplicity and positive CCW winding for a two-pole example', () => {
    visit(); button('Two RHP poles').click(); build(); checkP('1'); expect(feedback()).toContain('incorrect'); checkP('2'); reveal('2'); expect(table()).toContain('2−(2)=0');
  });
  it('checks negative winding and explains an incorrect prediction', () => {
    visit(); button('Clockwise winding').click(); build(); checkP('0'); reveal('1'); expect(feedback()).toContain('differs'); expect(table()).toContain('0−(-1)=1');
  });
  it('keeps boundary and unresolved counts distinct from strict stability', () => {
    visit(); button('Boundary at −1').click(); build(); expect(document.querySelector('.cs04-answer')!.textContent).toBe(''); checkP('1'); reveal(); expect(table()).toContain('Not reported'); expect(document.querySelector('.cs04-answer')!.textContent).toContain('Boundary: no strict');
    button('Baseline loop').click(); set('Contour radius R (s⁻¹)', '2'); build(); checkP('0'); reveal(); expect(document.querySelector('.cs04-answer')!.textContent).toContain('Contour count unresolved'); expect(table()).toContain('Not reported');
  });
  it.each(['', '1.5', '4', '1e-999'])('rejects invalid P=%s without revealing answers', value => { visit(); build(); checkP(value); expect(table()).toBe(''); expect(button('Check winding and reveal closed-loop count').disabled).toBe(true); });
  it('clears old results on invalid changed mathematics and supports recovery', () => {
    visit(); build(); checkP('0'); reveal(); set('Plant denominator D_G(s)', 's^4+1'); build(); expect(feedback()).toContain('degree'); expect(table()).toBe(''); expect(document.querySelectorAll('svg')).toHaveLength(0);
    button('Origin pole').click(); build(); checkP('0'); reveal(); expect(table()).toContain('0−(0)=0');
  });
  it('moves both source and image cursors, with numeric alternatives to the slider', () => {
    visit(); build(); const slider = field('Follow the complete contour'); slider.value = '10'; slider.dispatchEvent(new Event('input', { bubbles: true })); expect(field('Contour sample index').value).toBe('10'); expect(document.body.textContent).toContain('Sample 10/');
    set('Contour sample index', '1e-999'); expect(document.body.textContent).toContain('too small');
  });
  it('revokes a checked P when the attempt changes', () => { visit(); build(); checkP('0'); reveal(); set('Your open-loop RHP pole count P', '1'); expect(table()).toBe(''); expect(field('Your counterclockwise winding N').disabled).toBe(true); });
  it('reopens from the metadata baseline after cleanup and releases old controls', () => {
    const first = visit(); button('Two RHP poles').click(); build(); const oldButton = button('Build the selected loop and contour'); first.parent.abort(); oldButton.click(); expect(first.container.children).toHaveLength(0);
    clean?.(); visit(); expect(field('Controller gain C').value).toBe('4'); expect(field('Sensor gain H').value).toBe('1'); expect(field('Plant denominator D_G(s)').value).toBe('(s+1)(s+2)'); expect(table()).toBe('');
  });
});
