import { expect, it } from 'vitest';
import { baseline, createSession, family } from './session';
import { draw, fit } from './drawing';
it('uses native-width12-unit text and equal square physical planes with44-unit hits', () => {
  const checked = createSession().evaluate({ ...baseline(), T: family(2, 0, 1, 2, 1) }), limits = fit(checked, 0, [0, 1]);
  for (const width of [240, 281, 620]) { const d = draw(checked, 0, 0, [0, 1], width, limits, true), svg = d.state.querySelector('svg')!; expect(svg.getAttribute('viewBox')).toBe(`0 0 ${width} 225`); expect([...svg.querySelectorAll('text')].every(t => t.getAttribute('font-size') === '12')).toBe(true);
    const plane = d.planes.querySelector<SVGSVGElement>('[data-plane="x"]')!, size = Number(plane.dataset.size); expect(plane.querySelector('clipPath rect')!.getAttribute('width')).toBe(String(size)); expect(plane.querySelector('clipPath rect')!.getAttribute('height')).toBe(String(size)); expect(plane.querySelector('[data-handle] circle')!.getAttribute('r')).toBe('22');
  }
});
it('draws inverse columns as the new basis in the original coordinate plane', () => {
  const checked = createSession().evaluate({ ...baseline(), T: [[2, 1], [0, .5]] }), d = draw(checked, 0, 0, [0, 1], 281, fit(checked, 0, [0, 1]), true);
  const plane = d.planes.querySelector<SVGSVGElement>('[data-plane="x"]')!, left = Number(plane.dataset.left), top = Number(plane.dataset.top), size = Number(plane.dataset.size), bound = Number(plane.dataset.bound);
  const handle = (name: string) => plane.querySelector(`[data-handle="${name}"] circle`)!;
  expect(Number(handle('scale').getAttribute('cx'))).toBeCloseTo(left + size / 2 + .5 * size / (2 * bound));
  expect(Number(handle('shear').getAttribute('cx'))).toBeCloseTo(left + size / 2 - size / (2 * bound));
  expect(Number(handle('shear').getAttribute('cy'))).toBeCloseTo(top + size / 2 - 2 * size / (2 * bound));
});
it('keeps fixed views honest when either clipping boundary or the selected point is outside', () => {
  const checked = createSession().evaluate({ ...baseline(), T: [[-1, 0], [0, 1]], initial: [1, -1] }), d = draw(checked, 0, 0, [0, 1], 281, { state: [-.01, .01], output: [-.01, .01], plane: .01 }, true);
  expect(d.state.textContent).toContain('↓↑ Fit'); expect(d.planes.textContent).toContain('Selected point outside view'); expect(d.planes.querySelector('[data-plane="x"] circle')).toBeNull();
});
it('does not add a coordinate plane/handle to scalar or static models', () => {
  const checked = createSession().evaluate({ model: { A: [], B: [], C: [], D: 3 }, T: [], initial: [], command: 2, horizon: 1, count: 2 }), d = draw(checked, 1, 0, [0, 0], 281, fit(checked, 0, [0, 0]), false);
  expect(d.planes.children).toHaveLength(0); expect(d.state.textContent).toContain('no dynamic states'); expect(d.output.querySelector('svg')).not.toBeNull();
});
