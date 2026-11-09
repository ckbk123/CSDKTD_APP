import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { analyze } from './math';
import { baselineFamily, familyModel, handles } from './families';
import { fitAxis, fitPlane, rootPlane, timePlot } from './plots';
import { sampleTraces } from './traces';

describe('CS01 equal root and readable time geometry', () => {
  it('maps an independently known point through horizontal letterboxing at one equal root scale', () => {
    const family = baselineFamily(), analysis = analyze(familyModel(family)), plane = rootPlane(analysis, handles(family), 'first', 2);
    plane.element.getBoundingClientRect = () => ({ left: 0, top: 0, width: 880, height: 350 } as DOMRect);
    expect(plane.fromEvent(new MouseEvent('pointermove', { clientX: 370, clientY: 90 }))).toEqual({ re: -1, im: 1 });
  });
  it('changes screen sizes only, with 12px labels and 44px targets at a 276px phone plot', () => {
    const family = baselineFamily(), analysis = analyze(familyModel(family)), plane = rootPlane(analysis, handles(family), 'first', fitPlane(analysis)); plane.resize(276);
    expect(Number.parseFloat(plane.element.style.getPropertyValue('--cs01-axis-font')) * 276 / 440).toBeCloseTo(12, 12); expect(Number(plane.element.querySelector('.cs01-hit')!.getAttribute('r')) * 2 * 276 / 440).toBeCloseTo(44, 12);
    const inner = plane.element.querySelector('svg')!; expect([inner.getAttribute('x'), inner.getAttribute('y'), inner.getAttribute('width'), inner.getAttribute('height')]).toEqual(['80', '20', '280', '280']); expect(plane.element.getAttribute('role')).toBe('group');
  });
  it('keeps response paths fixed while moving an analytic cursor and uses a measured phone-width viewBox', () => {
    const model = familyModel(baselineFamily()), traces = sampleTraces(model, analyze(model), [1, 0], 6), plot = timePlot(traces.times, traces.free, fitAxis(traces.free), 'Free response', 227), paths = [...plot.element.querySelectorAll('.cs01-response-line')].map(path => path.getAttribute('d'));
    plot.select(.5, [.8451818783, -.4773024371, .8451818783]); expect([...plot.element.querySelectorAll('.cs01-response-line')].map(path => path.getAttribute('d'))).toEqual(paths); expect(plot.element.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 227 262'); expect(plot.element.querySelector('text')!.getAttribute('font-size')).toBe('12');
  });
  it('uses actual CSS sizing rules only for outer SVGs, preserving nested equal-scale viewports', () => {
    const style = document.createElement('style'); style.textContent = readFileSync('src/modules/cs01/workspace.css', 'utf8'); document.head.append(style); const host = document.createElement('div'); host.dataset.module = 'CS01'; const wrap = document.createElement('div'); wrap.className = 'cs01-family-plane'; const family = baselineFamily(), analysis = analyze(familyModel(family)), plane = rootPlane(analysis, handles(family), 'first', 3); wrap.append(plane.element); host.append(wrap); document.body.append(host);
    try { const rules = [...style.sheet!.cssRules].filter((rule): rule is CSSStyleRule => 'style' in rule && 'selectorText' in rule).filter(rule => !!rule.style.getPropertyValue('width')); expect(rules.some(rule => plane.element.matches(rule.selectorText))).toBe(true); expect(rules.some(rule => plane.element.querySelector('svg')!.matches(rule.selectorText))).toBe(false); } finally { style.remove(); host.remove(); }
  });
});
