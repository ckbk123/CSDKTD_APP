import { describe, expect, it } from 'vitest';
import { clip, plot } from './plot';
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
});
