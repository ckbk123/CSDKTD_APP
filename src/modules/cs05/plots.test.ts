import { describe, expect, it } from 'vitest';
import { parsePolynomial } from './expression';
import { locus, rationalCut, solveRegions } from './gains';
import { decimal } from './exact';
import { fitWindow, gainStrip, rootPlane } from './plots';
const baseline = () => solveRegions(parsePolynomial('1', true), parsePolynomial('s(s+2)(s+5)'));
describe('CS05 inspectable plot geometry', () => {
  it('keeps the equal-scale plane window and branch paths while resizing to readable phone labels', () => {
    const model = baseline(), samples = locus(model.model, 100), window = fitWindow(samples), selected = [{ re: -7, im: 0, residual: 0 }, { re: 0, im: Math.sqrt(10), residual: 0 }, { re: 0, im: -Math.sqrt(10), residual: 0 }], p = rootPlane(samples, selected, window);
    const before = [...p.element.querySelectorAll('.cs05-branch')].map(n => n.getAttribute('d')); p.resize(276);
    expect(Number.parseFloat(p.element.style.getPropertyValue('--cs05-plot-font')) * 276 / 440).toBeCloseTo(12, 12); expect([...p.element.querySelectorAll('.cs05-branch')].map(n => n.getAttribute('d'))).toEqual(before);
    expect(rootPlane(samples, [{ re: 1000, im: 0, residual: 0 }], window).clipped).toBe(true); expect(p.clipped).toBe(false);
  });
  it('maps a strip through letterboxing and shows exact endpoint inclusion separately from numerical position', () => {
    const model = baseline(), p = gainStrip(model, 100, model.cuts[1]); p.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 90 } as DOMRect);
    expect(p.fromEvent(new MouseEvent('click', { clientX: 220 }))).toBe(0); expect(p.fromEvent(new MouseEvent('click', { clientX: 400 }))).toBe(50); expect(p.fromEvent(new MouseEvent('click', { clientX: 580 }))).toBe(100);
    expect(p.element.querySelectorAll('.cs05-excluded')).toHaveLength(2); expect(p.element.querySelectorAll('.cs05-included')).toHaveLength(0);
    p.resize(276); expect(Number.parseFloat(p.element.style.getPropertyValue('--cs05-plot-font')) * 276 / 440).toBeCloseTo(12, 12);
  });
  it('marks an included zero and an unbounded stable tail without treating the view endpoint as a stability boundary', () => {
    const model = solveRegions(parsePolynomial('0', true), parsePolynomial('s+1')), p = gainStrip(model, 2, rationalCut(decimal('1')));
    expect(p.element.querySelectorAll('.cs05-included')).toHaveLength(1); expect(p.element.querySelectorAll('.cs05-tail-arrow')).toHaveLength(1); expect(p.element.querySelectorAll('[data-endpoint]')).toHaveLength(1);
  });
});
