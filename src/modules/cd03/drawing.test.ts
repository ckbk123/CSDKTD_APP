import { expect, it } from 'vitest';
import { draw, pointAt } from './drawing';
import { model } from './model';
import { baselineDesign } from './session';
import { polePlot } from './plots';
it('uses equal mathematical scales for angle vectors at narrow and wide dimensions', () => {
  for (const width of [260, 620]) { const d = draw('Angle', width, [{ name: '45 degree vector', points: [{ re: 0, im: 0 }, { re: -2, im: 2 }], style: 'line' }], [], ['Real', 'Imaginary'], undefined, true); expect((d.geometry.x[1] - d.geometry.x[0]) / (d.geometry.right - d.geometry.left)).toBeCloseTo((d.geometry.y[1] - d.geometry.y[0]) / (d.geometry.bottom - d.geometry.top), 13); }
});
it('maps a letterboxed pointer back to the literal negative real-axis location', () => {
  const d = draw('Rate', 400, [], [], ['Real', ''], { x: [-1, 0], y: [-1, 1] }, false, 200), x = d.geometry.left + .75 * (d.geometry.right - d.geometry.left);
  expect(pointAt(20 + x * 2, { left: 20, top: 0, width: 800, height: 500 } as DOMRect, d.geometry)).toBeCloseTo(-.25, 14);
});
it('moves the response cursor without redrawing original sample paths', () => {
  const d = draw('Response', 300, [{ name: 'Given samples', points: [{ re: 0, im: 0 }, { re: 1, im: .5 }], style: 'signal' }], [], ['Time', 'Output']), before = d.image.querySelector('path')!.getAttribute('d'); d.inspect(.5, [.25]); expect(d.image.querySelector('path')!.getAttribute('d')).toBe(before); expect(d.image.querySelector('.cd03-live-cursor')!.getAttribute('visibility')).toBe('visible');
});
it('also corrects the retained Practice angle plane to equal physical units', () => {
  const d = { ...baselineDesign(), lag: true }, m = model(d), plane = polePlot(d, m), vector = plane.querySelector('line.cd03-vector')!;
  const dx = Number(vector.getAttribute('x2')) - Number(vector.getAttribute('x1')), dy = Number(vector.getAttribute('y2')) - Number(vector.getAttribute('y1'));
  // The retained view draws the zero vector first, then the pole vector.
  expect(Math.abs(dx / (m.s0.re + d.z))).toBeCloseTo(Math.abs(dy / m.s0.im), 12);
});
it('exposes a selected ratio handle as an interactive group with a45-unit target and paired-move label', () => {
  const d = draw('Corners', 300, [], [{ point: { re: -.01, im: 0 }, kind: 'pole', label: 'Lag pole', handle: 'ratio' }], ['Real', ''], { x: [-.1, 0], y: [-1, 1] }); expect(d.image.getAttribute('role')).toBe('group'); expect(d.image.querySelector('[role="button"]')!.getAttribute('aria-label')).toContain('move both corners preserving z/p'); expect(Number(d.image.querySelector('.cd03-corner-hit')!.getAttribute('r')) * 2).toBe(45);
});
