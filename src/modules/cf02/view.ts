import type { Point, Polynomial } from './math';
import { neg, ONE, toNumber, type Rational } from './rational';

export function numeric(value: number): string {
  if (value === 0) return '0';
  return Math.abs(value) < .001 || Math.abs(value) >= 10_000 ? value.toExponential(4) : String(Number(value.toPrecision(6)));
}
export function fraction(value: Rational): string {
  if (value.n < 0n) return '-' + fraction(neg(value));
  return value.d === 1n ? String(value.n) : `\\frac{${value.n}}{${value.d}}`;
}
export function polynomial(values: Polynomial, variable = 's'): string {
  const terms: string[] = [];
  for (let i = values.length - 1; i >= 0; i--) {
    const value = values[i]; if (!value.n) continue;
    const magnitude = value.n < 0n ? neg(value) : value;
    const coefficient = i && magnitude.n === ONE.n && magnitude.d === ONE.d ? '' : fraction(magnitude);
    terms.push((value.n < 0n ? '-' : terms.length ? '+' : '') + coefficient + (i ? `${variable}${i > 1 ? `^{${i}}` : ''}` : ''));
  }
  return terms.join('') || '0';
}
export function evaluate(poly: Polynomial, t: number): number { return poly.reduceRight((sum, value) => sum * t + toNumber(value, true), 0); }

/** Keep each bucket's extrema, so a reduced SVG does not hide sampled peaks. */
function reduced(points: readonly Point[], key: 'comparator' | 'physical'): Point[] {
  const output: Point[] = [];
  const bucket = Math.max(1, Math.ceil(points.length / 500));
  for (let start = 0; start < points.length; start += bucket) {
    const group = points.slice(start, start + bucket);
    const low = group.reduce((a, b) => a[key] < b[key] ? a : b), high = group.reduce((a, b) => a[key] > b[key] ? a : b);
    output.push(...[group[0], low, high, group.at(-1)!].sort((a, b) => a.t - b.t));
  }
  return output;
}
export function errorPlot(points: readonly Point[]): HTMLElement {
  const scroll = document.createElement('div'); scroll.className = 'cf-plot-scroll'; scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', 'Error trace; scroll horizontally on narrow screens');
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 640 300');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', 'Sampled comparator and physical errors versus time. Numeric samples follow.');
  scroll.append(svg);
  if (!points.length) return scroll;
  let minimum = 0, maximum = 0;
  points.forEach(p => { minimum = Math.min(minimum, p.comparator, p.physical); maximum = Math.max(maximum, p.comparator, p.physical); });
  const span = maximum - minimum || 1; minimum -= span * .08; maximum += span * .08;
  const end = points.at(-1)!.t || 1, x = (t: number) => 92 + 520 * t / end, y = (v: number) => 245 - (v - minimum) / (maximum - minimum) * 210;
  const add = (name: string, attributes: Record<string, string>, text?: string): void => {
    const item = document.createElementNS(ns, name); Object.entries(attributes).forEach(([key, value]) => item.setAttribute(key, value));
    if (text) item.textContent = text; svg.append(item);
  };
  for (let i = 0; i <= 4; i++) {
    const value = minimum + (maximum - minimum) * i / 4;
    add('line', { x1: '92', x2: '612', y1: String(y(value)), y2: String(y(value)), class: 'cf-gridline' });
    add('text', { x: '84', y: String(y(value) + 4), 'text-anchor': 'end' }, numeric(value));
    const time = end * i / 4;
    add('text', { x: String(x(time)), y: '265', 'text-anchor': 'middle' }, numeric(time));
  }
  add('text', { x: '92', y: '17' }, 'Error (normalized units)');
  add('text', { x: '352', y: '292', 'text-anchor': 'middle' }, 'Time t (s)');
  for (const key of ['physical', 'comparator'] as const) {
    const path = reduced(points, key).map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(3)},${y(p[key]).toFixed(3)}`).join(' ');
    add('path', { d: path, class: `cf-curve cf-${key}`, fill: 'none' });
  }
  return scroll;
}
