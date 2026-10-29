import type { Pole, Sample } from './math';
const ns = 'http://www.w3.org/2000/svg';
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, text = ''): SVGElementTagNameMap[K] {
  const element = document.createElementNS(ns, tag);
  Object.entries(attrs).forEach(([name, value]) => element.setAttribute(name, String(value))); element.textContent = text; return element;
}
export function label(value: number): string {
  if (value === 0) return '0';
  return Math.abs(value) >= 1e4 || Math.abs(value) < 1e-4 ? value.toExponential(3).replace(/\.?(0+)e/, 'e') : String(Number(value.toPrecision(6)));
}
export type Series = { readonly key: 'r' | 'y' | 'u' | 'x1' | 'x2'; readonly name: string; readonly style: 'open' | 'filled' };
export function stems(samples: readonly Sample[], series: readonly Series[], title: string, units: string) {
  const figure = document.createElement('figure'); figure.className = 'dd06-plot'; figure.tabIndex = 0; figure.setAttribute('aria-label', title);
  const caption = document.createElement('figcaption'); caption.textContent = title;
  const plot = svg('svg', { viewBox: '0 0 640 300', role: 'img', 'aria-label': `${title}. Time t=kT in seconds; ${units}.` });
  const bottom = 246, top = 24, left = 106, right = 608;
  const values = samples.flatMap(sample => series.map(s => sample[s.key])), lo = Math.min(0, ...values), hi = Math.max(0, ...values), pad = (hi - lo || 1) * 0.12;
  const min = lo - pad, max = hi + pad, last = samples.at(-1)!;
  const px = (t: number) => left + t / (last.t || 1) * (right - left), py = (value: number) => bottom - (value - min) / (max - min) * (bottom - top);
  for (let j = 0; j <= 4; j++) {
    const time = last.t * j / 4, value = min + (max - min) * j / 4, x = px(time), y = py(value);
    plot.append(svg('line', { x1: left, x2: right, y1: y, y2: y, class: 'dd06-grid' }), svg('line', { x1: x, x2: x, y1: top, y2: bottom, class: 'dd06-grid' }));
    plot.append(svg('text', { x: left - 9, y: y + 4, 'text-anchor': 'end' }, label(value)), svg('text', { x, y: bottom + 19, 'text-anchor': 'middle' }, label(time)));
  }
  plot.append(svg('text', { x: (left + right) / 2, y: 288, 'text-anchor': 'middle' }, 'Time t = kT (s)'), svg('text', { x: 20, y: (top + bottom) / 2, 'text-anchor': 'middle', transform: `rotate(-90 20 ${(top + bottom) / 2})` }, units));
  const stride = Math.max(1, Math.ceil(samples.length / 160)), indices = new Set<number>();
  for (let i = 0; i < samples.length; i += stride) indices.add(i);
  indices.add(samples.length - 1);
  for (const s of series) for (const i of indices) {
    const sample = samples[i], x = px(sample.t), y = py(sample[s.key]), style = `dd06-${s.style}`;
    plot.append(svg('line', { x1: x, x2: x, y1: py(0), y2: y, class: style }), svg('circle', { cx: x, cy: y, r: 2.2, class: style }));
  }
  const cursor = svg('line', { y1: top, y2: bottom, class: 'dd06-cursor' }), markers = series.map(s => svg('circle', { r: 5, class: `dd06-${s.style} dd06-selected` })), selected = svg('text', { x: right, y: 15, 'text-anchor': 'end' });
  plot.append(cursor, ...markers, selected);
  const legend = document.createElement('p'); legend.className = 'dd06-note'; legend.textContent = series.map(s => `${s.name} (${s.style === 'open' ? 'open/dashed' : 'filled/solid'})`).join(' · ');
  const note = document.createElement('p'); note.className = 'dd06-note'; note.textContent = `${indices.size} regular stems of ${samples.length} computed samples; the highlighted point can be any computed integer k. Samples do not show intersample motion.`;
  figure.append(caption, plot, legend, note);
  const select = (index: number) => {
    const sample = samples[index], x = px(sample.t); cursor.setAttribute('x1', String(x)); cursor.setAttribute('x2', String(x)); selected.textContent = `k=${index}`;
    markers.forEach((marker, j) => { marker.setAttribute('cx', String(x)); marker.setAttribute('cy', String(py(sample[series[j].key]))); });
  };
  return { element: figure, select };
}
export function poleMap(targets: readonly Pole[], actual: readonly Pole[]): HTMLElement {
  const figure = document.createElement('figure'); figure.className = 'dd06-plot'; figure.tabIndex = 0; figure.setAttribute('aria-label', 'Desired and actual closed-loop poles');
  const caption = document.createElement('figcaption'); caption.textContent = 'Desired ○ and actual × closed-loop poles';
  const plot = svg('svg', { viewBox: '0 0 500 300', role: 'img', 'aria-label': 'Discrete pole plane with unit circle, desired circles and computed closed-loop crosses.' });
  const extent = Math.max(1.25, ...[...targets, ...actual].flatMap(p => [Math.abs(p.re) * 1.15, Math.abs(p.im) * 1.15])), scale = 112 / extent;
  const x = (value: number) => 250 + value * scale, y = (value: number) => 143 - value * scale;
  plot.append(svg('line', { x1: 35, x2: 465, y1: y(0), y2: y(0), class: 'dd06-grid' }), svg('line', { x1: x(0), x2: x(0), y1: 15, y2: 267, class: 'dd06-grid' }), svg('circle', { cx: x(0), cy: y(0), r: scale, class: 'dd06-grid', fill: 'none' }));
  for (const value of [-1, 0, 1]) plot.append(svg('text', { x: x(value), y: y(0) + 18, 'text-anchor': 'middle' }, String(value)));
  plot.append(svg('text', { x: 466, y: y(0) - 8, 'text-anchor': 'end' }, 'Real z'), svg('text', { x: x(0) + 9, y: 19 }, 'Imag z'));
  targets.forEach(pole => plot.append(svg('circle', { cx: x(pole.re), cy: y(pole.im), r: 7, class: 'dd06-open' })));
  actual.forEach(pole => { const cx = x(pole.re), cy = y(pole.im); plot.append(svg('path', { d: `M${cx - 4},${cy - 4}L${cx + 4},${cy + 4}M${cx - 4},${cy + 4}L${cx + 4},${cy - 4}`, class: 'dd06-filled', fill: 'none' })); });
  const note = document.createElement('p'); note.className = 'dd06-note'; note.textContent = 'All two retained modes are shown; repeated/coincident markers can overlap. Roots are numerical approximations.';
  figure.append(caption, plot, note); return figure;
}
