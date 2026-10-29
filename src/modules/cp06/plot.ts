import { c, type Complex } from './complex';
import type { Trace } from './continuation';
import { numeric } from './format';
import type { Model } from './model';
import { toNumber } from './rational';
import type { Root } from './roots';
import { vectors, type RuleSet } from './rules';

export interface Reveals { readonly segments: boolean; readonly asymptotes: boolean; readonly tangents: boolean; readonly vectors: boolean }
export interface Plane { readonly element: SVGSVGElement; readonly pointFromEvent: (event: MouseEvent) => Complex | undefined; readonly description: string }
const ns = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value)); if (text !== undefined) node.textContent = text; return node;
}
export function plane(model: Model, trace: Trace, construction: RuleSet, selected: readonly Root[], point: Complex, reveals: Reveals): Plane {
  const values = [...trace.frames.flatMap(frame => frame.points), ...model.poles, ...model.zeros, ...model.fixed, ...selected, point, c(0)];
  const min = Math.min(...values.map(p => p.re)), max = Math.max(...values.map(p => p.re)), center = (min + max) / 2;
  const extent = Math.max(1, (max - min) / 2, ...values.map(p => Math.abs(p.im))) * 1.15;
  const lower = center - extent, upper = center + extent;
  const x = (v: number): number => 360 * (v - lower) / (2 * extent), y = (v: number): number => 180 - 180 * v / extent;
  const root = svg('svg', { viewBox: '0 0 480 440', role: 'img', 'aria-label': 'Computed root locus in the s plane; gain increases along each arrow' });
  const description = `Finite trace 0 ≤ ${model.mode === 'pi' ? 'Kp' : 'K'} ≤ ${numeric(trace.maxGain)}; ${trace.evaluations} root evaluations, ${trace.gaps} omitted connections. Square axes use s⁻¹. Crosses are effective poles, rings effective zeros, diamonds retained fixed modes, filled circles selected-gain roots and a plus the candidate.`;
  root.append(svg('desc', {}, description));
  const data = svg('svg', { x: 60, y: 24, width: 360, height: 360, viewBox: '0 0 360 360', overflow: 'hidden' });
  data.append(svg('rect', { x: 0, y: 0, width: 360, height: 360, class: 'cp-plane-bg' }));
  for (let i = 0; i <= 4; i++) {
    const pixel = i * 90, real = lower + i * extent / 2, imaginary = extent - i * extent / 2;
    data.append(svg('line', { x1: pixel, x2: pixel, y1: 0, y2: 360, class: 'cp-grid' }), svg('line', { x1: 0, x2: 360, y1: pixel, y2: pixel, class: 'cp-grid' }));
    root.append(svg('text', { x: 60 + pixel, y: 404, 'text-anchor': 'middle', class: 'cp-tick' }, numeric(real)), svg('text', { x: 52, y: 28 + pixel, 'text-anchor': 'end', class: 'cp-tick' }, numeric(imaginary)));
  }
  data.append(svg('line', { x1: 0, x2: 360, y1: y(0), y2: y(0), class: 'cp-axis' }), svg('line', { x1: x(0), x2: x(0), y1: 0, y2: 360, class: 'cp-axis' }));
  if (reveals.segments) for (const segment of construction.segments.filter(s => s.onLocus)) data.append(svg('line', { x1: x(Math.max(lower, segment.lower)), x2: x(Math.min(upper, segment.upper)), y1: y(0), y2: y(0), class: 'cp-real-segment' }));
  if (reveals.asymptotes) {
    const origin = toNumber(construction.asymptotes.centroid);
    for (const degrees of construction.asymptotes.angles) { const radians = degrees * Math.PI / 180; data.append(svg('line', { x1: x(origin), y1: y(0), x2: x(origin + 5 * extent * Math.cos(radians)), y2: y(5 * extent * Math.sin(radians)), class: 'cp-asymptote' })); }
  }
  const branches = trace.frames.reduce((n, frame) => Math.max(n, frame.points.length), 0);
  for (let branch = 0; branch < branches; branch++) {
    let path = '', previous = false;
    for (const frame of trace.frames) {
      const value = frame.points[branch]; if (!value) { previous = false; continue; }
      path += `${previous && frame.connect ? 'L' : 'M'}${x(value.re)},${y(value.im)} `; previous = true;
    }
    data.append(svg('path', { d: path.trim(), class: `cp-branch cp-branch-${branch}` }));
    const connected = trace.frames.flatMap((frame, i) => i && frame.connect && frame.points[branch] && trace.frames[i - 1].points[branch] ? [{ a: trace.frames[i - 1].points[branch], b: frame.points[branch] }] : []);
    // Arrow locations follow arc length, not a potentially nearly stationary gain interval.
    const lengths = connected.map(pair => Math.hypot(x(pair.b.re) - x(pair.a.re), y(pair.b.im) - y(pair.a.im))), total = lengths.reduce((sum, v) => sum + v, 0);
    for (const fraction of [.35, .75]) {
      let used = 0; const target = total * fraction;
      const index = lengths.findIndex(length => { const reaches = used + length >= target; if (!reaches) used += length; return reaches; });
      if (index < 0 || total < 12) continue;
      const pair = connected[index], ratio = lengths[index] ? (target - used) / lengths[index] : 0;
      const px = x(pair.a.re) + ratio * (x(pair.b.re) - x(pair.a.re)), py = y(pair.a.im) + ratio * (y(pair.b.im) - y(pair.a.im));
      const theta = Math.atan2(y(pair.b.im) - y(pair.a.im), x(pair.b.re) - x(pair.a.re));
      data.append(svg('path', { d: `M${px - 7 * Math.cos(theta - .5)},${py - 7 * Math.sin(theta - .5)}L${px},${py}L${px - 7 * Math.cos(theta + .5)},${py - 7 * Math.sin(theta + .5)}`, class: 'cp-arrow' }));
    }
  }
  if (reveals.tangents) for (const tangent of construction.tangents) for (const degrees of tangent.angles) {
    const radians = degrees * Math.PI / 180, from = tangent.root;
    data.append(svg('line', { x1: x(from.re), y1: y(from.im), x2: x(from.re + .3 * extent * Math.cos(radians)), y2: y(from.im + .3 * extent * Math.sin(radians)), class: 'cp-tangent' }));
  }
  if (reveals.vectors) for (const vector of vectors(model, point)) data.append(svg('line', { x1: x(vector.from.re), y1: y(vector.from.im), x2: x(point.re), y2: y(point.im), class: `cp-vector cp-vector-${vector.kind}` }));
  for (const pole of model.poles) {
    const px = x(pole.re), py = y(pole.im); data.append(svg('path', { d: `M${px - 5},${py - 5}L${px + 5},${py + 5}M${px - 5},${py + 5}L${px + 5},${py - 5}`, class: 'cp-pole' }));
    if (pole.multiplicity > 1) data.append(svg('text', { x: px + 8, y: py - 8, class: 'cp-multiplicity' }, `×${pole.multiplicity}`));
  }
  for (const value of model.zeros) data.append(svg('circle', { cx: x(value.re), cy: y(value.im), r: 5.5, class: 'cp-zero' }));
  for (const value of model.fixed) { const px = x(value.re), py = y(value.im); data.append(svg('path', { d: `M${px},${py - 7}L${px + 7},${py}L${px},${py + 7}L${px - 7},${py}Z`, class: 'cp-fixed' })); }
  for (const value of selected) data.append(svg('circle', { cx: x(value.re), cy: y(value.im), r: 3, class: 'cp-selected' }));
  const px = x(point.re), py = y(point.im);
  data.append(svg('path', { d: `M${px - 8},${py}L${px + 8},${py}M${px},${py - 8}L${px},${py + 8}`, class: 'cp-candidate' }));
  root.append(data, svg('text', { x: 240, y: 430, 'text-anchor': 'middle', class: 'cp-axis-title' }, 'Real part σ (s⁻¹)'), svg('text', { transform: 'translate(14 204) rotate(-90)', 'text-anchor': 'middle', class: 'cp-axis-title' }, 'Imaginary part ω (rad/s)'));
  return { element: root, description, pointFromEvent: event => {
    const box = root.getBoundingClientRect(); if (!box.width || !box.height) return undefined;
    const sx = (event.clientX - box.left) * 480 / box.width - 60, sy = (event.clientY - box.top) * 440 / box.height - 24;
    if (sx < 0 || sx > 360 || sy < 0 || sy > 360) return undefined;
    return c(lower + sx * 2 * extent / 360, extent - sy * 2 * extent / 360);
  } };
}
