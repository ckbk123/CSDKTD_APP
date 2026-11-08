import { afterEach, expect, it, vi } from 'vitest';
import { realize, run, type Experiment } from './math';
import { parseModel } from './parser';
import { trajectoryPlot } from './plot';
const base: Experiment = { T: .1, count: 31, density: 8, delay: 0, amplitude: 1, initial: [0], input: 'step', method: 'forward' };
afterEach(() => vi.restoreAllMocks());
it('moves actual clock coordinates at a fixed physical scale without resampling on cursor movement', () => {
  const source = realize(parseModel('1/(s+1)')), first = trajectoryPlot(run(source, base), 'output', 1, 3), second = trajectoryPlot(run(source, { ...base, T: .2, count: 16 }), 'output', 1, 3);
  const x = (p: typeof first) => Number(p.element.querySelector('.zoh-cursor')!.getAttribute('x1'));
  expect(x(second) - 8).toBeCloseTo(2 * (x(first) - 8), 12);
  const paths = [...first.element.querySelectorAll('path')].map(node => node.getAttribute('d')); first.select(20);
  expect([...first.element.querySelectorAll('path')].map(node => node.getAttribute('d'))).toEqual(paths);
  expect(first.element.querySelectorAll('svg text')).toHaveLength(0); expect(first.element.querySelectorAll('.zoh-y-scale span')).toHaveLength(3);
});
it('retains feedthrough sides as separate paths and never invents a continuous approximation curve', () => {
  const result = run(realize(parseModel('(s+1)/(s+1)')), { ...base, count: 6, delay: 2, input: 'pulse' }), plot = trajectoryPlot(result, 'output', 2);
  const paths = [...plot.element.querySelectorAll('path.zoh-line')].map(node => [...node.getAttribute('d')!.matchAll(/[ML]([^, ]+),([^ ]+)/g)]);
  expect(paths).toHaveLength(5); expect(paths[2].at(-1)![1]).toBe(paths[3][0][1]); expect(paths[2].at(-1)![2]).not.toBe(paths[3][0][2]);
  expect(plot.element.querySelectorAll('rect.zoh-approx')).toHaveLength(6); expect(plot.element.querySelectorAll('path.zoh-approx')).toHaveLength(0);
  plot.select(5); expect(plot.element.querySelector('.zoh-selected-interval')?.getAttribute('visibility')).toBe('hidden');
});
it('selects the nearest existing visible sample and reports an off-window cursor honestly', () => {
  const plot = trajectoryPlot(run(realize(parseModel('1/(s+1)')), { ...base, T: .3, count: 5 }), 'input', 1, 1);
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, width: 510 } as DOMRect);
  expect(plot.nearest(8 + 494 * .6)).toBe(2); expect(plot.nearest(Infinity)).toBeUndefined();
  expect(plot.select(4)).toBe(false); expect(plot.element.querySelector('.zoh-cursor')?.getAttribute('visibility')).toBe('hidden');
});
it('keeps a coincident physical endpoint visible without changing its floating-point time', () => {
  const result = run(realize(parseModel('1/(s+1)')), { ...base, count: 4 });
  expect(result.samples[3].t).toBeGreaterThan(.3);
  const plot = trajectoryPlot(result, 'output', 3, .3);
  expect(plot.select(3)).toBe(true);
  expect(plot.element.querySelectorAll('circle.zoh-exact')).toHaveLength(4);
  expect(plot.element.querySelectorAll('rect.zoh-approx')).toHaveLength(4);
  expect(plot.element.querySelector('.zoh-cursor')?.getAttribute('visibility')).toBe('visible');
  expect(result.samples[3].t).toBe(.1 * 3);
});
