import { analyze, boundaryInfo, gainRegions, numberOf, sampleLocus, type Complex, type Model, type Rational } from './math';

const ns = 'http://www.w3.org/2000/svg';
function svg(title: string, viewBox: string): SVGSVGElement {
  const out = document.createElementNS(ns, 'svg'); out.setAttribute('viewBox', viewBox); out.setAttribute('role', 'img'); out.setAttribute('aria-label', title); return out;
}
function shape(parent: SVGElement, tag: string, attrs: Record<string, number | string>, text?: string) {
  const item = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) item.setAttribute(key, String(value));
  if (text !== undefined) item.textContent = text; parent.append(item);
}
const short = (n: number) => n.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 4 });
export function locusPlot(model: Model, gain: number | Rational, minimum: number, maximum: number): HTMLElement {
  const figure = document.createElement('figure'), caption = document.createElement('figcaption'); caption.textContent = 'Closed-loop roots in the z plane'; figure.append(caption);
  const out = svg('Sampled discrete root locus with unit-circle crossings', '0 0 360 300');
  const branches = sampleLocus(model, minimum, maximum), selected = analyze(model, gain);
  const numericGain = typeof gain === 'number' ? gain : numberOf(gain);
  const extent = Math.min(10, Math.max(1.5, ...selected.roots.finite.map(p => Math.max(Math.abs(p.re), Math.abs(p.im)) * 1.2)));
  const scale = 105 / extent, x = (v: number) => 180 + scale * v, y = (v: number) => 145 - scale * v;
  shape(out, 'circle', { cx: 180, cy: 145, r: scale, class: 'g-circle' });
  shape(out, 'line', { x1: 25, x2: 335, y1: 145, y2: 145, class: 'g-axis' });
  shape(out, 'line', { x1: 180, x2: 180, y1: 20, y2: 270, class: 'g-axis' });
  shape(out, 'text', { x: 295, y: 135 }, 'Re z'); shape(out, 'text', { x: 190, y: 27 }, 'Im z');
  for (const tick of [-extent, extent]) { shape(out, 'line', { x1: x(tick), x2: x(tick), y1: 141, y2: 149, class: 'g-axis' }); shape(out, 'text', { x: x(tick), y: 167, 'text-anchor': 'middle' }, short(tick)); }
  shape(out, 'text', { x: x(-1), y: 190, 'text-anchor': 'middle' }, '−1'); shape(out, 'text', { x: x(1), y: 190, 'text-anchor': 'middle' }, '+1');
  let omitted = 0;
  for (let i = 0; i < 2; i++) {
    let path = '', pen = false;
    for (const p of branches[i]) {
      if (!p || Math.abs(p.re) > extent || Math.abs(p.im) > extent) { pen = false; if (p) omitted++; continue; }
      path += `${pen ? 'L' : 'M'}${x(p.re)},${y(p.im)} `; pen = true;
    }
    shape(out, 'path', { d: path, class: i ? 'g-branch g-second' : 'g-branch' });
  }
  const markers: Complex[] = [];
  for (const k of gainRegions(model).critical.filter(k => numberOf(k) >= minimum && numberOf(k) <= maximum)) for (const p of boundaryInfo(model, k).roots.finite) {
    if (Math.abs(Math.hypot(p.re, p.im) - 1) < 1e-8 && !markers.some(m => Math.hypot(m.re - p.re, m.im - p.im) < 1e-8)) markers.push(p);
  }
  for (const p of markers) shape(out, 'circle', { cx: x(p.re), cy: y(p.im), r: 6, class: 'g-crossing' });
  for (const p of selected.roots.finite) {
    if (Math.abs(p.re) > extent || Math.abs(p.im) > extent) { omitted++; continue; }
    const px = x(p.re), py = y(p.im); shape(out, 'path', { d: `M${px - 6},${py - 6}l12,12m0,-12l-12,12`, class: 'g-selected' });
  }
  figure.className = 'g-locus'; figure.append(out);
  const note = document.createElement('p'); note.className = 'g-small';
  note.textContent = `Dimensionless z; × current roots; ○ unit roots at critical gains inside the sampled window. 401 samples over ${short(minimum)} ≤ K ≤ ${short(maximum)}; solid/dashed paths show both roots and break at a=0. The view follows the selected roots (extent capped at 10); it does not prove the gain set.${numericGain < minimum || numericGain > maximum ? ' Selected K is outside the sampled gain window.' : ''}${omitted ? ` ${omitted} sampled/selected points exceed the view; selected roots are listed numerically.` : ''}`;
  figure.append(note); return figure;
}
export function gainBar(model: Model, gain: number, minimum: number, maximum: number): HTMLElement {
  const figure = document.createElement('figure'), caption = document.createElement('figcaption'); caption.textContent = 'Strictly stable gain intervals within the plot window'; figure.append(caption);
  const out = svg('Gain interval bar; tinted segments are strictly stable', '0 0 360 105'), x = (k: number) => 30 + 300 * (k - minimum) / (maximum - minimum);
  shape(out, 'line', { x1: 30, x2: 330, y1: 46, y2: 46, class: 'g-axis' });
  const set = gainRegions(model);
  for (const region of set.stable) {
    const lo = Math.max(minimum, region.lower ? numberOf(region.lower) : -Infinity), hi = Math.min(maximum, region.upper ? numberOf(region.upper) : Infinity);
    if (hi > lo) shape(out, 'rect', { x: x(lo), y: 32, width: x(hi) - x(lo), height: 28, class: 'g-stable' });
  }
  for (const k of set.critical.map(numberOf)) if (k >= minimum && k <= maximum) shape(out, 'circle', { cx: x(k), cy: 46, r: 5, class: 'g-crossing' });
  if (gain >= minimum && gain <= maximum) { shape(out, 'line', { x1: x(gain), x2: x(gain), y1: 15, y2: 76, class: 'g-selected' }); shape(out, 'text', { x: x(gain), y: 98, 'text-anchor': 'middle' }, `K=${short(gain)}`); }
  shape(out, 'text', { x: 30, y: 20 }, short(minimum)); shape(out, 'text', { x: 330, y: 20, 'text-anchor': 'end' }, short(maximum)); figure.append(out);
  const note = document.createElement('p'); note.className = 'g-small'; note.textContent = 'Tint = strict stability. Open circles mark exact critical gains; none is included. All real-gain intervals and boundary equations are listed below, including those beyond this window.'; figure.append(note); return figure;
}
