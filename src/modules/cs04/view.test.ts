import { afterEach, describe, expect, it, vi } from 'vitest';
const rendered = vi.hoisted(() => ({ series: new Map<string, readonly { name: string; points: readonly { x: number; y: number }[] }[]>() }));
vi.mock('./plot', async importOriginal => {
  const original = await importOriginal<typeof import('./plot')>();
  return { ...original, plot: (...args: Parameters<typeof original.plot>) => { rendered.series.set(args[0], args[1]); return original.plot(...args); } };
});
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (value: string, label: string) => { const e = document.createElement('div'); e.textContent = value; e.setAttribute('aria-label', label); return e; },
  createEquationInput: ({ label, value, signal, onChange }: { label: string; value: string; signal: AbortSignal; onChange: () => void }) => {
    const input = document.createElement('input'); input.setAttribute('aria-label', label); input.value = value; input.addEventListener('input', onChange, { signal });
    return { element: input, getValue: () => ({ latex: input.value, empty: !input.value.trim(), hasPlaceholders: input.value.includes('\\placeholder'), syntaxIssues: [] }), setValue: (s: string) => { input.value = s; onChange(); }, destroy: () => input.remove() };
  },
}));
import { mount } from './view';
import { analyze, compose } from './criterion';
import { parsePolynomial } from './expression';
import { one, rat } from './exact';
let clean: (() => void) | undefined;
afterEach(() => { clean?.(); clean = undefined; document.body.replaceChildren(); rendered.series.clear(); });
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
  it.each(['', '1e-999', '-1', '999999'].flatMap(value => [['full', value], ['critical', value]]))('keeps the last %s plot coherent when index=%s blocks a view change', (previousView, value) => {
    visit(); build(); const zoom = document.querySelector('select')!;
    zoom.value = previousView; zoom.dispatchEvent(new Event('change', { bubbles: true }));
    const figures = document.querySelector('.cs04-plots')!, previousFigures = figures.innerHTML;
    set('Contour sample index', value);
    const errors: string[] = [], onError = (event: ErrorEvent) => { errors.push(event.message); event.preventDefault(); };
    window.addEventListener('error', onError);
    const nextView = previousView === 'full' ? 'critical' : 'full';
    try { zoom.value = nextView; zoom.dispatchEvent(new Event('change', { bubbles: true })); }
    finally { window.removeEventListener('error', onError); }
    expect(errors).toEqual([]); expect(zoom.value).toBe(previousView); expect(figures.innerHTML).toBe(previousFigures);
    expect(figures.previousElementSibling!.textContent).toContain('last valid view');
    set('Contour sample index', '0'); zoom.value = nextView; zoom.dispatchEvent(new Event('change', { bubbles: true }));
    expect(zoom.value).toBe(nextView); expect(figures.querySelectorAll('figcaption')[1].textContent).toBe(nextView === 'critical' ? 'L(s) near −1: clipped Cartesian window' : 'L(s): complete finite mapped contour');
  });
  it('revokes a checked P when the attempt changes', () => { visit(); build(); checkP('0'); reveal(); set('Your open-loop RHP pole count P', '1'); expect(table()).toBe(''); expect(field('Your counterclockwise winding N').disabled).toBe(true); });
  it('splits an unresolved mapped outer arc without cutting the valid source contour or reporting N', () => {
    visit(); set('Plant denominator D_G(s)', '(s-10)^3'); set('Contour radius R (s⁻¹)', '10.001'); build();
    const loop = compose(parsePolynomial('1'), parsePolynomial('(s-10)^3'), rat(4), one), analysis = analyze(loop, 10.001, .05);
    expect(analysis.kind).toBe('unresolved'); const arc = analysis.contour.segments.find(s => s.kind === 'outer-arc')!;
    const gap = arc.points.findIndex(point => point.response.kind === 'undefined'); expect(gap).toBeGreaterThan(0); expect(gap).toBeLessThan(arc.points.length - 1);
    const before = arc.points[gap - 1].response, after = arc.points[gap + 1].response;
    expect(before.kind).toBe('value'); expect(after.kind).toBe('value');
    const mapped = rendered.series.get('L(s): complete finite mapped contour')!.filter(s => s.name === 'outer-arc'); expect(mapped).toHaveLength(2);
    if (before.kind === 'value' && after.kind === 'value') {
      expect(mapped[0].points.at(-1)).toEqual({ x: before.value.re, y: before.value.im }); expect(mapped[1].points[0]).toEqual({ x: after.value.re, y: after.value.im });
      expect(mapped.some(s => s.points.some((point, i) => point.x === before.value.re && point.y === before.value.im && s.points[i + 1]?.x === after.value.re && s.points[i + 1]?.y === after.value.im))).toBe(false);
    }
    expect(mapped.flatMap(s => s.points).every(point => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true);
    const source = rendered.series.get('Clockwise RHP source contour')!.filter(s => s.name === 'outer-arc'); expect(source).toHaveLength(1);
    expect(source[0].points).toContainEqual({ x: arc.points[gap].source.re, y: arc.points[gap].source.im });
    const sampleIndex = analysis.contour.points.findIndex(point => point === arc.points[gap]); set('Contour sample index', String(sampleIndex));
    expect(document.querySelectorAll('.cs04-plots svg')[1].querySelectorAll('circle')).toHaveLength(0);
    checkP('3'); reveal(); expect(table()).toContain('Not reported'); expect(document.querySelector('.cs04-answer')!.textContent).toContain('Contour count unresolved');
  });
  it('keeps ordinary valid curves connected and their independently checked Nyquist result unchanged', () => {
    visit(); build(); const loop = compose(parsePolynomial('1'), parsePolynomial('(s+1)(s+2)'), rat(4), one), analysis = analyze(loop, 20, .05);
    expect(analysis.kind).toBe('stable'); expect('winding' in analysis).toBe(true);
    if ('winding' in analysis) {
      const mapped = rendered.series.get('L(s): complete finite mapped contour')!;
      expect(mapped.map(s => s.name)).toEqual(['negative-axis', 'positive-axis', 'outer-arc']);
      for (const point of analysis.winding.points) {
        expect(point.response.kind).toBe('value'); if (point.response.kind === 'value') expect(mapped.find(s => s.name === point.kind)!.points).toContainEqual({ x: point.response.value.re, y: point.response.value.im });
      }
    }
    checkP('0'); reveal('0'); expect(table()).toContain('0−(0)=0'); expect(document.querySelector('.cs04-answer')!.textContent).toContain('Strictly stable');
  });
  it('reopens from the metadata baseline after cleanup and releases old controls', () => {
    const first = visit(); button('Two RHP poles').click(); build(); const oldButton = button('Build the selected loop and contour'); first.parent.abort(); oldButton.click(); expect(first.container.children).toHaveLength(0);
    clean?.(); visit(); expect(field('Controller gain C').value).toBe('4'); expect(field('Sensor gain H').value).toBe('1'); expect(field('Plant denominator D_G(s)').value).toBe('(s+1)(s+2)'); expect(table()).toBe('');
  });
});
