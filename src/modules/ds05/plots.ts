import type { Model } from './model';
import { unit, type Complex, type MappingPoint } from './winding';

const NS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text; return node;
}
const tick = (value: number): string => value === 0 ? '0' : Number(value.toPrecision(4)).toString();
export interface Plane {
  readonly element: HTMLElement; readonly outside: number;
  contains(point: Complex): boolean;
  update(point: MappingPoint): void;
}
/** Equal scales on both axes; data outside the declared box is clipped, never clamped. */
export function plane(model: Model, points: readonly MappingPoint[], source: boolean, criticalView = false): Plane {
  const title = source ? 'Source unit circle and retained roots' : criticalView ? 'Loop image near the critical point; clipped view' : 'Full displayed loop image';
  const region = document.createElement('div'); region.className = 'dn-plot-scroll'; region.tabIndex = 0;
  region.setAttribute('role', 'region'); region.setAttribute('aria-label', `${title}; horizontally scrollable`);
  const image = svg('svg', { viewBox: '0 0 480 435', role: 'img', 'aria-label': title }); region.append(image); image.append(svg('title', {}, title));
  const left = 94, top = 36, size = 330;
  let cx = 0, cy = 0, extent = 1.6;
  if (!source) {
    if (criticalView) { cx = -1; extent = 2; }
    else {
      let minX = -1, maxX = 0, minY = 0, maxY = 0;
      for (const p of points) if (p.loop) { minX = Math.min(minX, p.loop.re); maxX = Math.max(maxX, p.loop.re); minY = Math.min(minY, p.loop.im); maxY = Math.max(maxY, p.loop.im); }
      // Real coefficients give conjugate symmetry. Keep the real axis exactly at zero.
      cx = (minX + maxX) / 2; cy = 0; extent = Math.max((maxX - minX) / 2, Math.abs(minY), Math.abs(maxY), .5) * 1.15;
    }
  }
  const minX = cx - extent, maxY = cy + extent, scale = size / (2 * extent);
  const x = (value: number): number => (value - minX) * scale, y = (value: number): number => (maxY - value) * scale;
  const inside = (p: Complex): boolean => Math.abs(p.re - cx) <= extent && Math.abs(p.im - cy) <= extent;
  for (let i = 0; i <= 4; i++) {
    const xp = left + size * i / 4, yp = top + size * i / 4;
    image.append(svg('line', { x1: String(xp), x2: String(xp), y1: String(top), y2: String(top + size), class: 'dn-gridline' }));
    image.append(svg('line', { x1: String(left), x2: String(left + size), y1: String(yp), y2: String(yp), class: 'dn-gridline' }));
    image.append(svg('text', { x: String(xp), y: String(top + size + 23), 'text-anchor': 'middle' }, tick(minX + 2 * extent * i / 4)));
    image.append(svg('text', { x: String(left - 9), y: String(yp + 4), 'text-anchor': 'end' }, tick(maxY - 2 * extent * i / 4)));
  }
  image.append(svg('text', { x: String(left), y: '18' }, source ? 'Im z' : 'Im L (dimensionless)'));
  image.append(svg('text', { x: String(left + size / 2), y: '419', 'text-anchor': 'middle' }, source ? 'Re z' : 'Re L (dimensionless)'));
  // A nested SVG supplies its own clip viewport without shared/global IDs.
  const data = svg('svg', { x: String(left), y: String(top), width: String(size), height: String(size), viewBox: `0 0 ${size} ${size}`, overflow: 'hidden' }); image.append(data);
  if (minX <= 0 && minX + 2 * extent >= 0) data.append(svg('line', { x1: String(x(0)), x2: String(x(0)), y1: '0', y2: String(size), class: 'dn-axis' }));
  if (cy - extent <= 0 && cy + extent >= 0) data.append(svg('line', { x1: '0', x2: String(size), y1: String(y(0)), y2: String(y(0)), class: 'dn-axis' }));
  function arrow(a: Complex, b: Complex): void {
    const dx = x(b.re) - x(a.re), dy = y(b.im) - y(a.im), length = Math.hypot(dx, dy); if (length < 1e-9) return;
    const ux = dx / length, uy = dy / length, px = x(b.re), py = y(b.im);
    data.append(svg('path', { d: `M${px - 8 * ux + 4 * uy} ${py - 8 * uy - 4 * ux} L${px} ${py} L${px - 8 * ux - 4 * uy} ${py - 8 * uy + 4 * ux}`, class: 'dn-direction', fill: 'none' }));
  }
  let outside = 0;
  if (source) {
    data.append(svg('circle', { cx: String(x(0)), cy: String(y(0)), r: String(scale), class: 'dn-contour', fill: 'none' }));
    for (const angle of [Math.PI / 4, 5 * Math.PI / 4]) arrow(unit(angle - .03), unit(angle));
    for (const [roots, closed] of [[model.openRoots.roots, false], [model.closedRoots.roots, true]] as const) for (const root of roots) {
      if (!inside(root)) { outside += root.multiplicity; continue; }
      const px = x(root.re), py = y(root.im);
      if (closed) data.append(svg('circle', { cx: String(px), cy: String(py), r: '7', class: 'dn-closed-root', fill: 'none' }));
      else data.append(svg('path', { d: `M${px - 5} ${py - 5} L${px + 5} ${py + 5} M${px - 5} ${py + 5} L${px + 5} ${py - 5}`, class: 'dn-open-root' }));
      if (root.multiplicity > 1) data.append(svg('text', { x: String(px + 9), y: String(py - 7) }, `×${root.multiplicity}`));
    }
  } else {
    let d = '', connected = false, previous: Complex | undefined, totalLength = 0;
    const segments: { a: Complex; b: Complex; end: number }[] = [];
    for (const p of points) {
      if (!p.loop) { connected = false; previous = undefined; continue; }
      d += `${connected ? 'L' : 'M'}${x(p.loop.re).toFixed(3)} ${y(p.loop.im).toFixed(3)} `; connected = true;
      if (previous) {
        const length = Math.hypot(p.loop.re - previous.re, p.loop.im - previous.im);
        if (length) { totalLength += length; segments.push({ a: previous, b: p.loop, end: totalLength }); }
      }
      previous = p.loop;
      if (!inside(p.loop)) outside++;
    }
    data.append(svg('path', { d, class: 'dn-image-curve', fill: 'none' }));
    // Distribute arrows along the drawn length, preserving the actual increasing-theta direction.
    for (const fraction of [.125, .375, .625, .875]) {
      const segment = segments.find(s => s.end >= totalLength * fraction); if (segment) arrow(segment.a, segment.b);
    }
    const px = x(-1), py = y(0);
    data.append(svg('path', { d: `M${px - 6} ${py} L${px + 6} ${py} M${px} ${py - 6} L${px} ${py + 6}`, class: 'dn-critical' }));
    data.append(svg('text', { x: String(px + 9), y: String(py + 17) }, '−1'));
  }
  const anchor = source ? { re: 0, im: 0 } : { re: -1, im: 0 };
  const ray = svg('line', { x1: String(x(anchor.re)), y1: String(y(anchor.im)), x2: '0', y2: '0', class: 'dn-ray' });
  const marker = svg('circle', { cx: '0', cy: '0', r: '5', class: 'dn-marker' }); data.append(ray, marker);
  function update(point: MappingPoint): void {
    const p = source ? point.z : point.loop;
    marker.setAttribute('visibility', p ? 'visible' : 'hidden'); ray.setAttribute('visibility', p ? 'visible' : 'hidden');
    if (p) { marker.setAttribute('cx', String(x(p.re))); marker.setAttribute('cy', String(y(p.im))); ray.setAttribute('x2', String(x(p.re))); ray.setAttribute('y2', String(y(p.im))); }
  }
  return { element: region, update, outside, contains: inside };
}
