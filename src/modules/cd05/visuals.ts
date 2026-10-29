import { fmt } from './format';
interface Series { x: number[]; y: number[] }
const ns = 'http://www.w3.org/2000/svg';
function svgNode(tag: string, attributes: Record<string, string | number>, text = ''): SVGElement {
  const out = document.createElementNS(ns, tag);
  Object.entries(attributes).forEach(([key, value]) => out.setAttribute(key, String(value))); if (text) out.textContent = text; return out;
}
export function plot(first: Series, second: Series, label: string, xLabel: string, yLabel: string, log = false, marker?: number, guide = 0): SVGSVGElement {
  const width = 650, height = 245, left = 67, right = 22, top = 26, bottom = 45;
  const out = svgNode('svg', { viewBox: '0 0 650 245', role: 'img', 'aria-label': label }) as SVGSVGElement;
  const xs = first.x.concat(second.x), ys = first.y.concat(second.y, guide), loX = Math.min(...xs), hiX = Math.max(...xs);
  const lo = Math.min(...ys), hi = Math.max(...ys), pad = Math.max((hi - lo) * .08, Math.max(Math.abs(lo), Math.abs(hi)) * .01, 1e-8);
  const px = (v: number): number => left + (log ? Math.log(v / loX) / Math.log(hiX / loX) : (v - loX) / (hiX - loX)) * (width - left - right);
  const py = (v: number): number => height - bottom - (v - lo + pad) / (hi - lo + 2 * pad) * (height - top - bottom);
  for (let i = 0; i <= 4; i++) {
    let value = lo - pad + (hi - lo + 2 * pad) * i / 4;
    if (Math.abs(value) <= (hi - lo + 2 * pad) * 1e-12) value = 0;
    const y = py(value);
    out.append(svgNode('line', { x1: left, x2: width - right, y1: y, y2: y, class: 'cd05-grid' }));
    if (Math.abs(y - py(guide)) >= 11) out.append(svgNode('text', { x: left - 7, y: y + 4, 'text-anchor': 'end', class: 'cd05-label' }, fmt(value)));
  }
  out.append(svgNode('line', { x1: left, x2: width - right, y1: py(guide), y2: py(guide), class: 'cd05-guide' }));
  out.append(svgNode('text', { x: left - 7, y: py(guide) + 4, 'text-anchor': 'end', class: 'cd05-label cd05-guide-label' }, fmt(guide)));
  [first, second].forEach((series, i) => {
    if (!series.x.length) return;
    const d = series.x.map((x, j) => (j ? 'L' : 'M') + px(x) + ',' + py(series.y[j])).join(' ');
    out.append(svgNode('path', { d, class: i === 0 ? 'cd05-baseline' : 'cd05-proposed' }));
  });
  if (marker !== undefined && marker >= loX && marker <= hiX) out.append(svgNode('line', { x1: px(marker), x2: px(marker), y1: top, y2: height - bottom, class: 'cd05-marker' }));
  [loX, log ? Math.sqrt(loX * hiX) : (loX + hiX) / 2, hiX].forEach((value, i) => out.append(svgNode('text', { x: px(value), y: height - 25, 'text-anchor': i === 0 ? 'start' : i === 2 ? 'end' : 'middle', class: 'cd05-label' }, fmt(value))));
  out.append(svgNode('text', { x: width / 2, y: height - 5, 'text-anchor': 'middle', class: 'cd05-label' }, xLabel), svgNode('text', { x: 7, y: 15, class: 'cd05-label' }, yLabel)); return out;
}
export function geometry(zero: number, peak: number, pole: number, cancelled: boolean): SVGSVGElement {
  const out = svgNode('svg', { viewBox: '0 0 650 130', role: 'img', 'aria-label': cancelled ? 'No lead: pole and zero coincide and cancel.' : 'Lead zero, geometric-mean peak and pole on a logarithmic frequency axis.' }) as SVGSVGElement;
  const lo = zero / 2, hi = pole * 2, x = (w: number): number => 60 + Math.log(w / lo) / Math.log(hi / lo) * 530;
  out.append(svgNode('line', { x1: 60, x2: 590, y1: 45, y2: 45, class: 'cd05-guide' }));
  if (cancelled) out.append(svgNode('text', { x: 325, y: 26, 'text-anchor': 'middle', class: 'cd05-label' }, 'Constant controller: no distinct lead corners or unique phase peak.'));
  const values = cancelled ? [[zero, 'Coincident, cancelled']] as const : [[zero, 'Zero ωz'], [peak, 'Peak ωm'], [pole, 'Pole ωp']] as const;
  values.forEach(([w, label], i) => {
    const at = x(w); out.append(svgNode('line', { x1: at, x2: at, y1: 35, y2: 55, class: 'cd05-marker' }),
      svgNode('text', { x: at, y: 76 + (i % 2) * 20, 'text-anchor': 'middle', class: 'cd05-label' }, label + ': ' + fmt(w)));
  });
  out.append(svgNode('text', { x: 325, y: 120, 'text-anchor': 'middle', class: 'cd05-label' }, 'Angular frequency (rad/s), logarithmic spacing')); return out;
}
