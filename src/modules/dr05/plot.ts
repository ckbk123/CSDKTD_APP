import { fmt, type Result } from './math';
/** Output paths are reconstructed from the declared continuous plant/hold.
 * Each interval is a separate path, retaining direct-feedthrough jumps. */
export function trajectoryPlot(result: Result, panel: 'output' | 'input', selected: number): SVGSVGElement {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 700 285'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', panel === 'output' ? 'Continuous held-input output trajectory with exact sample circles and approximate sample squares; time in seconds, output in normalized units' : 'Delayed held input and sample clock; time in seconds, input in normalized units');
  const add = (tag: string, attrs: Record<string, string | number>, value?: string): void => {
    const e = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([key, v]) => e.setAttribute(key, String(v)));
    if (value !== undefined) e.textContent = value; svg.append(e);
  };
  const rows = result.samples, last = rows.at(-1)!.t;
  const values = panel === 'input' ? rows.map(r => r.held) : result.segments.flat().map(p => p.y).concat(rows.map(r => r.y), result.comparison?.map(r => r.y) ?? []);
  const min = Math.min(0, ...values), max = Math.max(0, ...values), pad = Math.max(0.1, 0.1 * (max - min));
  const x = (t: number): number => 90 + 575 * t / last;
  const y = (v: number): number => 226 - 198 * (v - min + pad) / (max - min + 2 * pad);
  for (let i = 0; i <= 4; i++) {
    const value = min - pad + (max - min + 2 * pad) * i / 4;
    add('line', { x1: 90, x2: 665, y1: y(value), y2: y(value), class: 'zoh-grid' });
    add('text', { x: 82, y: y(value) + 4, 'text-anchor': 'end' }, fmt(value));
    add('text', { x: x(last * i / 4), y: 248, 'text-anchor': 'middle' }, fmt(last * i / 4));
  }
  rows.forEach(r => add('line', { x1: x(r.t), x2: x(r.t), y1: 28, y2: 226, class: 'zoh-clock' }));
  if (panel === 'output') {
    result.segments.forEach(segment => add('path', { d: segment.map((p, i) => `${i ? 'L' : 'M'}${x(p.t)},${y(p.y)}`).join(' '), class: 'zoh-line' }));
    result.comparison?.forEach(r => add('rect', { x: x(r.t) - 3.5, y: y(r.y) - 3.5, width: 7, height: 7, class: 'zoh-approx' }));
    rows.forEach(r => add('circle', { cx: x(r.t), cy: y(r.y), r: r.k === selected ? 5 : 2.5, class: 'zoh-exact' }));
  } else {
    const d = rows.map((r, i) => `${i ? 'H' : 'M'}${x(r.t)}${i ? 'V' : ','}${y(r.held)}`).join(' ');
    add('path', { d, class: 'zoh-line' });
    rows.forEach(r => add('circle', { cx: x(r.t), cy: y(r.held), r: r.k === selected ? 5 : 3, class: 'zoh-exact' }));
  }
  add('text', { x: 90, y: 17 }, panel === 'output' ? 'Output (normalized units)' : 'Held input (normalized units)');
  add('text', { x: 377, y: 278, 'text-anchor': 'middle' }, 'Time t (s); vertical guides mark sample instants');
  return svg;
}
