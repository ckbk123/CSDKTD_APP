import type { Complex } from './math';
export interface Axis { x: [number, number]; y: [number, number] }
export interface Curve { label: string; points: Complex[]; dashed?: boolean }
export interface Point extends Complex { label: string; kind: 'pole' | 'zero' | 'root'; handle?: 'pole' | 'upper' | 'lower'; value?: string }
export interface Geometry extends Axis { width: number; height: number; left: number; right: number; top: number; bottom: number }
const ns = 'http://www.w3.org/2000/svg';
export function draw({ title, width, curves, points = [], axis, equal = false, xLabel, yLabel }: { title: string; width: number; curves: Curve[]; points?: Point[]; axis?: Axis; equal?: boolean; xLabel: string; yLabel: string }) {
  width = Math.max(200, width); const height = 310, left = Math.min(70, width * .25), right = width - 24, top = 35, bottom = 251;
  const figure = document.createElement('figure'), caption = document.createElement('figcaption'); figure.className = 'cd02-live-plot'; caption.textContent = title; figure.append(caption);
  let x: [number, number], y: [number, number];
  if (axis) { x = [...axis.x]; y = [...axis.y]; }
  else {
    let loX = 0, hiX = 0, loY = 0, hiY = 0;
    const include = (p: Complex) => { loX = Math.min(loX, p.re); hiX = Math.max(hiX, p.re); loY = Math.min(loY, p.im); hiY = Math.max(hiY, p.im); }; points.forEach(include); curves.forEach(c => c.points.forEach(include));
    const px = Math.max(.1, (hiX - loX) * .1), py = Math.max(.1, (hiY - loY) * .12);
    x = [loX - px, hiX + px]; y = [loY - py, hiY + py];
  }
  if (equal) { const u = Math.max((x[1] - x[0]) / (right - left), (y[1] - y[0]) / (bottom - top)), cx = (x[0] + x[1]) / 2, cy = (y[0] + y[1]) / 2; x = [cx - u * (right - left) / 2, cx + u * (right - left) / 2]; y = [cy - u * (bottom - top) / 2, cy + u * (bottom - top) / 2]; }
  const geometry: Geometry = { x, y, width, height, left, right, top, bottom }, X = (n: number) => left + (n - x[0]) / (x[1] - x[0]) * (right - left), Y = (n: number) => bottom - (n - y[0]) / (y[1] - y[0]) * (bottom - top);
  const image = document.createElementNS(ns, 'svg'); image.setAttribute('viewBox', `0 0 ${width} ${height}`); image.setAttribute('role', 'img'); image.setAttribute('aria-label', `${title}. ${xLabel}; ${yLabel}. ${curves.map(c => c.label).join('; ')}. ${points.map(p => p.label).join('; ')}`); figure.append(image);
  function add(name: string, attrs: Record<string, string>, text?: string, host: SVGElement = image) { const e = document.createElementNS(ns, name); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (text !== undefined) e.textContent = text; host.append(e); return e; }
  const ticks = width < 440 ? 2 : 4;
  for (let i = 0; i <= ticks; i++) { const xv = x[0] + (x[1] - x[0]) * i / ticks, yv = y[0] + (y[1] - y[0]) * i / ticks; add('line', { x1: String(left), x2: String(right), y1: String(Y(yv)), y2: String(Y(yv)), class: 'cd02-gridline' }); add('text', { x: String(left - 7), y: String(Y(yv) + 4), 'text-anchor': 'end' }, Number(yv.toPrecision(3)).toString()); add('text', { x: String(X(xv)), y: '272', 'text-anchor': 'middle' }, Number(xv.toPrecision(3)).toString()); }
  if (x[0] <= 0 && x[1] >= 0) add('line', { x1: String(X(0)), x2: String(X(0)), y1: String(top), y2: String(bottom), class: 'cd02-axis' });
  if (y[0] <= 0 && y[1] >= 0) add('line', { x1: String(left), x2: String(right), y1: String(Y(0)), y2: String(Y(0)), class: 'cd02-axis' });
  const clip = add('svg', { x: String(left), y: String(top), width: String(right - left), height: String(bottom - top), viewBox: `${left} ${top} ${right - left} ${bottom - top}`, overflow: 'hidden' });
  curves.forEach((c, index) => {
    const indices = new Set<number>([0, c.points.length - 1]), stride = Math.max(1, Math.ceil(c.points.length / 700));
    for (let i = 0; i < c.points.length; i += stride) { let lo = i, hi = i; for (let j = i; j < Math.min(c.points.length, i + stride); j++) { if (c.points[j].im < c.points[lo].im) lo = j; if (c.points[j].im > c.points[hi].im) hi = j; } indices.add(lo); indices.add(hi); }
    const d = [...indices].filter(i => i >= 0).sort((a, b) => a - b).map((i, n) => `${n ? 'L' : 'M'}${X(c.points[i].re)},${Y(c.points[i].im)}`).join(' '); add('path', { d, class: `cd02-line cd02-series-${index % 4}`, ...(c.dashed ? { 'stroke-dasharray': '6 5' } : {}) }, undefined, clip);
  });
  let clipped = curves.some(c => c.points.some(p => p.re < x[0] || p.re > x[1] || p.im < y[0] || p.im > y[1]));
  for (const p of points) {
    const px = X(p.re), py = Y(p.im), inside = px >= left && px <= right && py >= top && py <= bottom;
    if (!inside) { clipped = true; continue; }
    const group = add('g', { class: `cd02-point cd02-${p.kind}` });
    if (p.kind === 'pole') add('path', { d: `M${px - 5},${py - 5}L${px + 5},${py + 5}M${px - 5},${py + 5}L${px + 5},${py - 5}` }, undefined, group);
    else add('circle', { cx: String(px), cy: String(py), r: p.kind === 'zero' ? '7' : '3.5' }, undefined, group);
    add('title', {}, p.label, group);
    if (p.handle) { group.setAttribute('data-cd02-handle', p.handle); group.setAttribute('tabindex', '0'); group.setAttribute('role', p.handle === 'pole' ? 'slider' : 'button'); group.setAttribute('aria-label', p.handle === 'pole' ? p.label : `${p.label}. ${p.value ?? ''}`); if (p.handle === 'pole') { group.setAttribute('aria-valuetext', p.value ?? p.label); group.setAttribute('aria-orientation', 'horizontal'); group.setAttribute('aria-valuemin', '.2'); group.setAttribute('aria-valuemax', '50'); group.setAttribute('aria-valuenow', String(-p.re)); } else group.setAttribute('aria-roledescription', 'two-dimensional target control'); add('circle', { cx: String(px), cy: String(py), r: '22.5', class: 'cd02-hit' }, undefined, group); }
  }
  add('text', { x: String((left + right) / 2), y: '302', 'text-anchor': 'middle' }, xLabel); add('text', { x: String(left), y: '21' }, yLabel);
  const legend = document.createElement('p'); legend.className = 'cd02-note'; legend.textContent = curves.map(c => `${c.dashed ? '┄' : '━'} ${c.label}`).join(' · '); figure.append(legend);
  return { figure, image, geometry, clipped };
}
export function position(clientX: number, clientY: number, box: DOMRect, g: Geometry): Complex {
  if (!(box.width > 0 && box.height > 0)) throw new Error('The plot is not ready for placement.');
  const scale = Math.min(box.width / g.width, box.height / g.height), px = (clientX - box.left - (box.width - g.width * scale) / 2) / scale, py = (clientY - box.top - (box.height - g.height * scale) / 2) / scale;
  return { re: g.x[0] + (px - g.left) / (g.right - g.left) * (g.x[1] - g.x[0]), im: g.y[0] + (g.bottom - py) / (g.bottom - g.top) * (g.y[1] - g.y[0]) };
}
