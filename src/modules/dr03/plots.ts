import type { Result } from './math';
const NS = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] => { const node = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value))); if (text !== undefined) node.textContent = text; return node; };
export interface Axis { readonly low: number; readonly high: number }
export const fitAxis = (values: readonly number[]): Axis => { const low = Math.min(0, ...values), high = Math.max(0, ...values), pad = high === low ? 1 : (high - low) * .12; return { low: low - pad, high: high + pad }; };
const compact = (value: number) => Number(value.toPrecision(3)).toString().replace('e+', 'e');
export function stems(result: Result, kind: 'input' | 'output', axis: Axis, width: number) {
  width = Math.max(100, width); const left = 66, right = width - 12, top = 22, bottom = 145, last = result.rows.length - 1;
  const root = svg('svg', { viewBox: `0 0 ${width} 193`, role: 'img', 'aria-label': kind === 'input' ? 'Checked input samples u[k]' : 'Checked output samples; history stems and independent recurrence rings' });
  const x = (k: number) => left + k / last * (right - left), y = (value: number) => bottom - (value - axis.low) / (axis.high - axis.low) * (bottom - top), values = kind === 'input' ? result.inputs : result.rows.map(row => row.y);
  const viewport = svg('svg', { x: left, y: top, width: right - left, height: bottom - top, viewBox: `${left} ${top} ${right - left} ${bottom - top}`, overflow: 'hidden' });
  root.append(svg('path', { d: `M${left} ${top}V${bottom}H${right}`, class: 'dr03-live-axis' }));
  for (const value of [axis.low, 0, axis.high]) if (value >= axis.low && value <= axis.high) root.append(svg('text', { x: left - 7, y: y(value) + 4, 'text-anchor': 'end', 'font-size': 12 }, compact(value)));
  for (const k of [0, Math.floor(last / 2), last]) root.append(svg('text', { x: x(k), y: 168, 'text-anchor': 'middle', 'font-size': 12 }, String(k)));
  root.append(svg('text', { x: (left + right) / 2, y: 189, 'text-anchor': 'middle', 'font-size': 12 }, 'Sample k; t = kT seconds'));
  viewport.append(svg('line', { x1: left, x2: right, y1: y(0), y2: y(0), class: 'dr03-live-axis' }));
  values.forEach((value, k) => { viewport.append(svg('line', { x1: x(k), x2: x(k), y1: y(0), y2: y(value), class: 'dr03-live-stem' }), svg('circle', { cx: x(k), cy: y(value), r: 2.5, class: 'dr03-live-point' })); if (kind === 'output') viewport.append(svg('circle', { cx: x(k), cy: y(result.reference[k]), r: 4.5, class: 'dr03-live-reference' })); });
  const cursor = svg('line', { y1: top, y2: bottom, class: 'dr03-live-cursor' }), marker = svg('circle', { r: 5, class: 'dr03-live-marker' }); viewport.append(cursor, marker); root.append(viewport);
  return { element: root, clipped: values.some(value => value < axis.low || value > axis.high), select(k: number) { cursor.setAttribute('x1', String(x(k))); cursor.setAttribute('x2', String(x(k))); marker.setAttribute('cx', String(x(k))); marker.setAttribute('cy', String(y(values[k]))); marker.setAttribute('visibility', values[k] >= axis.low && values[k] <= axis.high ? 'visible' : 'hidden'); }, fromEvent(event: MouseEvent) { const box = root.getBoundingClientRect(); if (!box.width || !box.height) return undefined; const ratio = Math.min(box.width / width, box.height / 193), offset = (box.width - ratio * width) / 2; return Math.max(0, Math.min(last, Math.round(((event.clientX - box.left - offset) / ratio - left) / (right - left) * last))); } };
}
