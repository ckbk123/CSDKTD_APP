interface Point { x: number; y: number }
export interface Series { label: string; points: (Point | null)[]; style: 'output' | 'input' | 'transient' }
export interface Mark { x?: number; y?: number; label: string }
const ns = 'http://www.w3.org/2000/svg';
function svgElement<K extends keyof SVGElementTagNameMap>(name: K, attrs: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const element = document.createElementNS(ns, name);
  Object.entries(attrs).forEach(([k, v]) => element.setAttribute(k, String(v)));
  if (text !== undefined) element.textContent = text;
  return element;
}
export function numberLabel(x: number): string {
  if (x === 0) return '0';
  return Math.abs(x) >= 10000 || Math.abs(x) < 0.001 ? x.toExponential(2) : Number(x.toPrecision(5)).toString();
}

/** SVG polylines are sampled illustrations. Null entries explicitly break curves. */
export function plot(options: {
  title: string; xLabel: string; yLabel: string; series: Series[]; marks?: Mark[];
  xRange?: [number, number]; yRange?: [number, number]; logX?: boolean;
  onTime?: (x: number) => void; signal?: AbortSignal;
}): HTMLElement {
  const figure = document.createElement('figure'); figure.className = 'cp03-plot';
  const caption = document.createElement('figcaption'); caption.textContent = options.title;
  const svg = svgElement('svg', { viewBox: '0 0 700 280', role: 'img', 'aria-label': `${options.title}. ${options.xLabel}; ${options.yLabel}.` });
  const points = options.series.flatMap(s => s.points.filter((p): p is Point => p !== null));
  let [xmin, xmax] = options.xRange ?? [Math.min(0, ...points.map(p => p.x)), Math.max(1, ...points.map(p => p.x))];
  let [ymin, ymax] = options.yRange ?? [Math.min(0, ...points.map(p => p.y)), Math.max(0, ...points.map(p => p.y))];
  if (xmax === xmin) xmax = xmin + 1;
  if (ymax === ymin) { ymin -= 1; ymax += 1; }
  if (!options.yRange) { const gap = (ymax - ymin) * 0.12; ymin -= gap; ymax += gap; }
  const left = 78, top = 30, width = 598, height = 194;
  const x = (v: number) => left + (v - xmin) / (xmax - xmin) * width;
  const y = (v: number) => top + height - (v - ymin) / (ymax - ymin) * height;
  for (let i = 0; i <= 4; i++) {
    const xv = xmin + (xmax - xmin) * i / 4, yv = ymin + (ymax - ymin) * i / 4;
    svg.append(svgElement('line', { x1: x(xv), y1: top, x2: x(xv), y2: top + height, class: 'cp03-grid' }));
    svg.append(svgElement('line', { x1: left, y1: y(yv), x2: left + width, y2: y(yv), class: 'cp03-grid' }));
    svg.append(svgElement('text', { x: x(xv), y: 244, 'text-anchor': 'middle' }, numberLabel(options.logX ? 10 ** xv : xv)));
    svg.append(svgElement('text', { x: left - 9, y: y(yv) + 4, 'text-anchor': 'end' }, numberLabel(yv)));
  }
  svg.append(svgElement('text', { x: 377, y: 272, 'text-anchor': 'middle' }, options.xLabel));
  svg.append(svgElement('text', { transform: 'translate(17 130) rotate(-90)', 'text-anchor': 'middle' }, options.yLabel));
  options.series.forEach(series => {
    let segment: string[] = [];
    const flush = () => {
      if (segment.length > 1) svg.append(svgElement('polyline', { points: segment.join(' '), class: `cp03-curve cp03-${series.style}` }));
      segment = [];
    };
    series.points.forEach(p => { if (!p) flush(); else segment.push(`${x(p.x)},${y(p.y)}`); }); flush();
  });
  (options.marks ?? []).forEach((mark, i) => {
    if (mark.x !== undefined && mark.y !== undefined) {
      svg.append(svgElement('circle', { cx: x(mark.x), cy: y(mark.y), r: 5, class: 'cp03-cursor' }));
    } else if (mark.x !== undefined) {
      svg.append(svgElement('line', { x1: x(mark.x), y1: top, x2: x(mark.x), y2: top + height, class: 'cp03-marker' }));
    } else if (mark.y !== undefined) {
      svg.append(svgElement('line', { x1: left, y1: y(mark.y), x2: left + width, y2: y(mark.y), class: 'cp03-marker' }));
    }
    svg.append(svgElement('text', { x: left + 8 + i * 170, y: 17, class: 'cp03-mark-label' }, mark.label));
  });
  if (options.onTime && options.signal) {
    svg.classList.add('cp03-clickable');
    svg.addEventListener('click', event => {
      // SVG's default meet alignment centers the viewBox within its CSS box.
      const box = svg.getBoundingClientRect(), scale = Math.min(box.width / 700, box.height / 280);
      const offset = (box.width - 700 * scale) / 2;
      const vx = (event.clientX - box.left - offset) / scale;
      if (vx >= left && vx <= left + width) options.onTime!(xmin + (vx - left) / width * (xmax - xmin));
    }, { signal: options.signal });
  }
  const legend = document.createElement('p'); legend.className = 'cp03-legend';
  options.series.forEach(series => {
    const item = document.createElement('span'); item.className = `cp03-key cp03-${series.style}`; item.textContent = series.label; legend.append(item);
  });
  figure.append(caption, svg, legend);
  return figure;
}
