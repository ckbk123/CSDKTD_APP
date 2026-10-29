import { expect, it } from 'vitest';
import { plot } from './plot';
it('preserves a 45-degree vector on a complex plane with different axis ranges', () => {
  const figure = plot('Angle', 'Real part (1/s)', 'Imaginary part (rad/s)', [{ label: 'vector', x: [0, -2], y: [0, 2] }, { label: 'range', x: [-8, 0], y: [0, 0] }], [], true);
  const d = figure.querySelector('path')!.getAttribute('d')!;
  const [x0, y0, x1, y1] = d.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  expect(Math.abs(Math.abs(x1 - x0) - Math.abs(y1 - y0))).toBeLessThan(.02);
});
