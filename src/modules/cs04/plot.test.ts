import { describe, expect, it } from 'vitest';
import { clip, contourSeries, plot } from './plot';
import type { Kind, Point } from './nyquist';

const colors: Record<Kind, string> = { 'negative-axis': 'blue', 'positive-axis': 'purple', indent: 'orange', 'outer-arc': 'green' };
const sample = (index: number, value: number | undefined, kind: Kind = 'outer-arc'): Point => ({ source: { re: index, im: 0 }, kind, response: value === undefined ? { kind: 'undefined', message: 'Unresolved sample' } : { kind: 'value', value: { re: value, im: 0 }, magnitude: Math.abs(value), phase: 0, db: null } });
describe('truthful clipped Cartesian display', () => {
  it('clips each segment without joining invisible portions of a loop', () => {
    expect(clip({ x: -5, y: 0 }, { x: 5, y: 0 }, -2, 2, -2, 2)).toEqual([{ x: -2, y: 0 }, { x: 2, y: 0 }]);
    expect(clip({ x: -5, y: 5 }, { x: 5, y: 5 }, -2, 2, -2, 2)).toBeNull();
    const e = plot('Clipped loop', [{ name: 'loop', color: 'blue', points: [{ x: 0, y: 0 }, { x: 20, y: 20 }, { x: -20, y: 20 }, { x: -1, y: 0 }] }], [], ['Re', 'Im'], true);
    const d = e.querySelector('path')!.getAttribute('d')!; expect(d.match(/M/g)!.length).toBe(2); expect(d).not.toMatch(/NaN|Infinity/);
  });
  it('handles constant curves and has accessible titles and axis units', () => {
    const e = plot('Source contour', [{ name: 'constant', color: 'blue', points: [{ x: 0, y: 0 }, { x: 0, y: 0 }] }], [], ['Re(s), s⁻¹', 'Im(s), s⁻¹']);
    expect(e.querySelector('svg')!.getAttribute('aria-label')).toBe('Source contour'); expect(e.textContent).toContain('s⁻¹'); expect(e.innerHTML).not.toMatch(/NaN|Infinity/);
  });
  it('starts a fresh mapped run after undefined or nonfinite values while retaining the source points', () => {
    const points = [sample(0, 0), sample(1, undefined), sample(2, 1), sample(3, NaN), sample(4, 2), sample(5, Infinity), sample(6, 3)];
    const result = contourSeries(points, colors);
    expect(result.source).toHaveLength(1); expect(result.source[0].points).toEqual(points.map(p => ({ x: p.source.re, y: p.source.im })));
    expect(result.image.map(s => s.points)).toEqual([0, 1, 2, 3].map(x => [{ x, y: 0 }]));
    expect(plot('Mapped gaps', result.image, [], ['Re(L)', 'Im(L)']).innerHTML).not.toMatch(/NaN|Infinity/);
  });
  it('does not seed a new segment from an undefined response at either kind boundary', () => {
    const result = contourSeries([sample(0, undefined, 'negative-axis'), sample(1, 10, 'negative-axis'), sample(2, undefined, 'positive-axis'), sample(3, 20, 'positive-axis'), sample(4, 21, 'positive-axis'), sample(5, undefined), sample(6, 30), sample(7, undefined)], colors);
    expect(result.image.map(s => [s.name, s.points])).toEqual([['negative-axis', [{ x: 10, y: 0 }]], ['positive-axis', [{ x: 20, y: 0 }, { x: 21, y: 0 }]], ['outer-arc', [{ x: 30, y: 0 }]]]);
  });
  it('preserves continuous finite joins across ordinary contour segment kinds', () => {
    const result = contourSeries([sample(0, 10, 'negative-axis'), sample(1, 20, 'positive-axis'), sample(2, 21, 'positive-axis'), sample(3, 30)], colors);
    expect(result.image.map(s => s.points)).toEqual([[{ x: 10, y: 0 }], [{ x: 10, y: 0 }, { x: 20, y: 0 }, { x: 21, y: 0 }], [{ x: 21, y: 0 }, { x: 30, y: 0 }]]);
    expect(contourSeries([], colors)).toEqual({ source: [], image: [] });
  });
});
