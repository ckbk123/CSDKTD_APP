import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { baseline, compute } from './exploration';
import { fitAxis, stems } from './plots';
describe('DR03 cached stem geometry and readable phone axes', () => {
  it('maps a pointer through horizontal letterboxing to the nearest cached integer sample', () => {
    const result = compute(baseline()).result, drawing = stems(result, 'output', { low: -.1, high: .6 }, 400); drawing.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 800, height: 193 } as DOMRect); expect(drawing.fromEvent(new MouseEvent('click', { clientX: 346.5, clientY: 80 }))).toBe(5); expect(drawing.fromEvent(new MouseEvent('click', { clientX: 1000 }))).toBe(20); expect(drawing.fromEvent(new MouseEvent('click', { clientX: -10 }))).toBe(0);
  });
  it('uses the measured273px width and12px axis labels without changing stems on cursor updates', () => {
    const result = compute(baseline()).result, drawing = stems(result, 'output', fitAxis(result.rows.map(row => row.y)), 273), geometry = [...drawing.element.querySelectorAll('.dr03-live-stem')].map(node => node.getAttribute('y2')); expect(drawing.element.getAttribute('viewBox')).toBe('0 0 273 193'); expect([...drawing.element.querySelectorAll('text')].every(node => node.getAttribute('font-size') === '12')).toBe(true); drawing.select(10); expect([...drawing.element.querySelectorAll('.dr03-live-stem')].map(node => node.getAttribute('y2'))).toEqual(geometry); expect(drawing.element.querySelector('.dr03-live-marker')!.getAttribute('visibility')).toBe('visible');
  });
  it('reports clipping independently of cached data and fits zero-amplitude traces safely', () => {
    const result = compute(baseline()).result, drawing = stems(result, 'input', { low: -.1, high: .1 }, 273); expect(drawing.clipped).toBe(true); expect(result.inputs[0]).toBe(1); expect(fitAxis([0, 0, 0])).toEqual({ low: -1, high: 1 }); expect(fitAxis([-2, 3])).toEqual({ low: -2.6, high: 3.6 });
  });
  it('applies width rules only to outer SVGs, keeping nested data clipping viewports intact', () => {
    const style = document.createElement('style'); style.textContent = readFileSync('src/modules/dr03/style.css', 'utf8'); document.head.append(style); const host = document.createElement('div'); host.dataset.module = 'DR03'; const wrap = document.createElement('div'); wrap.className = 'dr03-responsive-plot'; const drawing = stems(compute(baseline()).result, 'output', { low: -.1, high: .6 }, 273); wrap.append(drawing.element); host.append(wrap); document.body.append(host);
    try { const rules = [...style.sheet!.cssRules].filter((rule): rule is CSSStyleRule => 'style' in rule && 'selectorText' in rule).filter(rule => !!rule.style.getPropertyValue('width')); expect(rules.some(rule => drawing.element.matches(rule.selectorText))).toBe(true); expect(rules.some(rule => drawing.element.querySelector('svg')!.matches(rule.selectorText))).toBe(false); } finally { host.remove(); style.remove(); }
  });
});
