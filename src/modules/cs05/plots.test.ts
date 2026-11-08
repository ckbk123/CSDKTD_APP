import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { parsePolynomial } from './expression';
import { locus, rationalCut, solveRegions } from './gains';
import { decimal } from './exact';
import { fitWindow, gainStrip, rootPlane } from './plots';
const baseline = () => solveRegions(parsePolynomial('1', true), parsePolynomial('s(s+2)(s+5)'));
describe('CS05 inspectable plot geometry', () => {
  it('applies responsive sizing only to the outer plane and preserves the aligned square inner viewport', () => {
    const style = document.createElement('style'), host = document.createElement('div'); style.textContent = readFileSync('src/modules/cs05/workspace.css', 'utf8'); document.head.append(style); host.dataset.module = 'CS05';
    const wrap = document.createElement('div'); wrap.className = 'cs05-responsive-plane'; const model = baseline(), samples = locus(model.model, 100), p = rootPlane(samples, [{ re: 0, im: 0, residual: 0 }], fitWindow(samples)); wrap.append(p.element); host.append(wrap); document.body.append(host);
    try {
      const data = p.element.querySelector('svg')!; expect([data.getAttribute('x'), data.getAttribute('y'), data.getAttribute('width'), data.getAttribute('height'), data.getAttribute('viewBox')]).toEqual(['80', '20', '280', '280', '0 0 280 280']);
      // jsdom does not lay out nested SVG geometry; inspect the actual sizing rules and their selector matches.
      const sizing = [...style.sheet!.cssRules].filter((rule): rule is CSSStyleRule => 'selectorText' in rule && 'style' in rule).filter(rule => Boolean(rule.style.getPropertyValue('width') || rule.style.getPropertyValue('height') || rule.style.getPropertyValue('min-width') || rule.style.getPropertyValue('max-height')));
      expect(sizing.filter(rule => p.element.matches(rule.selectorText)).map(rule => [rule.selectorText, rule.style.getPropertyValue('width')])).toContainEqual(['[data-module="CS05"] .cs05-responsive-plane > svg, [data-module="CS05"] .cs05-interactive-strip > svg', '100%']); expect(sizing.some(rule => data.matches(rule.selectorText))).toBe(false);
      // The data origin is (140,140) inside (80,20): exactly the outer axes' (220,160).
      expect(data.querySelector('.cs05-selected-root')!.getAttribute('d')).toBe('M135,135L145,145M135,145L145,135');
      expect(p.element.querySelector('text')!.getAttribute('x')).toBe('80');
    } finally { host.remove(); style.remove(); }
  });
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
