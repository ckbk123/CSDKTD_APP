import type { Pole } from './math';
const NS = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] => { const node = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value))); if (text !== undefined) node.textContent = text; return node; };
const compact = (value: number) => Number(value.toPrecision(4)).toString().replace('e+', 'e');
export interface Axis { readonly low: number; readonly high: number }
export interface Trace { readonly name: string; readonly values: readonly number[]; readonly secondary?: boolean; readonly pattern?: string }
export const fitAxis = (traces: readonly Trace[]): Axis => { const values = traces.flatMap(trace => [...trace.values]), low = Math.min(0, ...values), high = Math.max(0, ...values), pad = high === low ? 1 : (high - low) * .12; return { low: low - pad, high: high + pad }; };
export const fitPlane = (points: readonly Pole[]): number => 1.15 * Math.max(1, ...points.flatMap(point => [Math.abs(point.re), Math.abs(point.im)]));
export function sequence(traces: readonly Trace[], T: number, seconds: boolean, held: boolean, axis: Axis, width: number) {
  width = Math.max(100, width); const left = 66, right = width - 16, top = 25, bottom = 215, last = traces[0].values.length - 1;
  const root = svg('svg', { viewBox: `0 0 ${width} 265`, role: 'img', 'aria-label': `${traces.map(trace => trace.name).join('; ')}. Computed discrete stems; ${seconds ? 'seconds' : 'sample index'}; held stairs are only a drawing guide.` });
  const x = (k: number) => left + k / last * (right - left), y = (value: number) => bottom - (value - axis.low) / (axis.high - axis.low) * (bottom - top), viewport = svg('svg', { x: left, y: top, width: right - left, height: bottom - top, viewBox: `${left} ${top} ${right - left} ${bottom - top}`, overflow: 'hidden' });
  root.append(svg('path', { d: `M${left} ${top}V${bottom}H${right}`, class: 'dp01-live-axis' }));
  for (const value of [axis.low, 0, axis.high]) if (value >= axis.low && value <= axis.high) root.append(svg('text', { x: left - 7, y: y(value) + 4, 'text-anchor': 'end', 'font-size': 12 }, compact(value)));
  for (const k of [0, Math.floor(last / 2), last]) root.append(svg('text', { x: x(k), y: 239, 'text-anchor': 'middle', 'font-size': 12 }, compact(seconds ? k * T : k)));
  root.append(svg('text', { x: (left + right) / 2, y: 261, 'text-anchor': 'middle', 'font-size': 12 }, seconds ? 'Time t=kT (s)' : 'Integer sample k'));
  viewport.append(svg('line', { x1: left, x2: right, y1: y(0), y2: y(0), class: 'dp01-live-axis' }));
  traces.forEach(trace => {
    const cls = trace.secondary ? 'dp01-live-secondary' : 'dp01-live-primary';
    trace.values.forEach((value, k) => viewport.append(svg('line', { x1: x(k), x2: x(k), y1: y(0), y2: y(value), class: `${cls} dp01-live-stem`, 'stroke-dasharray': trace.pattern ?? (trace.secondary ? '3 2' : '') }), svg('circle', { cx: x(k), cy: y(value), r: 2.5, class: cls })));
    if (held) viewport.append(svg('path', { d: trace.values.map((value, k) => k ? `H${x(k)}V${y(value)}` : `M${x(k)} ${y(value)}`).join(' '), fill: 'none', class: `${cls} dp01-held-guide`, 'stroke-dasharray': '5 4' }));
  });
  const cursor = svg('line', { y1: top, y2: bottom, class: 'dp01-live-cursor' }), markers = traces.map(() => svg('circle', { r: 4.5, class: 'dp01-cursor-marker' })); viewport.append(cursor, ...markers); root.append(viewport);
  return { element: root, clipped: traces.some(trace => trace.values.some(value => value < axis.low || value > axis.high)), select(k: number) { cursor.setAttribute('x1', String(x(k))); cursor.setAttribute('x2', String(x(k))); traces.forEach((trace, i) => { const value = trace.values[k]; markers[i].setAttribute('cx', String(x(k))); markers[i].setAttribute('cy', String(y(value))); markers[i].setAttribute('visibility', value >= axis.low && value <= axis.high ? 'visible' : 'hidden'); }); }, fromEvent(event: MouseEvent) { const box = root.getBoundingClientRect(); if (!box.width || !box.height) return undefined; const scale = Math.min(box.width / width, box.height / 265), offset = (box.width - scale * width) / 2; return Math.max(0, Math.min(last, Math.round(((event.clientX - box.left - offset) / scale - left) / (right - left) * last))); } };
}
export interface Mark extends Pole { readonly label: string; readonly selected?: boolean; readonly handle?: 'a' | 'b'; readonly ghost?: boolean }
export function plane(points: readonly Mark[], extent: number, width: number, title: string) {
  const scale = 440 / Math.max(1, width), root = svg('svg', { viewBox: '0 0 440 350', role: points.some(point => point.handle) ? 'group' : 'img', 'aria-label': title }); root.style.setProperty('--dp01-axis-font', `${12 * scale}px`);
  // Bounded lab points stay inside the fixed axes; let their 44px hit regions
  // extend beyond the inner viewport at an edge. Arbitrary retained roots clip.
  const data = svg('svg', { x: 80, y: 20, width: 280, height: 280, viewBox: '0 0 280 280', overflow: points.some(point => point.handle) ? 'visible' : 'hidden' }), x = (value: number) => 140 + value / extent * 140, y = (value: number) => 140 - value / extent * 140;
  data.append(svg('circle', { cx: 140, cy: 140, r: 140 / extent, class: 'dp01-unit-disk' }), svg('path', { d: 'M0 140H280M140 0V280', class: 'dp01-live-axis' }), svg('circle', { cx: 140, cy: 140, r: 140 / extent, class: 'dp01-unit-circle' }));
  for (const value of [-extent, 0, extent]) { root.append(svg('text', { x: 80 + x(value), y: 319, 'text-anchor': 'middle' }, compact(value))); if (value) root.append(svg('text', { x: 72, y: 24 + y(value), 'text-anchor': 'end' }, compact(value))); }
  const selectedOrder = [...points.filter(point => !point.selected), ...points.filter(point => point.selected)];
  // Decorative conjugates cannot cover an editable point near the real axis.
  const ordered = [...selectedOrder.filter(point => !point.handle), ...selectedOrder.filter(point => point.handle)];
  for (const point of ordered) {
    const px = x(point.re), py = y(point.im), r = 5 * scale, group = svg('g', { class: point.selected ? 'dp01-selected-root' : '' });
    if (point.ghost) group.append(svg('circle', { cx: px, cy: py, r: 5 * scale, class: 'dp01-ghost-root' })); else group.append(svg('path', { d: `M${px - r} ${py - r}L${px + r} ${py + r}M${px - r} ${py + r}L${px + r} ${py - r}`, class: 'dp01-root-cross' }));
    group.append(svg('title', {}, point.label));
    if (point.handle) { group.setAttribute('role', 'button'); group.setAttribute('tabindex', '0'); group.dataset.labHandle = point.handle; group.setAttribute('aria-label', point.label + '; Left/Right change angle by 1 degree, Up/Down change shared radius by 0.01; Shift ten steps.'); group.append(svg('circle', { cx: px, cy: py, r: 22 * scale, class: 'dp01-lab-hit' })); }
    data.append(group);
  }
  root.append(data, svg('text', { x: 220, y: 343, 'text-anchor': 'middle' }, 'Real part Re(z)'), svg('text', { transform: 'translate(18 160) rotate(-90)', 'text-anchor': 'middle' }, 'Imaginary part Im(z)'));
  return { element: root, clipped: points.some(point => Math.abs(point.re) > extent || Math.abs(point.im) > extent), fromEvent(event: MouseEvent) { const box = root.getBoundingClientRect(); if (!box.width || !box.height) return undefined; const ratio = Math.min(box.width / 440, box.height / 350), left = (box.width - ratio * 440) / 2, top = (box.height - ratio * 350) / 2; return { re: ((event.clientX - box.left - left) / ratio - 220) * extent / 140, im: (160 - (event.clientY - box.top - top) / ratio) * extent / 140 }; } };
}
