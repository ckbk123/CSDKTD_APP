import { describe, expect, it } from 'vitest';
import { drawPlot, pointerPosition } from './plots';
describe('CP03 responsive drawings and direct-placement geometry', () => {
  it('maps physical coordinates through letterboxed SVG bounds without changing units', () => {
    const g = { width: 400, height: 200, left: 50, right: 350, top: 20, bottom: 180, xRange: [8, 20] as [number, number], yRange: [-2, 2] as [number, number] };
    expect(pointerPosition(210, 160, { left: 10, top: 10, width: 400, height: 300 }, g)).toEqual({ x: 14, y: 0 });
    expect(pointerPosition(-100, 1000, { left: 10, top: 10, width: 400, height: 300 }, g)).toEqual({ x: 8, y: -2 });
    expect(() => pointerPosition(0, 0, { left: 0, top: 0, width: 0, height: 0 }, g)).toThrow('numeric marker');
  });
  it('preserves curve gaps, physical handle values and large hit regions', () => {
    const d = drawPlot({ title: 'Phase', xLabel: 'log ω', yLabel: 'degrees', width: 305, series: [{ label: 'phase', style: 'output', points: [{ x: -2, y: 0 }, { x: -1, y: -45 }, null, { x: 1, y: 45 }, { x: 2, y: 0 }] }], handles: [{ key: 'frequency', label: 'Frequency cursor', x: 0, min: .01, max: 100, value: 1, units: 'rad/s' }] });
    expect(d.element.querySelectorAll('polyline')).toHaveLength(2); expect(d.image.getAttribute('viewBox')).toBe('0 0 305 270'); expect(d.element.querySelector('.cp03-hit')?.getAttribute('r')).toBe('22.5'); expect(d.element.querySelector('[role="slider"]')?.getAttribute('aria-valuetext')).toBe('1 rad/s');
  });
  it('uses equal complex-plane units per pixel without changing the sampled points', () => {
    const d = drawPlot({ title: 'Nyquist', xLabel: 'real', yLabel: 'imaginary', width: 305, equalAspect: true, series: [{ label: 'curve', style: 'output', points: [{ x: -1, y: 2 }, { x: 3, y: -1 }] }] }), g = d.geometry;
    expect((g.xRange[1] - g.xRange[0]) / (g.right - g.left)).toBeCloseTo((g.yRange[1] - g.yRange[0]) / (g.bottom - g.top), 14);
  });
});
