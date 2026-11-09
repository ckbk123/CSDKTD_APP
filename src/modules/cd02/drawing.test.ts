import { expect, it } from 'vitest';
import { draw, position, type Geometry } from './drawing';
it('keeps equal physical complex units and 45-degree vectors on narrow and wide planes', () => {
  for (const width of [240, 700]) { const d = draw({ title: 'Vector', width, equal: true, curves: [{ label: '45 degrees', points: [{ re: 0, im: 0 }, { re: -2, im: 2 }] }], points: [{ re: -8, im: 0, label: 'range', kind: 'pole' }], xLabel: 'Real', yLabel: 'Imaginary' }), a = d.image.querySelector('path')!.getAttribute('d')!.match(/-?\d+(?:\.\d+)?(?:e[+-]?\d+)?/g)!.map(Number); expect(Math.abs(a[2] - a[0])).toBeCloseTo(Math.abs(a[3] - a[1]), 10); expect((d.geometry.x[1] - d.geometry.x[0]) / (d.geometry.right - d.geometry.left)).toBeCloseTo((d.geometry.y[1] - d.geometry.y[0]) / (d.geometry.bottom - d.geometry.top), 12); }
});
it('maps a physical point through a letterboxed SVG without moving its mathematical location', () => {
  const g: Geometry = { width: 300, height: 310, left: 60, right: 280, top: 35, bottom: 251, x: [-4, 4], y: [-4, 4] }, box = { left: 10, top: 20, width: 600, height: 700 } as DOMRect;
  const p = position(10 + 2 * 115, 20 + 40 + 2 * 89, box, g); expect(p.re).toBeCloseTo(-2, 12); expect(p.im).toBeCloseTo(2, 12); expect(() => position(0, 0, { ...box, width: 0 }, g)).toThrow('not ready');
});
it('clips out-of-view curves, keeps canceled root/zero glyphs distinct and gives handles separate 45-unit targets', () => {
  const d = draw({ title: 'Bounded', width: 300, curves: [{ label: 'outside', points: [{ re: -100, im: 0 }, { re: 100, im: 0 }] }], points: [{ re: 0, im: 0, kind: 'zero', label: 'zero' }, { re: 0, im: 0, kind: 'root', label: 'retained mode' }, { re: -.5, im: .5, kind: 'root', label: 'target', handle: 'upper', value: 'σ .5, ω .5' }], axis: { x: [-1, 1], y: [-1, 1] }, xLabel: 'Real', yLabel: 'Imaginary' });
  expect(d.clipped).toBe(true); expect(d.image.querySelector('svg[overflow="hidden"] path')).not.toBeNull(); expect(d.image.querySelector('.cd02-zero circle')!.getAttribute('r')).toBe('7'); expect(d.image.querySelector('.cd02-root circle')!.getAttribute('r')).toBe('3.5'); expect(d.image.querySelector('.cd02-hit')!.getAttribute('r')).toBe('22.5'); expect(d.image.querySelector('[data-cd02-handle]')!.getAttribute('aria-label')).toContain('σ .5, ω .5');
});
