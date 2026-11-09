import { expect, it } from 'vitest';
import { baseline, createSession, family } from './session';
import { draw, fit } from './drawing';
it('uses native-width12-unit text and equal square physical planes with44-unit hits', () => {
  const checked = createSession().evaluate({ ...baseline(), T: family(2, 0, 1, 2, 1) }), limits = fit(checked, 0, [0, 1]);
  for (const width of [240, 281, 620]) { const d = draw(checked, 0, 0, [0, 1], width, limits, true), svg = d.state.querySelector('svg')!; expect(svg.getAttribute('viewBox')).toBe(`0 0 ${width} 225`); expect([...svg.querySelectorAll('text')].every(t => t.getAttribute('font-size') === '12')).toBe(true);
    // Visible contiguous runs stay connected so the mapped dashed curve does
    // not restart its dash at each short sample segment and appear solid.
    for (const path of svg.querySelectorAll('path[clip-path]')) expect(path.getAttribute('d')!.match(/M/g)).toHaveLength(1);
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
it('clips supported large components before converting a subnormal fixed span into screen coordinates', () => {
  const checked = createSession().evaluate({ model: { A: [[-1, 0], [0, -2]], B: [0, 0], C: [1, 0], D: 0 }, T: [[1, 0], [0, 1]], initial: [1e-310, 1], command: 0, horizon: 1, count: 3 });
  const before = JSON.stringify(checked), limits = fit(checked, 0, [0, 1]), d = draw(checked, 1, 1, [0, 1], 281, limits, true);
  expect(d.state.innerHTML).not.toMatch(/NaN|Infinity/); expect(d.state.textContent).toContain('Fit'); expect(JSON.stringify(checked)).toBe(before);
  // A crossing is a linearly interpolated drawing point, not a computed sample.
  const crossing = { ...checked, original: checked.original.map((p, i) => ({ ...p, state: [p.state[0], i % 2 ? -1 : 1] })), changed: checked.changed.map((p, i) => ({ ...p, state: [p.state[0], i % 2 ? -1 : 1] })) };
  const crossingDrawing = draw(crossing, 1, 1, [0, 1], 281, limits, true); expect(crossingDrawing.state.innerHTML).not.toMatch(/NaN|Infinity/); expect(crossingDrawing.state.querySelector('path[clip-path]')!.getAttribute('d')).toContain('L');
});
it('keeps a supported general T with an enormous finite inverse drawable, without reducing its mathematical domain', () => {
  const tiny = 6e-309, checked = createSession().evaluate({ model: { A: [[0, 0], [0, 0]], B: [0, 0], C: [tiny, 0], D: 0 }, T: [[tiny, 0], [0, tiny]], initial: [1, 0], command: 0, horizon: 1, count: 2 });
  expect(checked.transformed.condition).toBeCloseTo(1); expect(checked.changed[1].output).toBe(checked.original[1].output);
  const limits = fit(checked, 0, [0, 1]); expect(Number.isFinite(limits.plane)).toBe(true);
  const fitted = draw(checked, 1, 0, [0, 1], 281, limits, false); expect(fitted.planes.innerHTML).not.toMatch(/NaN|Infinity/);
  const fixed = draw(checked, 1, 0, [0, 1], 281, { ...limits, plane: 2.5 }, false); expect(fixed.planes.innerHTML).not.toMatch(/NaN|Infinity/); expect(fixed.planes.textContent).toContain('Basis outside view');
});
