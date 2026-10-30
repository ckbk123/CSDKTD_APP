import type { Kind, Point } from './nyquist';

export interface XY { x: number; y: number }
export interface Series { name: string; points: readonly XY[]; color: string; dashed?: boolean }
export interface Mark extends XY { label: string; cross?: boolean; color?: string }
/** Keep the complete source path while each finite mapped run owns its own series. */
export function contourSeries(points: readonly Point[], colors: Readonly<Record<Kind, string>>): { source: Series[]; image: Series[] } {
  const source: Series[] = [], image: Series[] = []; let previous: Point | undefined, mappedRun: XY[] | undefined;
  const mapped = (point?: Point): XY | undefined => point?.response.kind === 'value' && Number.isFinite(point.response.value.re) && Number.isFinite(point.response.value.im) ? { x: point.response.value.re, y: point.response.value.im } : undefined;
  for (const point of points) {
    const changedKind = !previous || previous.kind !== point.kind;
    if (changedKind) source.push({ name: point.kind, points: previous ? [{ x: previous.source.re, y: previous.source.im }] : [], color: colors[point.kind], dashed: point.kind === 'negative-axis' });
    (source.at(-1)!.points as XY[]).push({ x: point.source.re, y: point.source.im });
    const value = mapped(point);
    if (!value) mappedRun = undefined;
    else {
      if (changedKind || !mappedRun) {
        const prior = changedKind ? mapped(previous) : undefined; mappedRun = prior ? [prior] : [];
        image.push({ name: point.kind, points: mappedRun, color: colors[point.kind], dashed: point.kind === 'negative-axis' });
      }
      mappedRun.push(value);
    }
    previous = point;
  }
  return { source, image };
}
const ns = 'http://www.w3.org/2000/svg';
const fmt = (v: number) => Math.abs(v) < 1e-12 ? '0' : Number(v.toPrecision(3)).toString();
function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string) {
  const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); if (text !== undefined) e.textContent = text; return e;
}
/** Cartesian clipping preserves gaps where the curve leaves the view. */
export function clip(a: XY, b: XY, xmin: number, xmax: number, ymin: number, ymax: number): [XY, XY] | null {
  let lo = 0, hi = 1; const dx = b.x - a.x, dy = b.y - a.y;
  for (const [p, q] of [[-dx, a.x - xmin], [dx, xmax - a.x], [-dy, a.y - ymin], [dy, ymax - a.y]]) {
    if (!p) { if (q < 0) return null; continue; }
    const t = q / p; if (p < 0) lo = Math.max(lo, t); else hi = Math.min(hi, t); if (lo > hi) return null;
  }
  return [{ x: a.x + lo * dx, y: a.y + lo * dy }, { x: a.x + hi * dx, y: a.y + hi * dy }];
}
export function plot(title: string, series: readonly Series[], marks: readonly Mark[], labels: [string, string], zoom = false, equal = true): HTMLElement {
  const figure = document.createElement('figure'), caption = document.createElement('figcaption'); caption.textContent = title; figure.append(caption);
  const svg = node('svg', { viewBox: '0 0 640 500', role: 'img', 'aria-label': title }); figure.append(svg);
  const values = [...series.flatMap(s => s.points), ...marks].filter(v => Number.isFinite(v.x) && Number.isFinite(v.y));
  let xmin = Math.min(0, ...values.map(v => v.x)), xmax = Math.max(0, ...values.map(v => v.x)), ymin = Math.min(0, ...values.map(v => v.y)), ymax = Math.max(0, ...values.map(v => v.y));
  const padx = .08 * Math.max(1, xmax - xmin), pady = .08 * Math.max(1, ymax - ymin); xmin -= padx; xmax += padx; ymin -= pady; ymax += pady;
  if (zoom) { xmin = -4; xmax = 2; ymin = -3; ymax = 3; }
  const left = 86, top = 40, width = 532, height = 390;
  if (equal) { const scale = Math.max((xmax - xmin) / width, (ymax - ymin) / height), cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2; xmin = cx - scale * width / 2; xmax = cx + scale * width / 2; ymin = cy - scale * height / 2; ymax = cy + scale * height / 2; }
  const x = (v: number) => left + (v - xmin) / (xmax - xmin) * width, y = (v: number) => top + height - (v - ymin) / (ymax - ymin) * height;
  svg.append(node('rect', { x: left, y: top, width, height, fill: '#fff', stroke: '#d5dce6' }));
  for (let i = 0; i <= 4; i++) {
    const vx = xmin + (xmax - xmin) * i / 4, vy = ymin + (ymax - ymin) * i / 4;
    svg.append(node('line', { x1: x(vx), x2: x(vx), y1: top, y2: top + height, stroke: '#e6ebf2' }), node('line', { x1: left, x2: left + width, y1: y(vy), y2: y(vy), stroke: '#e6ebf2' }));
    svg.append(node('text', { x: x(vx), y: top + height + 29, 'text-anchor': i === 0 ? 'start' : i === 4 ? 'end' : 'middle' }, fmt(vx)), node('text', { x: left - 7, y: y(vy) + 7, 'text-anchor': 'end' }, fmt(vy)));
  }
  if (xmin < 0 && xmax > 0) svg.append(node('line', { x1: x(0), x2: x(0), y1: top, y2: top + height, stroke: '#8391a5' }));
  if (ymin < 0 && ymax > 0) svg.append(node('line', { x1: left, x2: left + width, y1: y(0), y2: y(0), stroke: '#8391a5' }));
  svg.append(node('text', { x: left + 50, y: 22 }, labels[1]), node('text', { x: 618, y: 485, 'text-anchor': 'end' }, labels[0]));
  for (const s of series) {
    let path = ''; const arrows: [XY, XY][] = [];
    for (let i = 1; i < s.points.length; i++) {
      const c = clip(s.points[i - 1], s.points[i], xmin, xmax, ymin, ymax); if (!c) continue;
      path += `M${x(c[0].x).toFixed(2)},${y(c[0].y).toFixed(2)}L${x(c[1].x).toFixed(2)},${y(c[1].y).toFixed(2)}`;
      if (i % Math.max(1, Math.floor(s.points.length / 5)) === 0 && Math.hypot(x(c[1].x) - x(c[0].x), y(c[1].y) - y(c[0].y)) > 1) arrows.push(c);
    }
    svg.append(node('path', { d: path, fill: 'none', stroke: s.color, 'stroke-width': 2.4, 'stroke-dasharray': s.dashed ? '7 5' : 'none' }));
    for (const [a, b] of arrows) { const dx = x(b.x) - x(a.x), dy = y(b.y) - y(a.y), norm = Math.hypot(dx, dy), ux = dx / norm, uy = dy / norm, bx = (x(a.x) + x(b.x)) / 2, by = (y(a.y) + y(b.y)) / 2; svg.append(node('path', { d: `M${bx - 7 * ux + 4 * uy},${by - 7 * uy - 4 * ux}L${bx},${by}L${bx - 7 * ux - 4 * uy},${by - 7 * uy + 4 * ux}`, fill: 'none', stroke: s.color, 'stroke-width': 2 })); }
  }
  for (const m of marks) if (m.x >= xmin && m.x <= xmax && m.y >= ymin && m.y <= ymax) {
    const color = m.color ?? '#a43a39', px = x(m.x), py = y(m.y);
    svg.append(m.cross ? node('path', { d: `M${px - 5},${py - 5}L${px + 5},${py + 5}M${px + 5},${py - 5}L${px - 5},${py + 5}`, stroke: color, 'stroke-width': 2.5 }) : node('circle', { cx: px, cy: py, r: 4.5, fill: color }));
    if (m.label) svg.append(node('text', { x: px + (px > 500 ? -9 : 9), y: py - 10, 'text-anchor': px > 500 ? 'end' : 'start', fill: color }, m.label));
  }
  return figure;
}
