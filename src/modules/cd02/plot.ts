export interface Series { label: string; x: readonly number[]; y: readonly number[]; dashed?: boolean }
export interface Mark { x: number; y: number; label: string; kind: 'pole' | 'zero' | 'selected' }
const ns = 'http://www.w3.org/2000/svg';
export function plot(title: string, xLabel: string, yLabel: string, series: Series[], marks: Mark[] = [], equalScale = false): HTMLElement {
  const figure = document.createElement('figure'), caption = document.createElement('figcaption'); figure.className = 'cd02-plot'; caption.textContent = title; figure.append(caption);
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 680 310');
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${title}. ${xLabel}; ${yLabel}. ${series.map(s => `${s.label}, ${s.dashed ? 'dashed' : 'solid'}`).join('; ')}. ${marks.map(m => m.label).join('; ')}.`);
  let xMin = 0, xMax = 0, yMin = 0, yMax = 0;
  for (const s of series) { for (const x of s.x) { xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); } for (const y of s.y) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); } }
  for (const m of marks) { xMin = Math.min(xMin, m.x); xMax = Math.max(xMax, m.x); yMin = Math.min(yMin, m.y); yMax = Math.max(yMax, m.y); }
  const xPad = Math.max(.1, (xMax - xMin) * .08), yPad = Math.max(.1, (yMax - yMin) * .08); xMin -= xPad; xMax += xPad; yMin -= yPad; yMax += yPad;
  if (equalScale) {
    const unitsPerPixel = Math.max((xMax - xMin) / 560, (yMax - yMin) / 210);
    const centerX = (xMax + xMin) / 2, centerY = (yMax + yMin) / 2;
    xMin = centerX - unitsPerPixel * 280; xMax = centerX + unitsPerPixel * 280;
    yMin = centerY - unitsPerPixel * 105; yMax = centerY + unitsPerPixel * 105;
  } else if (xLabel.startsWith('Time')) { xMin = 0; xMax -= xPad; }
  const X = (x: number) => 95 + (x - xMin) / (xMax - xMin) * 560, Y = (y: number) => 250 - (y - yMin) / (yMax - yMin) * 210;
  function node(name: string, attrs: Record<string, string>, text?: string): void {
    const e = document.createElementNS(ns, name); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (text !== undefined) e.textContent = text; svg.append(e);
  }
  for (let i = 0; i <= 4; i++) {
    const x = xMin + (xMax - xMin) * i / 4, y = yMin + (yMax - yMin) * i / 4;
    node('line', { x1: '95', x2: '655', y1: String(Y(y)), y2: String(Y(y)), class: 'cd02-gridline' });
    node('text', { x: '87', y: String(Y(y) + 4), 'text-anchor': 'end' }, Number(y.toPrecision(3)).toString());
    node('text', { x: String(X(x)), y: '271', 'text-anchor': 'middle' }, Number(x.toPrecision(3)).toString());
  }
  node('line', { x1: String(X(0)), x2: String(X(0)), y1: '40', y2: '250', class: 'cd02-axis' });
  node('line', { x1: '95', x2: '655', y1: String(Y(0)), y2: String(Y(0)), class: 'cd02-axis' });
  series.forEach((s, n) => {
    const indices = new Set<number>([0, s.y.length - 1]), stride = Math.max(1, Math.ceil(s.y.length / 700));
    for (let i = 0; i < s.y.length; i += stride) {
      let min = i, max = i;
      for (let j = i; j < Math.min(s.y.length, i + stride); j++) { if (s.y[j] < s.y[min]) min = j; if (s.y[j] > s.y[max]) max = j; }
      indices.add(min); indices.add(max);
    }
    const d = [...indices].sort((a, b) => a - b).map((i, j) => `${j ? 'L' : 'M'}${X(s.x[i]).toFixed(2)},${Y(s.y[i]).toFixed(2)}`).join(' ');
    node('path', { d, class: `cd02-line cd02-series-${n}`, ...(s.dashed ? { 'stroke-dasharray': '7 5' } : {}) });
  });
  for (const m of marks) {
    const x = X(m.x), y = Y(m.y);
    if (m.kind === 'pole') node('path', { d: `M${x - 5},${y - 5}L${x + 5},${y + 5}M${x - 5},${y + 5}L${x + 5},${y - 5}`, class: 'cd02-mark' });
    else node('circle', { cx: String(x), cy: String(y), r: m.kind === 'zero' ? '5' : '4', class: `cd02-mark cd02-${m.kind}` });
  }
  node('text', { x: '375', y: '303', 'text-anchor': 'middle' }, xLabel); node('text', { x: '95', y: '24' }, yLabel); figure.append(svg);
  const legend = document.createElement('p'); legend.className = 'cd02-note'; legend.textContent = series.map(s => `${s.dashed ? '┄' : '━'} ${s.label}`).join(' · '); figure.append(legend);
  if (marks.length) { const key = document.createElement('p'); key.className = 'cd02-note'; key.textContent = `× open-loop poles; ○ zero; ● selected closed-loop poles. ${marks.map(m => m.label).join('; ')}`; figure.append(key); }
  return figure;
}
