import type { Sample } from './math';

const NS = 'http://www.w3.org/2000/svg';
export const label = (value: number): string => {
  const magnitude = Math.abs(value);
  if (magnitude >= 1e4 || magnitude > 0 && magnitude < 1e-3) return value.toExponential(2).replace(/(\.\d*?)0+e/, '$1e').replace('.e', 'e').replace('e+', 'e');
  return Number(value.toPrecision(6)).toString();
};
function svg<K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string | number> = {}, text = ''): SVGElementTagNameMap[K] {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  element.textContent = text; return element;
}
interface Series { key: 'r' | 'y' | 'comparator' | 'tracking'; name: string; className: string }
export function stemPlot(samples: Sample[], series: Series[], title: string): { element: HTMLElement; select: (index: number) => void } {
  const figure = document.createElement('figure'); figure.className = 'df02-plot'; figure.tabIndex = 0;
  figure.setAttribute('aria-label', title); figure.setAttribute('aria-description', 'Discrete stems. Scroll horizontally with the keyboard if needed.');
  const caption = document.createElement('figcaption'); caption.textContent = title; figure.append(caption);
  const graph = svg('svg', { viewBox: '0 0 600 310', role: 'img', 'aria-label': `${title}. Time t=kT in seconds; signal in the declared arbitrary units.` });
  const last = samples.at(-1)!, end = Math.max(last.t, samples[1]?.t ?? 1);
  const values = samples.flatMap(s => series.map(item => s[item.key]));
  let low = Math.min(0, ...values), high = Math.max(0, ...values);
  const padding = (high - low || 1) * 0.12; low -= padding; high += padding;
  const x = (t: number) => 107 + 473 * t / end, y = (v: number) => 252 - 222 * (v - low) / (high - low);
  const ticks = new Set<number>();
  for (let i = 0; i <= 4; i++) {
    const k = Math.round(last.k * i / 4), t = samples[k]?.t ?? 0, value = low + (high - low) * i / 4;
    if (!ticks.has(k)) { graph.append(svg('line', { x1: x(t), y1: 30, x2: x(t), y2: 252, class: 'df02-grid' }), svg('text', { x: x(t), y: 272, 'text-anchor': 'middle' }, label(t))); ticks.add(k); }
    graph.append(svg('line', { x1: 107, y1: y(value), x2: 580, y2: y(value), class: 'df02-grid' }), svg('text', { x: 100, y: y(value) + 4, 'text-anchor': 'end' }, label(value)));
  }
  graph.append(svg('line', { x1: 107, y1: y(0), x2: 580, y2: y(0), class: 'df02-grid' }), svg('text', { x: 344, y: 298, 'text-anchor': 'middle' }, 'Time t = kT (s)'), svg('text', { x: 17, y: 141, 'text-anchor': 'middle', transform: 'rotate(-90 17 141)' }, 'Signal (units)'));
  const step = Math.max(1, Math.ceil(last.k / 120));
  const indices = samples.filter(s => s.k % step === 0 || s.k === last.k);
  series.forEach(item => {
    const group = svg('g', { class: item.className });
    for (const s of indices) group.append(svg('line', { x1: x(s.t), y1: y(0), x2: x(s.t), y2: y(s[item.key]) }), svg('circle', { cx: x(s.t), cy: y(s[item.key]), r: 2.4 }));
    graph.append(group);
  });
  const cursor = svg('line', { y1: 30, y2: 252, class: 'df02-cursor' });
  const selected = series.map(item => svg('circle', { r: 5, class: `${item.className} df02-selected` }));
  const cursorText = svg('text', { y: 20 }); graph.append(cursor, ...selected, cursorText);
  const legend = document.createElement('p'); legend.className = 'df02-legend';
  legend.textContent = series.map(s => s.name).join(' · ');
  const note = document.createElement('p'); note.className = 'df02-note';
  note.textContent = `Regular stems show ${indices.length} of ${samples.length} computed sample positions; the highlighted point can be any computed integer k. No intersample hold model is assumed.`;
  figure.append(graph, legend, note);
  const select = (index: number) => {
    const s = samples[index]; if (!s) return;
    cursor.setAttribute('x1', String(x(s.t))); cursor.setAttribute('x2', String(x(s.t)));
    selected.forEach((circle, i) => { circle.setAttribute('cx', String(x(s.t))); circle.setAttribute('cy', String(y(s[series[i].key]))); });
    cursorText.setAttribute('x', String(x(s.t))); cursorText.setAttribute('text-anchor', s.k > last.k / 2 ? 'end' : 'start'); cursorText.textContent = `k=${s.k}`;
  };
  select(last.k); return { element: figure, select };
}
