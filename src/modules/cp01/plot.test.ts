import { afterEach, expect, it, vi } from 'vitest';
import { responsePlot } from './plot';
import type { Point } from './response';

afterEach(() => vi.unstubAllGlobals());

const points: Point[] = [
  { t: 0, side: 'left', input: 0, free: 0, forced: 0, total: 0, freeState: [0], forcedState: [0] },
  { t: 0, side: 'right', input: 10, free: 0, forced: 20, total: 20, freeState: [0], forcedState: [0] },
  { t: .1, side: 'left', input: 10, free: 0, forced: 21, total: 21, freeState: [0], forcedState: [1] },
  { t: .1, side: 'right', input: 0, free: 0, forced: 1, total: 1, freeState: [0], forcedState: [1] },
  { t: 1, side: 'right', input: 0, free: 0, forced: .4, total: .4, freeState: [0], forcedState: [.4] },
];

function viewport() {
  const events = new EventTarget(); let compact = false;
  Object.defineProperty(events, 'matches', { get: () => compact });
  vi.stubGlobal('matchMedia', () => events);
  return (narrow: boolean) => { compact = narrow; events.dispatchEvent(new Event('change')); };
}

it('reflows a narrow plot without discarding event sides and keeps the selected time', () => {
  const resize = viewport(), lifetime = new AbortController(), p = responsePlot(points, false, 'Ordinary pulse output', undefined, lifetime.signal);
  p.cursor(.5); expect(p.element.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 760 270');
  resize(true);
  expect(p.element.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 380 244');
  expect(p.element.querySelector('.cp-cursor')!.getAttribute('x1')).toBe('217');
  const path = p.element.querySelector('path.cp-total')!.getAttribute('d')!;
  const coordinates = Array.from(path.matchAll(/[ML]([\d.]+) ([\d.]+)/g));
  expect(coordinates).toHaveLength(points.length);
  expect(coordinates[0][1]).toBe(coordinates[1][1]); expect(coordinates[0][2]).not.toBe(coordinates[1][2]);
  expect(coordinates[2][1]).toBe(coordinates[3][1]); expect(coordinates[2][2]).not.toBe(coordinates[3][2]);
  lifetime.abort();
});

it('keeps signed impulse area readable on a narrow plot and removes viewport listeners on abort', () => {
  const resize = viewport(), lifetime = new AbortController(), p = responsePlot(points, true, 'Ideal input', '-2/3', lifetime.signal);
  resize(true);
  expect(p.element.textContent).toContain('signed area -2/3');
  expect(p.element.textContent).toContain('not a finite peak');
  expect(p.element.querySelectorAll('path.cp-impulse')).toHaveLength(1);
  const rendered = p.element.querySelector('svg'); lifetime.abort(); resize(false);
  expect(p.element.querySelector('svg')).toBe(rendered);
});
