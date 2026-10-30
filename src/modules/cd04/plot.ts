export interface Series { label: string; x: readonly number[]; y: readonly number[]; dashed?: boolean }
export interface Mark { x: number; y: number; label: string; kind: 'pole' | 'zero' | 'selected' | 'target' }
const ns = 'http://www.w3.org/2000/svg';
export function plot(title: string, xLabel: string, yLabel: string, series: Series[], marks: Mark[] = [], equalScale = false): HTMLElement {
  const figure = document.createElement('figure'), caption = document.createElement('figcaption'); figure.className = 'cd04-plot'; caption.textContent = title; figure.append(caption);
  if (series.some(s => s.x.length !== s.y.length || !s.x.length || [...s.x, ...s.y].some(v => !Number.isFinite(v))) || marks.some(m => !Number.isFinite(m.x) || !Number.isFinite(m.y))) throw new Error('Plot data must be finite with matching nonempty coordinates.');
  const canvasWidth = equalScale ? 640 : 830, canvasHeight = equalScale ? 560 : 400;
  const left = 106, right = equalScale ? 585 : 775, top = 40, bottom = equalScale ? 475 : 315, width = right - left, height = bottom - top;
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${canvasWidth} ${canvasHeight}`);
  svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `${title}. ${xLabel}; ${yLabel}. ${series.map(s => `${s.label}, ${s.dashed ? 'dashed' : 'solid'}`).join('; ')}. ${marks.map(m => m.label).join('; ')}.`);
  let xMin = 0, xMax = 0, yMin = 0, yMax = 0;
  for (const s of series) { for (const x of s.x) { xMin = Math.min(xMin, x); xMax = Math.max(xMax, x); } for (const y of s.y) { yMin = Math.min(yMin, y); yMax = Math.max(yMax, y); } }
  for (const m of marks) { xMin = Math.min(xMin, m.x); xMax = Math.max(xMax, m.x); yMin = Math.min(yMin, m.y); yMax = Math.max(yMax, m.y); }
  const nonnegativeTime = xLabel.startsWith('Time') && yMin === 0;
  const xPad = Math.max(.1, (xMax - xMin) * .08), yPad = Math.max(.1, (yMax - yMin) * .08); xMin -= xPad; xMax += xPad; if (!nonnegativeTime) yMin -= yPad; yMax += yPad;
  if (equalScale) {
    const unitsPerPixel = Math.max((xMax - xMin) / width, (yMax - yMin) / height);
    const centerX = (xMax + xMin) / 2, centerY = (yMax + yMin) / 2;
    xMin = centerX - unitsPerPixel * width / 2; xMax = centerX + unitsPerPixel * width / 2;
    yMin = centerY - unitsPerPixel * height / 2; yMax = centerY + unitsPerPixel * height / 2;
  } else if (xLabel.startsWith('Time')) { xMin = 0; xMax -= xPad; }
  const X = (x: number) => left + (x - xMin) / (xMax - xMin) * width, Y = (y: number) => bottom - (y - yMin) / (yMax - yMin) * height;
  function node(name: string, attrs: Record<string, string>, text?: string): void {
    const e = document.createElementNS(ns, name); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); if (text !== undefined) e.textContent = text; svg.append(e);
  }
  for (let i = 0; i <= 4; i++) {
    const x = xMin + (xMax - xMin) * i / 4, y = yMin + (yMax - yMin) * i / 4;
    node('line', { x1: String(left), x2: String(right), y1: String(Y(y)), y2: String(Y(y)), class: 'cd04-gridline' });
    node('text', { x: String(left - 9), y: String(Y(y) + 4), 'text-anchor': 'end' }, Number(y.toPrecision(3)).toString());
    node('text', { x: String(X(x)), y: String(bottom + 33), 'text-anchor': 'middle' }, Number(x.toPrecision(3)).toString());
  }
  node('line', { x1: String(X(0)), x2: String(X(0)), y1: String(top), y2: String(bottom), class: 'cd04-axis' });
  node('line', { x1: String(left), x2: String(right), y1: String(Y(0)), y2: String(Y(0)), class: 'cd04-axis' });
  series.forEach((s, n) => {
    const indices = new Set<number>([0, s.y.length - 1]), stride = Math.max(1, Math.ceil(s.y.length / 700));
    for (let i = 0; i < s.y.length; i += stride) {
      let min = i, max = i;
      for (let j = i; j < Math.min(s.y.length, i + stride); j++) { if (s.y[j] < s.y[min]) min = j; if (s.y[j] > s.y[max]) max = j; }
      indices.add(min); indices.add(max);
    }
    const d = [...indices].sort((a, b) => a - b).map((i, j) => `${j ? 'L' : 'M'}${X(s.x[i]).toFixed(2)},${Y(s.y[i]).toFixed(2)}`).join(' ');
    node('path', { d, class: `cd04-line cd04-series-${n}`, ...(s.dashed ? { 'stroke-dasharray': '7 5' } : {}) });
  });
  for (const m of marks) {
    const x = X(m.x), y = Y(m.y);
    if (m.kind === 'pole') node('path', { d: `M${x - 5},${y - 5}L${x + 5},${y + 5}M${x - 5},${y + 5}L${x + 5},${y - 5}`, class: 'cd04-mark' });
    else if (m.kind === 'target') node('path', { d: `M${x},${y - 7}L${x + 7},${y}L${x},${y + 7}L${x - 7},${y}Z`, class: 'cd04-mark cd04-target' });
    else node('circle', { cx: String(x), cy: String(y), r: m.kind === 'zero' ? '5' : '4', class: `cd04-mark cd04-${m.kind}` });
  }
  node('text', { x: String((left + right) / 2), y: String(canvasHeight - 10), 'text-anchor': 'middle' }, xLabel); node('text', { x: String(left + 40), y: '27' }, yLabel); figure.append(svg);
  const legend = document.createElement('p'); legend.className = 'cd04-note'; legend.textContent = series.map(s => `${s.dashed ? '┄' : '━'} ${s.label}`).join(' · '); figure.append(legend);
  if (marks.length) { const key = document.createElement('p'); key.className = 'cd04-note'; key.textContent = '× open-loop poles; ○ zero; ● selected closed-loop poles; ◇ desired target.'; figure.append(key); }
  return figure;
}
