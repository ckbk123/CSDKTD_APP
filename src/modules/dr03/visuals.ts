import { fmt, type Result } from './math';
const ns = 'http://www.w3.org/2000/svg';
function node(tag: string, attributes: Record<string, string | number> = {}, text = ''): SVGElement {
  const element = document.createElementNS(ns, tag);
  Object.entries(attributes).forEach(([k, v]) => element.setAttribute(k, String(v)));
  if (text) element.textContent = text; return element;
}
function svg(width: number, height: number, label: string): SVGSVGElement {
  return node('svg', { viewBox: '0 0 ' + width + ' ' + height, role: 'img', 'aria-label': label }) as SVGSVGElement;
}
export function delayDiagram(result: Result, selected: number | 'y'): SVGSVGElement {
  const n = result.model.a.length - 1, L = result.history.labels.length - n;
  const cells = Math.max(n, L, 1), width = Math.max(570, 110 + cells * 135);
  const out = svg(width, 218, 'History register: one scalar sample per unit-delay cell. Output and input lanes shift once per sample.');
  out.setAttribute('role', 'group');
  out.style.minWidth = width + 'px';
  const lane = (count: number, y: number, offset: number, symbol: string): void => {
    out.append(node('text', { x: 12, y: y + 23, class: 'dr03-svg-label' }, symbol + '[k]'));
    if (!count) { out.append(node('text', { x: 100, y: y + 23, class: 'dr03-svg-muted' }, 'No stored ' + symbol + ' samples')); return; }
    for (let i = 0; i < count; i++) {
      const x = 105 + 135 * i;
      out.append(node('path', { d: 'M ' + (x - 22) + ' ' + (y + 21) + ' h 17 m -5 -4 l 5 4 -5 4', class: 'dr03-svg-line' }));
      const group = node('g', { role: 'button', tabindex: 0, 'data-state-index': offset + i, 'aria-pressed': String(i + offset === selected), 'aria-label': 'Select history state x' + (offset + i + 1) + ': ' + symbol + '[k−' + (i + 1) + ']' });
      group.append(node('rect', { x, y, width: 108, height: 62, rx: 7, class: i + offset === selected ? 'dr03-delay selected' : 'dr03-delay' }),
        node('text', { x: x + 54, y: y + 23, 'text-anchor': 'middle', class: 'dr03-svg-label' }, 'z⁻¹ · x' + (offset + i + 1)),
        node('text', { x: x + 54, y: y + 45, 'text-anchor': 'middle', class: 'dr03-svg-muted' }, symbol + '[k−' + (i + 1) + ']'));
      out.append(group);
    }
  };
  lane(n, 15, 0, 'y'); lane(L, 107, n, 'u');
  out.append(node('text', { x: 12, y: 202, class: 'dr03-svg-muted' }, 'y[k] = Cₕxₕ[k] + Dₕu[k]; compute it before shifting either lane.'));
  return out;
}
export function samplePlot(result: Result): SVGSVGElement {
  const rows = result.rows, width = 650, height = 245, left = 61, right = 20, top = 20, bottom = 47;
  const all = rows.map(row => row.y).concat(result.reference, 0), min = Math.min(...all), max = Math.max(...all);
  const pad = Math.max((max - min) * .1, Math.max(Math.abs(min), Math.abs(max)) * .02, 1e-9), lo = min - pad, hi = max + pad;
  const px = (k: number): number => left + k / (rows.length - 1) * (width - left - right);
  const py = (y: number): number => height - bottom - (y - lo) / (hi - lo) * (height - top - bottom);
  const out = svg(width, height, 'Sampled output against time in seconds. Indigo stems: history state model. Hollow circles: independently indexed recurrence.');
  for (let i = 0; i <= 4; i++) {
    const value = lo + (hi - lo) * i / 4, y = py(value);
    const clean = Math.abs(value) < (hi - lo) * 1e-12 ? 0 : value;
    out.append(node('line', { x1: left, x2: width - right, y1: y, y2: y, class: 'dr03-grid' }));
    out.append(node('text', { x: left - 8, y: y + 4, 'text-anchor': 'end', class: 'dr03-svg-muted' }, fmt(clean)));
  }
  out.append(node('line', { x1: left, x2: width - right, y1: py(0), y2: py(0), class: 'dr03-svg-line' }));
  rows.forEach((row, i) => {
    out.append(node('line', { x1: px(i), x2: px(i), y1: py(0), y2: py(row.y), class: 'dr03-stem' }));
    out.append(node('circle', { cx: px(i), cy: py(row.y), r: 2.3, class: 'dr03-point' }));
    out.append(node('circle', { cx: px(i), cy: py(result.reference[i]), r: 4.2, class: 'dr03-reference' }));
  });
  for (const i of [...new Set([0, Math.floor((rows.length - 1) / 2), rows.length - 1])]) {
    out.append(node('text', { x: px(i), y: height - 27, 'text-anchor': 'middle', class: 'dr03-svg-muted' }, fmt(rows[i].t)));
  }
  out.append(node('text', { x: width / 2, y: height - 7, 'text-anchor': 'middle', class: 'dr03-svg-label' }, 'Time kT (s)'));
  out.append(node('text', { x: 5, y: 12, class: 'dr03-svg-label' }, 'y[k]'));
  return out;
}
