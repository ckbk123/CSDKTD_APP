export interface Axis { x: [number, number]; y: [number, number] }
export interface Geometry extends Axis { width: number; height: number; left: number; right: number; top: number; bottom: number }
export interface Marker { key: string; x: number; y: number; name: string; zero?: boolean; repeated?: boolean; selected?: boolean; highlighted?: boolean }
export interface Curve { name: string; values: readonly number[]; className: string; term?: number }
const ns = 'http://www.w3.org/2000/svg';
const node = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] => { const e = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([key, value]) => e.setAttribute(key, String(value))); if (text !== undefined) e.textContent = text; return e; };
const fmt = (n: number) => Number(n.toPrecision(3)).toString();
function frame(width: number, axis: Axis, equal: boolean, title: string, xLabel: string, yLabel: string) {
  width = Math.max(200, width); const height = 315, left = Math.min(70, width * .25), right = width - 24, top = 34, bottom = 258;
  let x: [number, number] = [...axis.x], y: [number, number] = [...axis.y];
  if (equal) { const u = Math.max((x[1] - x[0]) / (right - left), (y[1] - y[0]) / (bottom - top)), cx = (x[0] + x[1]) / 2, cy = (y[0] + y[1]) / 2; x = [cx - u * (right - left) / 2, cx + u * (right - left) / 2]; y = [cy - u * (bottom - top) / 2, cy + u * (bottom - top) / 2]; }
  const geometry: Geometry = { x, y, width, height, left, right, top, bottom }, X = (v: number) => left + (v - x[0]) / (x[1] - x[0]) * (right - left), Y = (v: number) => bottom - (v - y[0]) / (y[1] - y[0]) * (bottom - top);
  const figure = document.createElement('figure'), caption = document.createElement('figcaption'); figure.className = 'cp02-live-plot'; caption.textContent = title; figure.append(caption);
  const image = node('svg', { viewBox: `0 0 ${width} ${height}`, role: 'group', 'aria-label': `${title}. ${xLabel}; ${yLabel}.` }); figure.append(image);
  const ticks = width < 440 ? 2 : 4;
  for (let i = 0; i <= ticks; i++) { const xv = x[0] + (x[1] - x[0]) * i / ticks, yv = y[0] + (y[1] - y[0]) * i / ticks; image.append(node('line', { x1: left, x2: right, y1: Y(yv), y2: Y(yv), class: 'modes-grid' }), node('text', { x: left - 7, y: Y(yv) + 4, 'text-anchor': 'end' }, fmt(yv)), node('text', { x: X(xv), y: 279, 'text-anchor': 'middle' }, fmt(xv))); }
  if (y[0] <= 0 && y[1] >= 0) image.append(node('line', { x1: left, x2: right, y1: Y(0), y2: Y(0), class: 'modes-axis' }));
  if (x[0] <= 0 && x[1] >= 0) image.append(node('line', { x1: X(0), x2: X(0), y1: top, y2: bottom, class: 'modes-axis' }));
  image.append(node('text', { x: (left + right) / 2, y: 308, 'text-anchor': 'middle' }, xLabel), node('text', { x: left, y: 21 }, yLabel));
  const viewport = node('svg', { x: left, y: top, width: right - left, height: bottom - top, viewBox: `${left} ${top} ${right - left} ${bottom - top}`, overflow: 'hidden' }); image.append(viewport);
  return { figure, image, viewport, geometry, X, Y };
}
export function fitPlane(points: readonly Marker[]): Axis { let xmin = -3, xmax = 2, ymin = -3, ymax = 3; for (const p of points) { xmin = Math.min(xmin, p.x - .6); xmax = Math.max(xmax, p.x + .6); ymin = Math.min(ymin, p.y - .6); ymax = Math.max(ymax, p.y + .6); } return { x: [xmin, xmax], y: [ymin, ymax] }; }
export function fitResponse(curves: readonly Curve[]): [number, number] { let lo = 0, hi = 0; for (const c of curves) for (const v of c.values) { if (!Number.isFinite(v)) throw new Error('Numerical response overflowed. Shorten the horizon.'); lo = Math.min(lo, v); hi = Math.max(hi, v); } const pad = Math.max(1e-12, (hi - lo || 1) * .1); return [lo - pad, hi + pad]; }
export function plane(points: readonly Marker[], width: number, axis: Axis) {
  const d = frame(width, axis, true, 'Original poles and real numerator zero', 'Real part (s⁻¹)', 'Imaginary part (s⁻¹)'); let clipped = false;
  const ordered = [...points].sort((a, b) => Number(!!a.selected) - Number(!!b.selected));
  for (const p of ordered) {
    if (p.x < d.geometry.x[0] || p.x > d.geometry.x[1] || p.y < d.geometry.y[0] || p.y > d.geometry.y[1]) { clipped = true; continue; }
    const x = d.X(p.x), y = d.Y(p.y), group = node('g', { 'data-cp02-marker': p.key, tabindex: 0, role: p.zero ? 'slider' : 'button', 'aria-label': p.name, class: `cp02-live-marker${p.highlighted ? ' highlighted' : ''}${p.selected ? ' selected' : ''}` });
    if (p.zero) { group.setAttribute('aria-orientation', 'horizontal'); group.setAttribute('aria-valuemin', '-10'); group.setAttribute('aria-valuemax', '10'); group.setAttribute('aria-valuenow', String(p.x)); group.setAttribute('aria-valuetext', `Real zero ${p.x} per second`); }
    else group.setAttribute('aria-roledescription', 'pole coordinate control');
    group.append(node('title', {}, p.name));
    if (p.zero) group.append(node('circle', { cx: x, cy: y, r: 7, class: 'cp02-zero-glyph' }));
    else { group.append(node('path', { d: `M${x - 5},${y - 5}L${x + 5},${y + 5}M${x - 5},${y + 5}L${x + 5},${y - 5}`, class: 'cp02-pole-glyph' })); if (p.repeated) group.append(node('text', { x: x + 10, y: y - 9 }, '×2')); }
    group.append(node('circle', { cx: x, cy: y, r: 22.5, class: 'cp02-live-hit' })); d.image.append(group);
  }
  return { ...d, clipped };
}
export function response(times: readonly number[], curves: readonly Curve[], width: number, yAxis: [number, number]) {
  const d = frame(width, { x: [0, times[times.length - 1]], y: yAxis }, false, 'Full unit-step output and weighted components', 'Time t (s)', 'Output / unit input'); let clipped = false;
  for (const c of curves) { clipped ||= c.values.some(v => v < yAxis[0] || v > yAxis[1]); const path = node('path', { d: c.values.map((v, i) => `${i ? 'L' : 'M'}${d.X(times[i])},${d.Y(v)}`).join(' '), class: c.className, fill: 'none' }); if (c.term !== undefined) path.dataset.term = String(c.term); path.append(node('title', {}, c.name)); d.viewport.append(path); }
  const line = node('line', { y1: d.geometry.top, y2: d.geometry.bottom, class: 'cp02-time-line' }), marker = node('circle', { r: 4, class: 'cp02-time-point' }), handle = node('g', { 'data-cp02-time': 'true', tabindex: 0, role: 'slider', 'aria-label': 'Move linked time cursor', 'aria-valuemin': 0, 'aria-valuemax': times[times.length - 1] }), hit = node('circle', { r: 22.5, cy: d.geometry.top + 8, class: 'cp02-live-hit' }); handle.append(hit); d.viewport.append(line, marker); d.image.append(handle);
  return { ...d, clipped, select(t: number, output: number) { const x = d.X(t), y = d.Y(output); line.setAttribute('x1', String(x)); line.setAttribute('x2', String(x)); marker.setAttribute('cx', String(x)); marker.setAttribute('cy', String(y)); marker.setAttribute('visibility', output >= yAxis[0] && output <= yAxis[1] ? 'visible' : 'hidden'); hit.setAttribute('cx', String(x)); handle.setAttribute('aria-valuenow', String(t)); handle.setAttribute('aria-valuetext', `Time ${t} seconds; full output ${output}`); } };
}
/** Account for SVG letterboxing; bounds remain the caller's original math limits. */
export function position(clientX: number, clientY: number, box: DOMRect, g: Geometry) {
  if (!(box.width > 0 && box.height > 0)) throw new Error('The plot is not ready for placement.'); const scale = Math.min(box.width / g.width, box.height / g.height), x = (clientX - box.left - (box.width - g.width * scale) / 2) / scale, y = (clientY - box.top - (box.height - g.height * scale) / 2) / scale;
  return { x: g.x[0] + (x - g.left) / (g.right - g.left) * (g.x[1] - g.x[0]), y: g.y[0] + (g.bottom - y) / (g.bottom - g.top) * (g.y[1] - g.y[0]) };
}
