import { fromAngular, type FrequencyUnit } from './math';

export interface Curve { name: string; values: readonly number[]; style: string }
export interface Axis { low: number; high: number }
export interface Marker { omega: number; name: string; style: string; factor?: number }
export interface Geometry { start: number; end: number; left: number; right: number; width: number }
export function format(value: number): string {
  if (!Number.isFinite(value)) return value === Infinity ? '∞' : '−∞';
  if (value === 0) return '0';
  if (Math.abs(value) >= .0001 && Math.abs(value) < 10000) return Number(value.toPrecision(7)).toString();
  return value.toExponential(3).replace('e+', 'e');
}
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value))); return node;
};
export function fittedAxis(curves: readonly Curve[], nonnegative = false): Axis {
  const values = curves.flatMap(c => [...c.values]);
  if (!values.length || values.some(v => !Number.isFinite(v))) throw new Error('A plotted value exceeds numerical limits. Check the data.');
  let low = Math.min(...values), high = Math.max(...values);
  if (high - low <= 16 * Number.EPSILON * Math.max(Math.abs(low), Math.abs(high))) { const pad = low === 0 ? 1 : Math.abs(low) * .1; low -= pad; high += pad; }
  const pad = (high - low) * .08; return { low: nonnegative ? Math.max(0, low - pad) : low - pad, high: high + pad };
}
export function pointerFrequency(clientX: number, rect: Pick<DOMRect, 'left' | 'width'>, geometry: Geometry): number {
  if (!Number.isFinite(clientX) || rect.width <= 0) throw new Error('The plot is not ready for pointer editing. Use the numeric corner control.');
  const x = (clientX - rect.left) * geometry.width / rect.width;
  const t = Math.max(0, Math.min(1, (x - geometry.left) / (geometry.right - geometry.left)));
  return geometry.start * (geometry.end / geometry.start) ** t;
}
export function createPlot(omegas: readonly number[], curves: readonly Curve[], markers: readonly Marker[], cursor: number, unit: FrequencyUnit, title: string, vertical: string,
  options: { width?: number; axis?: Axis; interactive?: boolean; nonnegative?: boolean } = {}) {
  const figure = document.createElement('figure'); figure.className = 'bode-figure';
  const caption = document.createElement('figcaption'); caption.textContent = title; figure.append(caption);
  const width = Math.max(240, options.width ?? 660), left = Math.min(85, width * .22), right = width - 22;
  const geometry: Geometry = { start: omegas[0], end: omegas[omegas.length - 1], left, right, width };
  const axis = options.axis ?? fittedAxis(curves, options.nonnegative);
  const image = svg('svg', { viewBox: `0 0 ${width} 270`, role: options.interactive ? 'group' : 'img', 'aria-label': title });
  const x = (omega: number) => left + (right - left) * Math.log10(omega / geometry.start) / Math.log10(geometry.end / geometry.start);
  const y = (value: number) => 218 - 170 * (value - axis.low) / (axis.high - axis.low);
  const label = (tx: number, ty: number, text: string, anchor = 'middle') => { const node = svg('text', { x: tx, y: ty, 'text-anchor': anchor, 'font-size': 12 }); node.textContent = text; image.append(node); };
  label(left, 16, vertical, 'start'); label(left - 7, 52, format(axis.high), 'end'); label(left - 7, 218, format(axis.low), 'end');
  image.append(svg('line', { x1: left, y1: 43, x2: left, y2: 218, class: 'bode-axis' }), svg('line', { x1: left, y1: 218, x2: right, y2: 218, class: 'bode-axis' }));
  const decades = Math.floor(Math.log10(geometry.end)) - Math.ceil(Math.log10(geometry.start)) + 1;
  const stride = Math.max(1, Math.ceil(decades / Math.max(2, Math.floor((right - left) / 70))));
  for (let decade = Math.ceil(Math.log10(geometry.start)), i = 0; decade <= Math.floor(Math.log10(geometry.end)); decade++, i++) {
    const omega = 10 ** decade; image.append(svg('line', { x1: x(omega), y1: 43, x2: x(omega), y2: 218, class: 'bode-grid' }));
    if (i % stride === 0) label(x(omega), 239, format(fromAngular(omega, unit)));
  }
  label((left + right) / 2, 261, `Frequency [${unit}] · log axis`);
  const paths = svg('svg', { x: left, y: 43, width: right - left, height: 175, viewBox: `${left} 43 ${right - left} 175`, overflow: 'hidden', 'aria-hidden': 'true' });
  for (const curve of curves) {
    if (curve.values.length !== omegas.length || curve.values.some(value => !Number.isFinite(value))) throw new Error('A plotted value exceeds numerical limits.');
    paths.append(svg('polyline', { points: curve.values.map((value, i) => `${x(omegas[i]).toFixed(3)},${y(value).toFixed(3)}`).join(' '), class: `bode-line ${curve.style}` }));
  }
  image.append(paths);
  const grouped = new Map<string, Marker[]>();
  for (const marker of markers.filter(m => m.omega >= geometry.start && m.omega <= geometry.end)) {
    const key = `${marker.style}:${x(marker.omega).toFixed(2)}`; grouped.set(key, [...(grouped.get(key) ?? []), marker]);
  }
  for (const group of grouped.values()) {
    const marker = group[0]; image.append(svg('line', { x1: x(marker.omega), y1: 43, x2: x(marker.omega), y2: 218, class: `bode-marker ${marker.style}` }));
    if (options.interactive && marker.factor !== undefined) {
      // Coincident markers are staggered vertically; each factor stays selectable.
      group.forEach((m, i) => {
        const cy = 38 + i * 44;
        const handle = svg('g', { role: 'slider', tabindex: 0, 'data-factor': m.factor!, 'aria-label': `Move corner of factor ${m.factor! + 1} on ${title.toLowerCase()}`, 'aria-valuemin': fromAngular(geometry.start, unit), 'aria-valuemax': fromAngular(geometry.end, unit), 'aria-valuenow': fromAngular(m.omega, unit), 'aria-valuetext': `${format(fromAngular(m.omega, unit))} ${unit}`, class: 'bode-handle' });
        handle.append(svg('circle', { cx: x(m.omega), cy, r: 22, class: 'bode-hit' }), svg('circle', { cx: x(m.omega), cy, r: 6, class: 'bode-dot' }));
        const name = svg('text', { x: x(m.omega) + 10, y: cy + 4, 'font-size': 12 }); name.textContent = m.name; handle.append(name); image.append(handle);
      });
    } else label(x(marker.omega), marker.style === 'bode-predicted-marker' ? 29 : 42, group.map(m => m.name).join(','));
  }
  image.append(svg('line', { x1: x(cursor), y1: 43, x2: x(cursor), y2: 218, class: 'bode-cursor' })); figure.append(image);
  const legend = document.createElement('div'); legend.className = 'bode-legend';
  curves.forEach(curve => { const name = document.createElement('span'); name.className = curve.style; name.textContent = curve.name; legend.append(name); }); figure.append(legend);
  return { figure, axis, geometry, image, clipped: curves.some(c => c.values.some(v => v < axis.low || v > axis.high)) };
}
