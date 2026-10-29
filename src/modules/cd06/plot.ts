export interface Point { x: number; y: number }
export interface Series { name: string; points: Point[]; styleIndex?: number }
export interface Guide { x?: number; y?: number }
interface Options { title: string; xLabel: string; yLabel: string; series: Series[]; logX?: boolean; guides?: Guide[]; marks?: Point[]; band?: { low: number; high: number }; yDomain?: [number, number] }
const ns = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const e = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, String(v))); if (text !== undefined) e.textContent = text; return e;
}
const label = (v: number) => Math.abs(v) >= 1000 || Math.abs(v) > 0 && Math.abs(v) < .01 ? v.toExponential(0) : String(Number(v.toPrecision(3)));
/** Shared bounds for every visible series; all finite values, never pixel-fit a canned curve. */
export function plot({ title, xLabel, yLabel, series, logX = false, guides = [], marks = [], band, yDomain }: Options): HTMLElement {
  const figure = document.createElement('figure'); figure.className = 'cd06-plot';
  const caption = document.createElement('figcaption'); caption.textContent = title; figure.append(caption);
  const chart = svg('svg', { viewBox: '0 0 800 400', role: 'img', 'aria-label': `${title}. Horizontal axis: ${xLabel}. Vertical axis: ${yLabel}. ${series.map(s => s.name).join('; ')}.`, preserveAspectRatio: 'xMidYMid meet' }); figure.append(chart);
  const points = series.flatMap(s => s.points);
  if (!points.length || points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y) || logX && p.x <= 0)) throw new Error('The plot requires finite supported data.');
  const tx = (x: number) => logX ? Math.log10(x) : x;
  let minX = Math.min(...points.map(p => tx(p.x))), maxX = Math.max(...points.map(p => tx(p.x)));
  let minY = yDomain ? yDomain[0] : Math.min(0, ...points.map(p => p.y)), maxY = yDomain ? yDomain[1] : Math.max(1, ...points.map(p => p.y));
  if (minX === maxX) { minX -= .5; maxX += .5; }
  const pad = (maxY - minY) * .08; if (!yDomain) { if (minY !== 0) minY -= pad; maxY += pad; }
  const left = 106, right = 775, top = 40, bottom = 315;
  const x = (v: number) => left + (tx(v) - minX) / (maxX - minX) * (right - left), y = (v: number) => bottom - (v - minY) / (maxY - minY) * (bottom - top);
  if (band) {
    const a = Math.max(left, Math.min(right, x(band.low))), b = Math.max(left, Math.min(right, x(band.high)));
    chart.append(svg('rect', { x: a, y: top, width: Math.max(0, b - a), height: bottom - top, class: 'cd06-band' }));
  }
  for (let i = 0; i <= 4; i++) {
    const xv = minX + (maxX - minX) * i / 4, px = left + (right - left) * i / 4;
    chart.append(svg('line', { x1: px, x2: px, y1: top, y2: bottom, class: 'cd06-gridline' }), svg('text', { x: px, y: bottom + 33, 'text-anchor': 'middle' }, label(logX ? 10 ** xv : xv)));
  }
  const yTicks = yDomain && minY === -270 && maxY === 0 ? [-270, -180, -90, 0] : Array.from({ length: 5 }, (_, i) => minY + (maxY - minY) * i / 4);
  for (const yv of yTicks) {
    chart.append(svg('line', { x1: left, x2: right, y1: y(yv), y2: y(yv), class: 'cd06-gridline' }), svg('text', { x: left - 9, y: y(yv) + 4, 'text-anchor': 'end' }, label(yv)));
  }
  chart.append(svg('text', { x: (left + right) / 2, y: 390, 'text-anchor': 'middle' }, xLabel), svg('text', { x: 7, y: 23 }, yLabel));
  for (const guide of guides) {
    if (guide.x !== undefined && x(guide.x) >= left && x(guide.x) <= right) chart.append(svg('line', { x1: x(guide.x), x2: x(guide.x), y1: top, y2: bottom, class: 'cd06-guide' }));
    if (guide.y !== undefined && guide.y >= minY && guide.y <= maxY) chart.append(svg('line', { x1: left, x2: right, y1: y(guide.y), y2: y(guide.y), class: 'cd06-guide' }));
  }
  series.forEach((s, index) => {
    chart.append(svg('path', { d: s.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.x).toFixed(3)},${y(p.y).toFixed(3)}`).join(' '), class: `cd06-line cd06-series-${s.styleIndex ?? index}` }));
  });
  marks.forEach(p => { if (x(p.x) >= left && x(p.x) <= right && y(p.y) >= top && y(p.y) <= bottom) chart.append(svg('circle', { cx: x(p.x), cy: y(p.y), r: 4, class: 'cd06-mark' })); });
  const legend = document.createElement('p'); legend.className = 'cd06-legend';
  series.forEach((s, i) => { const item = document.createElement('span'); item.className = `cd06-key cd06-key-${s.styleIndex ?? i}`; item.textContent = s.name; legend.append(item); }); figure.append(legend);
  return figure;
}
