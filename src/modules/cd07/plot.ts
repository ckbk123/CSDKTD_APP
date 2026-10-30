export interface Series { label: string; x: readonly number[]; y: readonly number[]; dashed?: boolean }
const ns = 'http://www.w3.org/2000/svg';
export function plot(title: string, yLabel: string, series: Series[], guides: number[] = []): HTMLElement {
  const figure = document.createElement('figure'); figure.className = 'cd07-plot';
  const caption = document.createElement('figcaption'); caption.textContent = title; figure.append(caption);
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 680 290');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${title}. Horizontal axis: time in seconds. Vertical axis: ${yLabel}. ${series.map(s => `${s.label}, ${s.dashed ? 'dashed' : 'solid'}`).join('; ')}.`);
  let xMax = 1, low = 0, high = 1;
  for (const s of series) { for (const x of s.x) xMax = Math.max(xMax, x); for (const y of s.y) { low = Math.min(low, y); high = Math.max(high, y); } }
  for (const y of guides) { low = Math.min(low, y); high = Math.max(high, y); }
  const pad = (high - low) * .08; low -= pad; high += pad;
  const X = (x: number) => 95 + x / xMax * 560, Y = (y: number) => 240 - (y - low) / (high - low) * 210;
  function node(name: string, attrs: Record<string, string>, text?: string): SVGElement {
    const e = document.createElementNS(ns, name); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    if (text !== undefined) e.textContent = text; svg.append(e); return e;
  }
  for (let i = 0; i <= 4; i++) {
    const t = xMax * i / 4, y = low + (high - low) * i / 4;
    node('line', { x1: '95', x2: '655', y1: String(Y(y)), y2: String(Y(y)), class: 'cd07-gridline' });
    node('text', { x: '87', y: String(Y(y) + 4), 'text-anchor': 'end' }, Number(y.toPrecision(3)).toString());
    node('text', { x: String(X(t)), y: '258', 'text-anchor': 'middle' }, Number(t.toPrecision(3)).toString());
  }
  for (const y of guides) node('line', { x1: '95', x2: '655', y1: String(Y(y)), y2: String(Y(y)), class: 'cd07-guide' });
  series.forEach((s, i) => {
    const indices = new Set<number>([0, s.y.length - 1]), stride = Math.max(1, Math.ceil(s.y.length / 700));
    // Preserve each bucket's extrema in time order when reducing the drawn path.
    for (let n = 0; n < s.y.length; n += stride) {
      let min = n, max = n;
      for (let j = n; j < Math.min(s.y.length, n + stride); j++) { if (s.y[j] < s.y[min]) min = j; if (s.y[j] > s.y[max]) max = j; }
      indices.add(min); indices.add(max);
    }
    const d = [...indices].sort((a, b) => a - b).map((j, k) => `${k ? 'L' : 'M'}${X(s.x[j]).toFixed(2)},${Y(s.y[j]).toFixed(2)}`).join(' ');
    node('path', { d, class: `cd07-line cd07-series-${i}`, ...(s.dashed ? { 'stroke-dasharray': '8 5' } : {}) });
  });
  node('text', { x: '375', y: '282', 'text-anchor': 'middle' }, 'Time (s)'); node('text', { x: '95', y: '23' }, yLabel);
  figure.append(svg); const legend = document.createElement('p'); legend.className = 'cd07-legend';
  legend.textContent = series.map(s => `${s.dashed ? '┄' : '━'} ${s.label}`).join(' · '); figure.append(legend); return figure;
}
