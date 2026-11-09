import type { Analysis } from './math';
import type { Handle } from './families';
import type { Series } from './traces';
const NS = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] => { const node = document.createElementNS(NS, tag); Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value))); if (text !== undefined) node.textContent = text; return node; };
export const format = (value: number): string => value === 0 ? '0' : Number(value.toPrecision(7)).toString();
export const texNumber = (value: number): string => format(value).replace(/e([+-]?\d+)$/, (_, exponent: string) => `\\times10^{${Number(exponent)}}`);
export interface Axis { readonly low: number; readonly high: number }
export function fitAxis(series: Series): Axis {
  const values = series.curves.flatMap(curve => [...curve.values]); let low = Math.min(0, ...values), high = Math.max(0, ...values);
  if (!values.length || !Number.isFinite(low) || !Number.isFinite(high)) return { low: -1, high: 1 };
  if (high === low) { low -= 1; high += 1; } const pad = (high - low) * .1; return { low: low - pad, high: high + pad };
}
export const fitPlane = (analysis: Analysis): number => 1.35 * Math.max(1, ...analysis.eigenvalues.flatMap(root => [Math.abs(root.re), Math.abs(root.im)]));
export function rootPlane(analysis: Analysis, handles: readonly Handle[], chosen: string, extent: number) {
  const root = svg('svg', { viewBox: '0 0 440 350', role: 'group', 'aria-label': 'All original eigenvalues and retained scalar poles; family handles support arrow keys' });
  const data = svg('svg', { x: 80, y: 20, width: 280, height: 280, viewBox: '0 0 280 280', overflow: 'hidden', role: 'group', 'aria-label': 'Editable family pole positions' });
  const x = (value: number) => 140 + value / extent * 140, y = (value: number) => 140 - value / extent * 140;
  data.append(svg('rect', { x: 0, y: 0, width: 140, height: 280, class: 'cs01-left-half' }), svg('path', { d: 'M0 140H280M140 0V280', class: 'cs01-axis' }));
  for (const value of [-extent, 0, extent]) { root.append(svg('text', { x: 80 + x(value), y: 319, 'text-anchor': 'middle' }, format(value))); if (value !== 0) root.append(svg('text', { x: 72, y: 24 + y(value), 'text-anchor': 'end' }, format(value))); }
  const marks: { node: SVGPathElement; x: number; y: number }[] = [], hits: SVGCircleElement[] = [], retained: SVGCircleElement[] = [];
  for (const pole of analysis.poles) { const circle = svg('circle', { cx: x(pole.re), cy: y(pole.im), r: 9, class: 'cs01-retained-pole' }); data.append(circle); retained.push(circle); }
  for (const pole of analysis.eigenvalues) {
    const px = x(pole.re), py = y(pole.im), mark = svg('path', { class: 'cs01-root-cross' }); data.append(mark); marks.push({ node: mark, x: px, y: py });
    if (pole.multiplicity > 1) data.append(svg('text', { x: px + 12, y: py - 12 }, '×2'));
  }
  const ordered = [...handles.filter(handle => handle.id !== chosen), ...handles.filter(handle => handle.id === chosen)];
  for (const handle of ordered) {
    const px = x(handle.re), py = y(handle.im), group = svg('g', { role: 'button', tabindex: 0, 'data-family-handle': handle.id, 'aria-label': `${handle.label}: ${format(handle.re)} ${handle.im < 0 ? 'minus' : 'plus'} ${format(Math.abs(handle.im))}j; arrow keys move this family pole`, class: handle.id === chosen ? 'cs01-chosen-handle' : '' });
    const hit = svg('circle', { cx: px, cy: py, r: 22, fill: 'transparent', class: 'cs01-hit' }); hits.push(hit); group.append(hit); data.append(group);
  }
  root.append(data, svg('text', { x: 220, y: 343, 'text-anchor': 'middle' }, 'Real part σ (s⁻¹)'), svg('text', { transform: 'translate(18 160) rotate(-90)', 'text-anchor': 'middle' }, 'Imaginary part ω (rad/s)'));
  return { element: root, clipped: handles.some(handle => Math.abs(handle.re) > extent || Math.abs(handle.im) > extent), resize(width: number) {
    if (!(width > 0)) return; const scale = 440 / width; root.style.setProperty('--cs01-axis-font', `${12 * scale}px`);
    marks.forEach(mark => { const r = 5 * scale; mark.node.setAttribute('d', `M${mark.x - r} ${mark.y - r}L${mark.x + r} ${mark.y + r}M${mark.x - r} ${mark.y + r}L${mark.x + r} ${mark.y - r}`); }); hits.forEach(hit => hit.setAttribute('r', String(22 * scale))); retained.forEach(mark => mark.setAttribute('r', String(9 * scale)));
  }, fromEvent(event: MouseEvent) {
    const box = root.getBoundingClientRect(); if (!box.width || !box.height) return undefined;
    const scale = Math.min(box.width / 440, box.height / 350), left = (box.width - scale * 440) / 2, top = (box.height - scale * 350) / 2;
    return { re: Math.max(-extent, Math.min(extent, ((event.clientX - box.left - left) / scale - 220) * extent / 140)), im: Math.max(-extent, Math.min(extent, (160 - (event.clientY - box.top - top) / scale) * extent / 140)) };
  } };
}
export function timePlot(times: readonly number[], series: Series, axis: Axis, title: string, width: number) {
  const host = document.createElement('div'); host.className = 'cs01-time-drawing';
  if (series.error || !times.length || !series.curves.length) { const message = document.createElement('p'); message.className = 'cs01-warning'; message.textContent = series.error ?? 'This component is unavailable.'; host.append(message); return { element: host, clipped: false, select: (_t: number, _values: readonly number[] = []) => undefined }; }
  width = Math.max(240, width); const left = 70, right = width - 16, bottom = 210, top = 30, horizon = times.at(-1)!;
  const root = svg('svg', { viewBox: `0 0 ${width} 262`, role: 'img', 'aria-label': title }), x = (t: number) => left + (right - left) * t / horizon, y = (value: number) => bottom - (bottom - top) * (value - axis.low) / (axis.high - axis.low);
  const viewport = svg('svg', { x: left, y: top, width: right - left, height: bottom - top, viewBox: `${left} ${top} ${right - left} ${bottom - top}`, overflow: 'hidden' });
  root.append(svg('path', { d: `M${left} ${top}V${bottom}H${right}`, class: 'cs01-axis' }));
  for (const value of [axis.low, 0, axis.high]) if (value >= axis.low && value <= axis.high) root.append(svg('text', { x: left - 7, y: y(value) + 4, 'text-anchor': 'end', 'font-size': 12 }, format(value)));
  root.append(svg('text', { x: left, y: 233, 'font-size': 12 }, '0'), svg('text', { x: right, y: 233, 'text-anchor': 'end', 'font-size': 12 }, format(horizon)), svg('text', { x: (left + right) / 2, y: 255, 'text-anchor': 'middle', 'font-size': 12 }, 'Time t (s)'));
  series.curves.forEach(curve => viewport.append(svg('path', { d: curve.values.map((value, i) => `${i ? 'L' : 'M'}${x(times[i])},${y(value)}`).join(' '), class: 'cs01-response-line', 'stroke-dasharray': curve.pattern })));
  const cursor = svg('line', { y1: top, y2: bottom, class: 'cs01-time-cursor' }), markers = series.curves.map(() => svg('circle', { r: 4, class: 'cs01-time-marker' })); viewport.append(cursor, ...markers); root.append(viewport); host.append(root);
  const legend = document.createElement('p'); legend.className = 'cs01-note'; legend.textContent = series.curves.map(curve => `${curve.name} (${curve.pattern === '' ? 'solid' : curve.pattern === '7 4' ? 'dashed' : 'dotted'})`).join(' · '); host.append(legend);
  return { element: host, clipped: series.curves.some(curve => curve.values.some(value => value < axis.low || value > axis.high)), select(t: number, values: readonly number[] = []) { cursor.setAttribute('x1', String(x(t))); cursor.setAttribute('x2', String(x(t))); markers.forEach((marker, i) => { const value = values[i]; marker.setAttribute('visibility', Number.isFinite(value) && value >= axis.low && value <= axis.high ? 'visible' : 'hidden'); if (Number.isFinite(value)) { marker.setAttribute('cx', String(x(t))); marker.setAttribute('cy', String(y(value))); } }); } };
}
