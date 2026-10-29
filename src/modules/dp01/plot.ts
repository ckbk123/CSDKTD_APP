import { format } from './math';

export interface Trace { name: string; values: number[]; secondary?: boolean }
/** Stems are computed samples. Optional stairs are explicitly a drawing guide. */
export function stemPlot(traces: Trace[], T: number, seconds: boolean, held: boolean, selected = -1): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 680 280');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', `${traces.map(t => t.name).join(' and ')} sequence stems. Horizontal axis: ${seconds ? 'time in seconds' : 'sample index k'}. Vertical axis: amplitude.`);
  const node = (tag: string, attrs: Record<string, string | number>, text?: string): SVGElement => {
    const e = document.createElementNS(ns, tag);
    Object.entries(attrs).forEach(([key, value]) => e.setAttribute(key, String(value)));
    if (text !== undefined) e.textContent = text;
    svg.append(e); return e;
  };
  const values = traces.flatMap(t => t.values);
  let low = Math.min(0, ...values), high = Math.max(0, ...values);
  const pad = Math.max((high - low) * 0.12, 0.1);
  low -= pad; high += pad;
  const count = traces[0].values.length;
  const x = (k: number): number => 86 + 564 * k / (count - 1);
  const y = (v: number): number => 224 - 196 * (v - low) / (high - low);
  for (let i = 0; i <= 4; i++) {
    const v = low + (high - low) * i / 4;
    node('line', { x1: 86, y1: y(v), x2: 650, y2: y(v), class: 'dp-grid' });
    node('text', { x: 78, y: y(v) + 4, 'text-anchor': 'end' }, format(v));
    const k = Math.round(i * (count - 1) / 4);
    node('text', { x: x(k), y: 245, 'text-anchor': 'middle' }, format(seconds ? k * T : k));
  }
  node('line', { x1: 86, y1: y(0), x2: 650, y2: y(0), class: 'dp-axis' });
  node('text', { x: 86, y: 15 }, 'Amplitude');
  node('text', { x: 370, y: 273, 'text-anchor': 'middle' }, seconds ? 'Time t = kT (s)' : 'Sample index k');
  traces.forEach(t => {
    const cls = t.secondary ? 'dp-secondary' : 'dp-primary';
    t.values.forEach((v, k) => {
      node('line', { x1: x(k), y1: y(0), x2: x(k), y2: y(v), class: cls, 'stroke-dasharray': t.secondary ? '3 2' : '' });
      node('circle', { cx: x(k), cy: y(v), r: k === selected ? 5 : 2.6, class: cls });
    });
    if (held) {
      const d = t.values.map((v, k) => k === 0 ? `M${x(k)},${y(v)}` : `H${x(k)}V${y(v)}`).join(' ');
      node('path', { d, class: `${cls} dp-held` });
    }
  });
  return svg;
}
