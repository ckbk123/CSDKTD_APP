import type { Complex } from './model';
export interface Axis { x: [number, number]; y: [number, number] }
export interface Line { name: string; points: readonly Complex[]; style: string }
export interface Mark { point: Complex; kind: 'pole' | 'zero' | 'base' | 'full'; label: string; handle?: 'p' | 'z' | 'ratio' }
export interface Geometry extends Axis { width: number; height: number; left: number; right: number; top: number; bottom: number }
const ns = 'http://www.w3.org/2000/svg';
const fmt = (v: number) => v === 0 ? '0' : Number(v.toPrecision(5)).toString();
/** Data drawing only; every signal/mode originates in the original checked model. */
export function draw(title: string, width: number, lines: readonly Line[], marks: readonly Mark[], labels: [string, string], axis?: Axis, equal = false, height = 280) {
  width = Math.max(200, width); const left = Math.min(64, width * .24), right = width - 18, top = 26, bottom = height - 60;
  const points = [...marks.map(m => m.point), ...lines.flatMap(line => [...line.points])];
  let x: [number, number] = axis ? [...axis.x] : [Math.min(0, ...points.map(p => p.re)), Math.max(0, ...points.map(p => p.re))];
  let y: [number, number] = axis ? [...axis.y] : [Math.min(0, ...points.map(p => p.im)), Math.max(0, ...points.map(p => p.im))];
  if (!axis) { const dx = Math.max(.02, (x[1] - x[0]) * .08), dy = Math.max(.1, (y[1] - y[0]) * .1); x = [x[0] - dx, x[1] + dx]; y = [y[0] - dy, y[1] + dy]; }
  if (equal) { const unit = Math.max((x[1] - x[0]) / (right - left), (y[1] - y[0]) / (bottom - top)), cx = (x[0] + x[1]) / 2, cy = (y[0] + y[1]) / 2; x = [cx - unit * (right - left) / 2, cx + unit * (right - left) / 2]; y = [cy - unit * (bottom - top) / 2, cy + unit * (bottom - top) / 2]; }
  const geometry: Geometry = { x, y, width, height, left, right, top, bottom }, X = (v: number) => left + (v - x[0]) / (x[1] - x[0]) * (right - left), Y = (v: number) => bottom - (v - y[0]) / (y[1] - y[0]) * (bottom - top);
  const figure = document.createElement('figure'), caption = document.createElement('figcaption'); figure.className = 'cd03-chart'; caption.textContent = title; figure.append(caption);
  const image = document.createElementNS(ns, 'svg'); image.setAttribute('viewBox', '0 0 ' + width + ' ' + height); image.setAttribute('role', marks.some(mark => mark.handle) ? 'group' : 'img'); image.setAttribute('aria-label', title + '. ' + labels.join('; ') + '. ' + lines.map(l => l.name).join('; ') + '. ' + marks.map(m => m.label).join('; ')); figure.append(image);
  function add(tag: string, attributes: Record<string, string | number>, text?: string, host: SVGElement = image) { const node = document.createElementNS(ns, tag); for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, String(value)); if (text !== undefined) node.textContent = text; host.append(node); return node; }
  for (let i = 0; i <= 2; i++) { const xv = x[0] + (x[1] - x[0]) * i / 2, yv = y[0] + (y[1] - y[0]) * i / 2; add('line', { x1: left, x2: right, y1: Y(yv), y2: Y(yv), class: 'cd03-axis-grid' }); add('text', { x: left - 6, y: Y(yv) + 4, 'text-anchor': 'end' }, fmt(yv)); add('text', { x: X(xv), y: bottom + 23, 'text-anchor': 'middle' }, fmt(xv)); }
  add('text', { x: (left + right) / 2, y: height - 7, 'text-anchor': 'middle' }, labels[0]); add('text', { x: left, y: 15 }, labels[1]);
  const clip = add('svg', { x: left, y: top, width: right - left, height: bottom - top, viewBox: [left, top, right - left, bottom - top].join(' '), overflow: 'hidden' });
  if (y[0] <= 0 && y[1] >= 0) add('line', { x1: left, x2: right, y1: Y(0), y2: Y(0), class: 'cd03-axis-grid' }, undefined, clip);
  if (x[0] <= 0 && x[1] >= 0) add('line', { x1: X(0), x2: X(0), y1: top, y2: bottom, class: 'cd03-axis-grid' }, undefined, clip);
  for (const line of lines) add('path', { d: line.points.map((p, i) => (i ? 'L' : 'M') + X(p.re) + ',' + Y(p.im)).join(' '), class: line.style, 'vector-effect': 'non-scaling-stroke' }, undefined, clip);
  const clipped = points.some(p => p.re < x[0] || p.re > x[1] || p.im < y[0] || p.im > y[1]);
  for (const mark of marks) {
    const px = X(mark.point.re), py = Y(mark.point.im); if (px < left || px > right || py < top || py > bottom) continue;
    const group = add('g', { class: 'cd03-glyph cd03-glyph-' + mark.kind });
    if (mark.kind === 'zero') add('circle', { cx: px, cy: py, r: 7 }, undefined, group);
    else if (mark.kind === 'base') add('path', { d: 'M' + px + ',' + (py - 7) + 'l-6,11h12z' }, undefined, group);
    else add('path', { d: 'M' + (px - 5) + ',' + (py - 5) + 'L' + (px + 5) + ',' + (py + 5) + 'M' + (px - 5) + ',' + (py + 5) + 'L' + (px + 5) + ',' + (py - 5) }, undefined, group);
    add('title', {}, mark.label, group);
    if (mark.handle) { group.setAttribute('data-corner-handle', mark.handle); group.setAttribute('tabindex', '0'); group.setAttribute('role', 'button'); group.setAttribute('aria-label', mark.label + (mark.handle === 'ratio' ? '; move both corners preserving z/p' : '') + '; arrow keys move .001 per second, Shift .01'); add('circle', { cx: px, cy: py, r: 22.5, class: 'cd03-corner-hit' }, undefined, group); }
  }
  const cursor = add('line', { y1: top, y2: bottom, class: 'cd03-live-cursor', visibility: 'hidden' }, undefined, clip), dots = [0, 1].map(() => add('circle', { r: 4, class: 'cd03-live-dot', visibility: 'hidden' }, undefined, clip));
  const legend = document.createElement('p'); legend.className = 'cd03-chart-legend'; legend.textContent = lines.map(l => l.name).join(' · ') + (clipped ? '. Some checked values exceed the fixed view; Fit or use the numeric controls.' : ''); figure.append(legend);
  return { figure, image, geometry, clipped, inspect(time: number, values: readonly (number | undefined)[]) { cursor.setAttribute('x1', String(X(time))); cursor.setAttribute('x2', String(X(time))); cursor.setAttribute('visibility', 'visible'); dots.forEach((dot, i) => { const v = values[i]; dot.setAttribute('visibility', v !== undefined && v >= y[0] && v <= y[1] ? 'visible' : 'hidden'); dot.setAttribute('cx', String(X(time))); if (v !== undefined) dot.setAttribute('cy', String(Y(v))); }); } };
}
export function pointAt(clientX: number, box: DOMRect, g: Geometry): number {
  if (!Number.isFinite(clientX) || !(box.width > 0 && box.height > 0)) throw new Error('The corner drawing is not ready.');
  const scale = Math.min(box.width / g.width, box.height / g.height), px = (clientX - box.left - (box.width - g.width * scale) / 2) / scale;
  return g.x[0] + (px - g.left) * (g.x[1] - g.x[0]) / (g.right - g.left);
}
