export interface Point { x: number; y: number }
export interface Series { label: string; points: (Point | null)[]; style: 'output' | 'input' | 'transient' }
export interface Mark { x?: number; y?: number; label: string }
export interface Handle { key: 'tu' | 'ty' | 'B' | 'frequency'; label: string; x?: number; y?: number; min: number; max: number; value: number; units: string }
export interface Geometry { width: number; height: number; left: number; right: number; top: number; bottom: number; xRange: [number, number]; yRange: [number, number] }
export interface PlotOptions {
  id?: string; title: string; xLabel: string; yLabel: string; series: Series[]; marks?: Mark[]; handles?: Handle[];
  xRange?: [number, number]; yRange?: [number, number]; logX?: boolean; width?: number; equalAspect?: boolean;
  onTime?: (x: number) => void; signal?: AbortSignal;
}
const ns = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text?: string): SVGElementTagNameMap[K] {
  const node = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value))); if (text !== undefined) node.textContent = text; return node;
}
export function numberLabel(value: number): string {
  if (value === 0) return '0'; return Math.abs(value) >= 10000 || Math.abs(value) < .001 ? value.toExponential(2) : Number(value.toPrecision(5)).toString();
}
export function pointerPosition(clientX: number, clientY: number, box: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>, g: Geometry): Point {
  const scale = Math.min(box.width / g.width, box.height / g.height);
  if (![clientX, clientY, scale].every(Number.isFinite) || scale <= 0) throw new Error('The plot is not ready. Use the numeric marker controls.');
  const px = (clientX - box.left - (box.width - scale * g.width) / 2) / scale;
  const py = (clientY - box.top - (box.height - scale * g.height) / 2) / scale;
  const tx = Math.max(0, Math.min(1, (px - g.left) / (g.right - g.left))), ty = Math.max(0, Math.min(1, (g.bottom - py) / (g.bottom - g.top)));
  return { x: g.xRange[0] + tx * (g.xRange[1] - g.xRange[0]), y: g.yRange[0] + ty * (g.yRange[1] - g.yRange[0]) };
}
/** Numerical curves are sampled drawings; null points retain mathematical gaps. */
export function drawPlot(options: PlotOptions) {
  const figure = document.createElement('figure'); figure.className = 'cp03-plot'; figure.dataset.plot = options.id ?? '';
  const caption = document.createElement('figcaption'); caption.textContent = options.title; figure.append(caption);
  const width = Math.max(180, options.width ?? 700), height = 270, left = Math.min(78, width * .25), right = width - 28, top = 42, bottom = 220;
  const points = options.series.flatMap(series => series.points.filter((p): p is Point => p !== null));
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) throw new Error('No finite signal values are available for this plot.');
  let [xmin, xmax] = options.xRange ?? [Math.min(0, ...points.map(p => p.x)), Math.max(1, ...points.map(p => p.x))];
  let [ymin, ymax] = options.yRange ?? [Math.min(0, ...points.map(p => p.y)), Math.max(0, ...points.map(p => p.y))];
  if (xmax === xmin) xmax = xmin + 1;
  if (ymax === ymin) { const gap = ymin ? Math.abs(ymin) * .1 : 1; ymin -= gap; ymax += gap; }
  if (!options.yRange) { const gap = (ymax - ymin) * .12; ymin -= gap; ymax += gap; }
  if (options.equalAspect) {
    const unit = Math.max((xmax - xmin) / (right - left), (ymax - ymin) / (bottom - top)), cx = (xmin + xmax) / 2, cy = (ymin + ymax) / 2;
    xmin = cx - unit * (right - left) / 2; xmax = cx + unit * (right - left) / 2; ymin = cy - unit * (bottom - top) / 2; ymax = cy + unit * (bottom - top) / 2;
  }
  const geometry: Geometry = { width, height, left, right, top, bottom, xRange: [xmin, xmax], yRange: [ymin, ymax] };
  const x = (v: number) => left + (v - xmin) / (xmax - xmin) * (right - left), y = (v: number) => bottom - (v - ymin) / (ymax - ymin) * (bottom - top);
  const image = svg('svg', { viewBox: `0 0 ${width} ${height}`, role: options.handles?.length ? 'group' : 'img', 'aria-label': `${options.title}. ${options.xLabel}; ${options.yLabel}.`, 'data-plot-svg': options.id ?? '' });
  image.append(svg('text', { x: left, y: 15 }, options.yLabel));
  const ticks = width < 450 ? 2 : 4;
  for (let i = 0; i <= ticks; i++) {
    const xv = xmin + (xmax - xmin) * i / ticks, yv = ymin + (ymax - ymin) * i / ticks;
    image.append(svg('line', { x1: x(xv), y1: top, x2: x(xv), y2: bottom, class: 'cp03-grid' }), svg('line', { x1: left, y1: y(yv), x2: right, y2: y(yv), class: 'cp03-grid' }));
    image.append(svg('text', { x: x(xv), y: 240, 'text-anchor': 'middle' }, numberLabel(options.logX ? 10 ** xv : xv)), svg('text', { x: left - 7, y: y(yv) + 4, 'text-anchor': 'end' }, numberLabel(yv)));
  }
  image.append(svg('text', { x: (left + right) / 2, y: 262, 'text-anchor': 'middle' }, options.xLabel));
  const paths = svg('svg', { x: left, y: top, width: right - left, height: bottom - top, viewBox: `${left} ${top} ${right - left} ${bottom - top}`, overflow: 'hidden', 'aria-hidden': 'true' });
  options.series.forEach(series => {
    let segment: string[] = []; const flush = () => { if (segment.length > 1) paths.append(svg('polyline', { points: segment.join(' '), class: `cp03-curve cp03-${series.style}`, 'vector-effect': 'non-scaling-stroke' })); segment = []; };
    series.points.forEach(point => { if (!point) flush(); else segment.push(`${x(point.x)},${y(point.y)}`); }); flush();
  }); image.append(paths);
  for (const mark of options.marks ?? []) {
    if (mark.x !== undefined && mark.y !== undefined) image.append(svg('circle', { cx: x(mark.x), cy: y(mark.y), r: 5, class: 'cp03-cursor' }));
    else if (mark.x !== undefined && mark.x >= xmin && mark.x <= xmax) image.append(svg('line', { x1: x(mark.x), y1: top, x2: x(mark.x), y2: bottom, class: 'cp03-marker' }));
    else if (mark.y !== undefined && mark.y >= ymin && mark.y <= ymax) image.append(svg('line', { x1: left, y1: y(mark.y), x2: right, y2: y(mark.y), class: 'cp03-marker' }));
  }
  for (const handle of options.handles ?? []) {
    if (handle.x !== undefined && (handle.x < xmin || handle.x > xmax) || handle.y !== undefined && (handle.y < ymin || handle.y > ymax)) continue;
    const hx = handle.x !== undefined ? x(handle.x) : right - 12, hy = handle.y !== undefined ? y(handle.y) : handle.key === 'ty' ? 74 : 25;
    const group = svg('g', { role: 'slider', tabindex: 0, 'data-cp03-handle': handle.key, 'aria-label': handle.label, 'aria-orientation': handle.y !== undefined ? 'vertical' : 'horizontal', 'aria-valuemin': handle.min, 'aria-valuemax': handle.max, 'aria-valuenow': handle.value, 'aria-valuetext': `${numberLabel(handle.value)} ${handle.units}`, class: 'cp03-handle' });
    group.append(svg('circle', { cx: hx, cy: hy, r: 22.5, class: 'cp03-hit' }), svg('circle', { cx: hx, cy: hy, r: 6, class: 'cp03-dot' })); image.append(group);
  }
  if (options.onTime && options.signal) image.addEventListener('click', event => { const p = pointerPosition(event.clientX, event.clientY, image.getBoundingClientRect(), geometry); options.onTime?.(p.x); }, { signal: options.signal });
  const legend = document.createElement('p'); legend.className = 'cp03-legend';
  options.series.forEach(series => { const item = document.createElement('span'); item.className = `cp03-key cp03-${series.style}`; item.textContent = series.label; legend.append(item); }); figure.append(image, legend);
  return { element: figure, geometry, image, clipped: points.some(p => p.y < ymin || p.y > ymax), axis: [ymin, ymax] as [number, number] };
}
export function plot(options: PlotOptions): HTMLElement { return drawPlot(options).element; }
