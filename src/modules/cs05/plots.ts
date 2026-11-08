import { cutNumber, isStable, type Cut, type Region, type Root, type locus } from './gains';

export const formatNumber = (value: number): string => value === 0 ? '0' : Number(value.toPrecision(7)).toString();
export function formatLatex(value: number): string { const [mantissa, exponent] = formatNumber(value).split('e'); return exponent === undefined ? mantissa : `${mantissa}\\times10^{${Number(exponent)}}`; }
type Samples = ReturnType<typeof locus>;
const NS = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, String(value)); if (text !== undefined) node.textContent = text; return node;
}
const axisNumber = (value: number) => Number(value.toPrecision(Math.abs(value) >= 100 || (value !== 0 && Math.abs(value) < .01) ? 1 : 3)).toString().replace('e+', 'e');
export interface PlaneWindow { readonly extent: number }
export const fitWindow = (samples: Samples, selected: readonly Root[] = []): PlaneWindow => ({ extent: 1.2 * Math.max(1, ...samples.flatMap(frame => frame.roots ?? []).flatMap(root => [Math.abs(root.re), Math.abs(root.im)]), ...selected.flatMap(root => [Math.abs(root.re), Math.abs(root.im)])) });
export interface Plane { readonly element: SVGSVGElement; readonly clipped: boolean; resize(width: number): void }

/** All coordinates use one fixed equal scale; resizing changes presentation only. */
export function rootPlane(samples: Samples, selected: readonly Root[], window: PlaneWindow): Plane {
  const { extent } = window; if (!Number.isFinite(extent) || extent <= 0) throw new Error('Use a finite positive plane extent.');
  const root = svg('svg', { viewBox: '0 0 440 350', role: 'img', 'aria-label': 'Finite root locus with every selected characteristic root' });
  root.append(svg('desc', {}, 'The shaded half-plane is Re s below zero. The exact full gain inequalities determine the stability verdict; sampled curves do not prove the complete gain set.'));
  const data = svg('svg', { x: 80, y: 20, width: 280, height: 280, viewBox: '0 0 280 280', overflow: 'hidden' });
  const x = (value: number) => 140 + 140 * value / extent, y = (value: number) => 140 - 140 * value / extent;
  data.append(svg('rect', { x: 0, y: 0, width: 140, height: 280, class: 'cs05-left-half' }));
  for (const value of [-extent, 0, extent]) {
    data.append(svg('line', { x1: x(value), x2: x(value), y1: 0, y2: 280, class: value === 0 ? 'cs05-axis' : 'cs05-gridline' }), svg('line', { x1: 0, x2: 280, y1: y(value), y2: y(value), class: value === 0 ? 'cs05-axis' : 'cs05-gridline' }));
    root.append(svg('text', { x: 80 + x(value), y: 319, 'text-anchor': 'middle', class: 'cs05-axis-label' }, axisNumber(value)));
    if (value !== 0) root.append(svg('text', { x: 72, y: 24 + y(value), 'text-anchor': 'end', class: 'cs05-axis-label' }, axisNumber(value)));
  }
  for (let branch = 0; branch < 3; branch++) {
    let path = '', gap = true;
    for (const frame of samples) { const value = frame.roots?.[branch]; if (!value) { gap = true; continue; } path += `${gap ? 'M' : 'L'}${x(value.re)},${y(value.im)} `; gap = false; }
    data.append(svg('path', { d: path, class: 'cs05-branch', 'stroke-dasharray': ['', '6 3', '2 3'][branch] }));
  }
  const marks: { node: SVGPathElement; x: number; y: number }[] = [];
  for (const value of selected) { const px = x(value.re), py = y(value.im), mark = svg('path', { d: `M${px - 5},${py - 5}L${px + 5},${py + 5}M${px - 5},${py + 5}L${px + 5},${py - 5}`, class: 'cs05-selected-root' }); marks.push({ node: mark, x: px, y: py }); data.append(mark); }
  root.append(data, svg('text', { x: 220, y: 342, 'text-anchor': 'middle', class: 'cs05-axis-label' }, 'Real part σ (entered s units)'), svg('text', { transform: 'translate(17 160) rotate(-90)', 'text-anchor': 'middle', class: 'cs05-axis-label' }, 'Imaginary part ω (entered s units)'));
  return { element: root, clipped: selected.some(value => Math.abs(value.re) > extent || Math.abs(value.im) > extent), resize(width) {
    if (!Number.isFinite(width) || width <= 0) return; const scale = 440 / width; root.style.setProperty('--cs05-plot-font', `${12 * scale}px`);
    for (const mark of marks) { const r = 5 * scale, { x, y } = mark; mark.node.setAttribute('d', `M${x - r},${y - r}L${x + r},${y + r}M${x - r},${y + r}L${x + r},${y - r}`); }
  } };
}

export interface Strip { readonly element: SVGSVGElement; fromEvent(event: MouseEvent): number | undefined; resize(width: number): void }
/** Endpoint positions are numerical; fill/inclusion comes only from the exact Region/Cut identities. */
export function gainStrip(region: Region, maximum: number, selected: Cut): Strip {
  const root = svg('svg', { viewBox: '0 0 440 90', role: 'img', 'aria-label': 'Exact stable-gain intervals over the finite displayed range' });
  const x = (gain: number) => 40 + 360 * gain / maximum;
  root.append(svg('line', { x1: 40, x2: 400, y1: 40, y2: 40, class: 'cs05-axis' }));
  for (const interval of region.intervals) {
    const low = cutNumber(interval.lower), end = interval.upper ? cutNumber(interval.upper) : Infinity;
    if (low >= maximum || end < 0) continue;
    root.append(svg('rect', { x: x(Math.max(0, low)), y: 31, width: Math.max(0, x(Math.min(maximum, end)) - x(Math.max(0, low))), height: 18, class: 'cs05-stable' }));
    if (end > maximum) root.append(svg('path', { d: 'M392 29L404 40L392 51', class: 'cs05-tail-arrow' }));
  }
  const endpoints: SVGCircleElement[] = [];
  region.cuts.forEach((cut, i) => { const gain = cutNumber(cut); if (gain > maximum) return; const mark = svg('circle', { cx: x(gain), cy: 40, r: 4, class: isStable(region, cut) ? 'cs05-included' : 'cs05-excluded', 'data-endpoint': i }); root.append(mark); endpoints.push(mark); });
  const value = cutNumber(selected);
  if (value <= maximum) root.append(svg('line', { x1: x(value), x2: x(value), y1: 18, y2: 62, class: 'cs05-selected' }), svg('circle', { cx: x(value), cy: 40, r: 8, class: 'cs05-gain-handle' }));
  root.append(svg('text', { x: 40, y: 82, class: 'cs05-axis-label' }, '0'), svg('text', { x: 400, y: 82, 'text-anchor': 'end', class: 'cs05-axis-label' }, `K ≈ ${formatNumber(maximum)}`));
  return { element: root, resize(width) {
    if (!Number.isFinite(width) || width <= 0) return; const scale = 440 / width; root.style.setProperty('--cs05-plot-font', `${12 * scale}px`);
    endpoints.forEach(mark => mark.setAttribute('r', String(4 * scale))); root.querySelector('.cs05-gain-handle')?.setAttribute('r', String(8 * scale));
  }, fromEvent(event) {
    const box = root.getBoundingClientRect(); if (!box.width || !box.height) return undefined;
    const scale = Math.min(box.width / 440, box.height / 90), left = (box.width - 440 * scale) / 2;
    const point = (event.clientX - box.left - left) / scale;
    return Math.max(0, Math.min(maximum, (point - 40) * maximum / 360));
  } };
}
