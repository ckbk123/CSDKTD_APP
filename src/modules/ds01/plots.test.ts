import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baseline, check } from './rows';
import { fitAmplitude, rootPlane, sequence } from './plots';
describe('DS01 equal z-plane and readable sample geometry', () => {
  it('inverts both horizontal and vertical letterboxing at an equal scale', () => {
    const plane = rootPlane(baseline().rows, 1, 2, 440); plane.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 880, height: 350 } as DOMRect); expect(plane.fromEvent(new MouseEvent('pointermove', { clientX: 370, clientY: 90 }))).toEqual({ re: -1, im: 1 }); plane.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 440, height: 700 } as DOMRect); expect(plane.fromEvent(new MouseEvent('pointermove', { clientX: 150, clientY: 265 }))).toEqual({ re: -1, im: 1 });
  });
  it('keeps axis text at12 CSS px and handles44 CSS px at a273px phone plane', () => {
    const plane = rootPlane(baseline().rows, 1, 2.2, 273), inner = plane.element.querySelector('svg')!; expect(Number.parseFloat(plane.element.style.getPropertyValue('--ds01-axis-font')) * 273 / 440).toBeCloseTo(12, 12); expect(Number(plane.element.querySelector('.ds01-hit')!.getAttribute('r')) * 2 * 273 / 440).toBeCloseTo(44, 12); expect([inner.getAttribute('x'), inner.getAttribute('y'), inner.getAttribute('width'), inner.getAttribute('height')]).toEqual(['80', '20', '280', '280']); expect(plane.element.getAttribute('role')).toBe('group'); expect(plane.element.querySelectorAll('[role="button"]')).toHaveLength(2);
  });
  it('uses a measured phone-width sample drawing and does not alter stems during cursor movement', () => {
    const data = check(baseline()).cache.get(2)!.data, drawing = sequence(data, fitAmplitude(data), 273), before = [...drawing.element.querySelectorAll('.ds01-stem')].map(node => node.getAttribute('y2')); drawing.select(data[4]); expect([...drawing.element.querySelectorAll('.ds01-stem')].map(node => node.getAttribute('y2'))).toEqual(before); expect(drawing.element.getAttribute('viewBox')).toBe('0 0 273 270'); expect(drawing.element.querySelector('text')!.getAttribute('font-size')).toBe('12'); expect(drawing.element.querySelector('.ds01-sample-cursor')!.getAttribute('x1')).not.toBeNull();
  });
  it('matches responsive sizing only on outer SVGs, preserving nested square/data viewport dimensions', () => {
    const style = document.createElement('style'); style.textContent = readFileSync('src/modules/ds01/workspace.css', 'utf8'); document.head.append(style); const host = document.createElement('div'); host.dataset.module = 'DS01'; const wrap = document.createElement('div'); wrap.className = 'ds01-responsive-plane'; const plane = rootPlane(baseline().rows, 1, 2.2, 273); wrap.append(plane.element); host.append(wrap); document.body.append(host);
    try { const rules = [...style.sheet!.cssRules].filter((rule): rule is CSSStyleRule => 'style' in rule && 'selectorText' in rule).filter(rule => !!rule.style.getPropertyValue('width')); expect(rules.some(rule => plane.element.matches(rule.selectorText))).toBe(true); expect(rules.some(rule => plane.element.querySelector('svg')!.matches(rule.selectorText))).toBe(false); } finally { style.remove(); host.remove(); }
  });
});
