import { chainLength, copies } from './math';
import type { AmplitudeSample, ModalRow } from './rows';
const NS = 'http://www.w3.org/2000/svg';
const svg = <K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(NS, tag); Object.entries(attributes).forEach(([key, value]) => node.setAttribute(key, String(value))); if (text !== undefined) node.textContent = text; return node;
};
export const format = (value: number): string => value === 0 ? '0' : Number(value.toPrecision(8)).toString();
/** Equations retain the shortest round-trip decimal; compact labels alone are rounded. */
export const texNumber = (value: number): string => String(value === 0 ? 0 : value).replace(/e([+-]?\d+)$/, (_, exponent: string) => `\\times10^{${Number(exponent)}}`);
export const fitPlane = (rows: readonly ModalRow[]): number => Math.max(1.2, ...rows.flatMap(row => [Math.abs(row.mode.pole.re), Math.abs(row.mode.pole.im)])) * 1.15;
export interface Axis { readonly low: number; readonly high: number }
export function fitAmplitude(data: readonly AmplitudeSample[]): Axis {
  const values = data.flatMap(s => [s.first, s.basic, s.norm]), low = Math.min(0, ...values), high = Math.max(1, ...values), pad = (high - low) * .1;
  return { low: low - pad, high: high + pad };
}
export function rootPlane(rows: readonly ModalRow[], selected: number, extent: number, width: number) {
  const scale = 440 / Math.max(1, width), root = svg('svg', { viewBox: '0 0 440 350', role: 'group', 'aria-label': 'All internal eigenvalues; each modal row has keyboard and pointer handles', 'data-plane-extent': extent });
  root.style.setProperty('--ds01-axis-font', `${12 * scale}px`);
  const data = svg('svg', { x: 80, y: 20, width: 280, height: 280, viewBox: '0 0 280 280', overflow: 'hidden', 'aria-label': 'Equal-scale z plane' });
  const x = (value: number) => 140 + value / extent * 140, y = (value: number) => 140 - value / extent * 140;
  data.append(svg('circle', { cx: 140, cy: 140, r: 140 / extent, class: 'ds01-unit-disk' }), svg('path', { d: 'M0 140H280M140 0V280', class: 'ds01-axis' }));
  for (const value of [-extent, 0, extent]) { root.append(svg('text', { x: 80 + x(value), y: 319, 'text-anchor': 'middle' }, format(value))); if (value) root.append(svg('text', { x: 72, y: 24 + y(value), 'text-anchor': 'end' }, format(value))); }
  data.append(svg('circle', { cx: 140, cy: 140, r: 140 / extent, class: 'ds01-unit-circle' }));
  const ordered = [...rows.filter(row => row.id !== selected), ...rows.filter(row => row.id === selected)];
  for (const row of ordered) for (const mirror of row.mode.pole.im ? [1, -1] : [1]) {
    const px = x(row.mode.pole.re), py = y(row.mode.pole.im * mirror), r = 5 * scale, multiplicity = chainLength(row.mode.structure) * copies(row.mode.structure);
    const group = svg('g', { role: 'button', tabindex: 0, 'data-row-handle': row.id, 'data-mirror': mirror, class: row.id === selected ? 'ds01-picked' : '', 'aria-label': `Row ${rows.indexOf(row) + 1}, ${format(row.mode.pole.re)} ${row.mode.pole.im * mirror < 0 ? 'minus' : 'plus'} ${format(Math.abs(row.mode.pole.im))}j; ${row.mode.structure}; ${row.mode.visible ? 'visible' : 'output hidden'}. Arrow keys move by 0.01, Shift by 0.1.` });
    if (!row.mode.visible) group.append(svg('circle', { cx: px, cy: py, r: 10 * scale, class: 'ds01-hidden-ring' }));
    group.append(svg('path', { d: `M${px - r} ${py - r}L${px + r} ${py + r}M${px - r} ${py + r}L${px + r} ${py - r}`, class: 'ds01-cross' }), svg('circle', { cx: px, cy: py, r: 22 * scale, fill: 'transparent', class: 'ds01-hit' }));
    data.append(group);
    if (multiplicity > 1) data.append(svg('text', { x: px + 12 * scale, y: py - 12 * scale }, `×${multiplicity}`));
  }
  root.append(data, svg('text', { x: 220, y: 343, 'text-anchor': 'middle' }, 'Real part Re(z)'), svg('text', { transform: 'translate(18 160) rotate(-90)', 'text-anchor': 'middle' }, 'Imaginary part Im(z)'));
  return { element: root, clipped: rows.some(row => Math.abs(row.mode.pole.re) > extent || Math.abs(row.mode.pole.im) > extent), fromEvent(event: MouseEvent) {
    const box = root.getBoundingClientRect(); if (!box.width || !box.height) return undefined;
    const ratio = Math.min(box.width / 440, box.height / 350), left = (box.width - ratio * 440) / 2, top = (box.height - ratio * 350) / 2;
    return { re: ((event.clientX - box.left - left) / ratio - 220) * extent / 140, im: (160 - (event.clientY - box.top - top) / ratio) * extent / 140 };
  } };
}
export function sequence(data: readonly AmplitudeSample[], axis: Axis, width: number) {
  width = Math.max(220, width); const root = svg('svg', { viewBox: `0 0 ${width} 270`, role: 'img', 'aria-label': 'Selected free-response samples: first coordinate stems, state norm dashed, basic real pole power dotted' });
  const left = 66, right = width - 16, top = 28, bottom = 214, horizon = data.at(-1)!.k;
  const x = (k: number) => left + k / horizon * (right - left), y = (value: number) => bottom - (value - axis.low) / (axis.high - axis.low) * (bottom - top);
  const viewport = svg('svg', { x: left, y: top, width: right - left, height: bottom - top, viewBox: `${left} ${top} ${right - left} ${bottom - top}`, overflow: 'hidden' });
  root.append(svg('path', { d: `M${left} ${top}V${bottom}H${right}`, class: 'ds01-axis' }));
  for (const value of [axis.low, 0, axis.high]) if (value >= axis.low && value <= axis.high) root.append(svg('text', { x: left - 7, y: y(value) + 4, 'text-anchor': 'end', 'font-size': 12 }, Number(value.toPrecision(3)).toString().replace('e+', 'e')));
  for (const k of [0, Math.floor(horizon / 2), horizon]) root.append(svg('text', { x: x(k), y: 237, 'text-anchor': 'middle', 'font-size': 12 }, String(k)));
  root.append(svg('text', { x: (left + right) / 2, y: 262, 'text-anchor': 'middle', 'font-size': 12 }, 'Integer sample k; t = kT seconds'));
  viewport.append(svg('line', { x1: left, x2: right, y1: y(0), y2: y(0), class: 'ds01-axis' }));
  for (const sample of data) viewport.append(svg('line', { x1: x(sample.k), x2: x(sample.k), y1: y(0), y2: y(sample.first), class: 'ds01-stem' }), svg('circle', { cx: x(sample.k), cy: y(sample.first), r: 2.5, class: 'ds01-stem-dot' }));
  for (const [key, pattern] of [['norm', '6 4'], ['basic', '2 4']] as const) viewport.append(svg('polyline', { points: data.map(s => `${x(s.k)},${y(s[key])}`).join(' '), fill: 'none', class: 'ds01-envelope', 'stroke-dasharray': pattern }));
  const cursor = svg('line', { y1: top, y2: bottom, class: 'ds01-sample-cursor' }), points = [0, 1, 2].map(() => svg('circle', { r: 4, class: 'ds01-cursor-dot' })); viewport.append(cursor, ...points); root.append(viewport);
  return { element: root, clipped: data.some(s => [s.first, s.norm, s.basic].some(value => value < axis.low || value > axis.high)), select(sample: AmplitudeSample) { cursor.setAttribute('x1', String(x(sample.k))); cursor.setAttribute('x2', String(x(sample.k))); [sample.first, sample.norm, sample.basic].forEach((value, i) => { const point = points[i]; point.setAttribute('visibility', value >= axis.low && value <= axis.high ? 'visible' : 'hidden'); point.setAttribute('cx', String(x(sample.k))); point.setAttribute('cy', String(y(value))); }); } };
}
