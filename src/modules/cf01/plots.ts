import type { Measurement, Targets } from './measure';
import { normalizedAt } from './response';
import { format as f } from './input';
const ns = 'http://www.w3.org/2000/svg';
function canvas(height: number, label: string) {
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 820 ' + height); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label);
  const add = (tag: string, attrs: Record<string, string | number>, text?: string) => {
    const el = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => el.setAttribute(key, String(value)));
    if (text !== undefined) el.textContent = text;
    svg.append(el); return el;
  };
  return { svg, add };
}
const shown = (m: Measurement) => m.samples.filter((_, i) => i % Math.max(1, Math.floor(m.samples.length / 1000)) === 0 || i === m.samples.length - 1);
export function responsePlot(pair: Measurement, full: Measurement, time: number): SVGSVGElement {
  const { svg, add } = canvas(355, 'Computed step responses. Solid: full chosen model. Dashed: standard second-order pair. Horizontal time in seconds, vertical normalized output y divided by its positive final value. Shaded settling band and detected rise, peak, settling and numeric inspection markers.');
  const values = [...pair.samples, ...full.samples].map(p => p.value), band = full.band / 100;
  const low = Math.min(0, ...values, 1 - band), high = Math.max(1 + band, ...values), span = high - low;
  const X = (t: number) => 95 + 670 * t / full.horizon, Y = (y: number) => 265 - 220 * (y - low + .05 * span) / (1.1 * span);
  add('rect', { x: 95, y: Y(1 + band), width: 670, height: Y(1 - band) - Y(1 + band), class: 'cf1-area' });
  for (let i = 0; i <= 4; i++) {
    const y = low + span * i / 4, t = full.horizon * i / 4;
    add('line', { x1: 95, x2: 765, y1: Y(y), y2: Y(y), class: 'cf1-grid' });
    add('text', { x: 87, y: Y(y) + 4, 'text-anchor': 'end' }, f(y));
    add('text', { x: X(t), y: 291, 'text-anchor': 'middle' }, f(t));
  }
  add('line', { x1: 95, x2: 765, y1: Y(1), y2: Y(1), class: 'cf1-reference' });
  for (const [m, name] of [[pair, 'pair'], [full, 'full']] as const) add('path', { d: shown(m).map((p, i) => (i ? 'L' : 'M') + X(p.t).toFixed(2) + ',' + Y(p.value).toFixed(2)).join(' '), class: 'cf1-line cf1-' + name });
  for (const [t, label] of [[full.riseStart, 'rise start'], [full.riseEnd, 'rise end'], [full.peakTime, 'detected peak'], [full.settlingTime, 'settling']] as const) {
    if (t === undefined) continue;
    add('circle', { cx: X(t), cy: Y(normalizedAt(full.response, t).value), r: 4, class: 'cf1-marker' });
    const title = document.createElementNS(ns, 'title'); title.textContent = label + ' at ' + f(t) + ' s'; svg.lastElementChild!.append(title);
  }
  add('line', { x1: X(time), x2: X(time), y1: 35, y2: 270, class: 'cf1-cursor' });
  add('text', { x: 95, y: 18 }, 'Normalized output y/y∞ (dimensionless) · band ±' + full.band + '%');
  add('text', { x: 410, y: 318, 'text-anchor': 'middle' }, 'Time t (s) · full solid / pair dashed · circles: measured crossings/extrema');
  add('text', { x: 410, y: 341, 'text-anchor': 'middle' }, 'Line segments illustrate sampled values; numeric inspection uses the full response.');
  return svg;
}
type Vertex = [number, number];
function clip(poly: Vertex[], value: (v: Vertex) => number): Vertex[] {
  const out: Vertex[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length], fa = value(a), fb = value(b);
    if (fa <= 0) out.push(a);
    if ((fa <= 0) !== (fb <= 0)) { const t = fa / (fa - fb); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); }
  }
  return out;
}
export function polePlot(full: Measurement, targets: Targets): SVGSVGElement {
  const { svg, add } = canvas(340, 'Target-pair guideline region in the s-plane. Crosses: retained denominator poles, including the added real pole. Open ring: optional zero. The region uses damping and decay approximations, not a proof of full-model performance.');
  const r = full.response, zero = r.model.zero === undefined ? undefined : -r.model.zero;
  const extent = Math.max(2, targets.decayMinimum * 1.3, ...r.poles.map(p => Math.abs(p.re)), Math.abs(zero ?? 0));
  const left = -1.15 * extent, right = Math.max(.2 * extent, (zero ?? 0) * 1.15), vertical = Math.max(2, ...r.poles.map(p => Math.abs(p.im))) * 1.3;
  const X = (x: number) => 95 + 670 * (x - left) / (right - left), Y = (y: number) => 270 - 220 * (y + vertical) / (2 * vertical);
  const tangent = Math.tan(Math.acos(targets.dampingMinimum));
  let polygon: Vertex[] = [[left, -vertical], [right, -vertical], [right, vertical], [left, vertical]];
  for (const bound of [(v: Vertex) => v[0] + targets.decayMinimum, (v: Vertex) => v[1] + tangent * v[0], (v: Vertex) => -v[1] + tangent * v[0]]) polygon = clip(polygon, bound);
  if (polygon.length) add('polygon', { points: polygon.map(v => X(v[0]) + ',' + Y(v[1])).join(' '), class: 'cf1-area' });
  if (targets.dampingMinimum === 1) add('line', { x1: X(left), x2: X(-targets.decayMinimum), y1: Y(0), y2: Y(0), class: 'cf1-line cf1-full' });
  for (let i = 0; i <= 4; i++) {
    const x = left + (right - left) * i / 4, y = -vertical + 2 * vertical * i / 4;
    add('line', { x1: X(x), x2: X(x), y1: 50, y2: 270, class: 'cf1-grid' });
    add('line', { x1: 95, x2: 765, y1: Y(y), y2: Y(y), class: 'cf1-grid' });
    add('text', { x: X(x), y: 292, 'text-anchor': 'middle' }, f(x));
    add('text', { x: 87, y: Y(y) + 4, 'text-anchor': 'end' }, f(y));
  }
  add('line', { x1: X(0), x2: X(0), y1: 50, y2: 270, class: 'cf1-reference' });
  add('line', { x1: 95, x2: 765, y1: Y(0), y2: Y(0), class: 'cf1-reference' });
  add('line', { x1: X(-targets.decayMinimum), x2: X(-targets.decayMinimum), y1: 50, y2: 270, class: 'cf1-cursor' });
  r.poles.forEach((p, i) => {
    const x = X(p.re), y = Y(p.im);
    add('path', { d: 'M' + (x - 5) + ',' + (y - 5) + 'L' + (x + 5) + ',' + (y + 5) + 'M' + (x - 5) + ',' + (y + 5) + 'L' + (x + 5) + ',' + (y - 5), class: 'cf1-line cf1-' + (i < 2 ? 'full' : 'pair') });
  });
  const counts = new Map<string, { re: number; im: number; count: number }>();
  for (const p of r.poles) { const key = p.re + ',' + p.im, previous = counts.get(key); if (previous) previous.count++; else counts.set(key, { ...p, count: 1 }); }
  for (const p of counts.values()) if (p.count > 1) add('text', { x: X(p.re) + 10, y: Y(p.im) - 10 }, '×' + p.count);
  if (zero !== undefined) add('circle', { cx: X(zero), cy: Y(0), r: 6, class: 'cf1-zero' });
  add('text', { x: 95, y: 18 }, 'Im(s) (s⁻¹) · crosses: pair solid / added pole dashed; ring: zero');
  add('text', { x: 410, y: 318, 'text-anchor': 'middle' }, 'Re(s) (s⁻¹) · shaded: standard damping/decay guideline, checked by full response');
  return svg;
}
