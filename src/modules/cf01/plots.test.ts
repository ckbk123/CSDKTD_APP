import { afterEach, expect, it, vi } from 'vitest';
import { measure, deriveTargets } from './measure';
import { buildResponse } from './response';
import { fitPoles, polePlot, responsePlot } from './plots';
afterEach(()=>vi.restoreAllMocks());
it('uses cached response data for cursor motion and reveals only actual measured markers',()=>{
  const m=measure(buildResponse({g:4,a1:2,a0:4}),10), before=JSON.stringify(m.samples), p=responsePlot(m,m,5);
  const paths=[...p.element.querySelectorAll('path')].map(n=>n.getAttribute('d'));p.cursor(1);
  expect([...p.element.querySelectorAll('path')].map(n=>n.getAttribute('d'))).toEqual(paths);expect(p.element.querySelector('[data-measurement]')).toBeNull();
  expect(p.element.querySelectorAll('svg text')).toHaveLength(0);expect(p.element.querySelectorAll('.cf1-y-axis span')).toHaveLength(3);
  const checked=responsePlot(m,m,1,true);expect(checked.element.querySelectorAll('[data-measurement]')).toHaveLength(4);expect(JSON.stringify(m.samples)).toBe(before);
  vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,width:600,height:220} as DOMRect);expect(p.fromEvent(300)).toBe(5);
});
it('uses an equal-unit square pole frame and exposes actual world coordinates independently of narrow size',()=>{
  const m=measure(buildResponse({g:4,a1:2,a0:4}),10),t=deriveTargets(20,4,2),window=fitPoles(m,t),p=polePlot(m,t,window);
  const extent=window.extent;vi.spyOn(SVGElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:150,height:150} as DOMRect);
  expect(p.fromEvent(75,75)).toEqual({re:0,im:0});expect(p.fromEvent(144,6)).toEqual({re:extent,im:extent});
  expect(p.element.querySelectorAll('[data-handle^="pair-"]')).toHaveLength(2);expect(p.element.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 300 300');
});
it('lists every repeated pole and the actual RHP zero without cancelling denominator factors',()=>{
  const m=measure(buildResponse({g:1,a1:2,a0:1,pole:1,zero:-1}),15),p=polePlot(m,deriveTargets(20,4,2));
  expect(p.element.querySelectorAll('path.cf1-line')).toHaveLength(3);expect(p.element.querySelectorAll('.cf1-zero')).toHaveLength(1);
  expect(p.element.textContent).toContain('Retained poles (s⁻¹): -1; -1; -1. Zero: 1.');expect(p.element.querySelector('[data-handle^="pair-"]')).toBeNull();
  expect(p.element.querySelector('[aria-label="Retained pole multiplicity 3"]')?.textContent).toBe('×3');
});
