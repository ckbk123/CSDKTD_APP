import { physicalOutputAt, type Run } from './math';
import { numberText as n } from './format';
const NS = 'http://www.w3.org/2000/svg';
export interface PlotCase { readonly label: string; readonly run: Run; readonly position: number }
const dash = ['', '9 4', '2 4'];
export function comparisonPlot(cases: readonly PlotCase[], quantity: 'output' | 'control', reconstruct: boolean): HTMLElement {
  const figure = document.createElement('figure'); figure.className = 'sp-figure';
  if (!cases.length) { const message = document.createElement('p'); message.textContent = 'Select at least one complete case for the comparison plot.'; figure.append(message); return figure; }
  const wrap = document.createElement('div'); wrap.className = 'sp-scroll sp-plot'; wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', `${quantity === 'output' ? 'Output' : 'Held control'} comparison, scroll horizontally if needed`);
  const svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 680 320'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', quantity === 'output' ? 'Output samples on a common seconds axis' : 'Zero-order-held control on a common seconds axis');
  const add = (tag: string, attributes: Record<string, string>, text?: string) => {
    const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value); if (text !== undefined) node.textContent = text; svg.append(node); return node;
  };
  const horizon = cases[0].run.task.horizon;
  const values = cases.flatMap(({ run }) => quantity === 'output' ? [run.minimum, run.maximum, run.task.reference] : run.holds.map(hold => hold.control));
  let low = Math.min(0, ...values), high = Math.max(0, ...values);
  if (high === low) { low -= 1; high += 1; } else { const padding = (high - low) * 0.1; low -= padding; high += padding; }
  const x = (time: number) => 78 + 574 * time / horizon, y = (value: number) => 265 - 230 * (value - low) / (high - low), point = (time: number, value: number) => `${x(time).toFixed(3)},${y(value).toFixed(3)}`;
  for (const value of [low, (low + high) / 2, high]) { add('line', { x1: '78', x2: '652', y1: String(y(value)), y2: String(y(value)), class: 'sp-grid' }); add('text', { x: '70', y: String(y(value) + 4), 'text-anchor': 'end' }, n(value)); }
  for (const time of [0, horizon / 2, horizon]) { add('line', { x1: String(x(time)), x2: String(x(time)), y1: '35', y2: '265', class: 'sp-grid' }); add('text', { x: String(x(time)), y: '286', 'text-anchor': 'middle' }, n(time)); }
  add('text', { x: '365', y: '311', 'text-anchor': 'middle' }, 'Physical time t (s)'); add('text', { x: '80', y: '20' }, quantity === 'output' ? 'Output y (normalized)' : 'Held input u (normalized)');
  if (quantity === 'output') add('line', { x1: '78', x2: '652', y1: String(y(cases[0].run.task.reference)), y2: String(y(cases[0].run.task.reference)), class: 'sp-reference' });
  for (const item of cases) {
    const { run } = item, attributes = { fill: 'none', class: run.spec.policy === 'fixed' ? 'sp-fixed' : 'sp-redesign', 'stroke-dasharray': dash[item.position % 3], 'stroke-width': '2' };
    if (quantity === 'control') {
      add('polyline', { ...attributes, points: run.holds.flatMap(hold => [point(hold.time, hold.control), point(hold.end, hold.control)]).join(' ') });
    } else {
      if (reconstruct) add('polyline', { ...attributes, points: Array.from({ length: 401 }, (_, index) => { const time = index === 400 ? horizon : horizon * index / 400; return point(time, physicalOutputAt(run, time)); }).join(' ') });
      const stride = Math.max(1, Math.ceil(run.holds.length / 200)), indexes = [...new Set([...Array.from({ length: Math.ceil(run.holds.length / stride) }, (_, index) => index * stride), run.holds.length - 1])];
      for (const index of indexes) {
        const hold = run.holds[index];
        if (run.spec.policy === 'fixed') add('circle', { cx: String(x(hold.time)), cy: String(y(hold.output)), r: '2.6', class: 'sp-fixed', fill: 'none', 'stroke-width': '1.5' });
        else { const px = x(hold.time), py = y(hold.output); add('path', { d: `M${px},${py - 3} l3,3 -3,3 -3,-3 Z`, class: 'sp-redesign', fill: 'none', 'stroke-width': '1.5' }); }
      }
      add('rect', { x: String(x(horizon) - 3), y: String(y(run.terminal) - 3), width: '6', height: '6', class: attributes.class, fill: 'none', 'stroke-width': '1.5' });
    }
  }
  const caption = document.createElement('figcaption');
  caption.textContent = quantity === 'output'
    ? `Circles: fixed gain; diamonds: redesigned gain; terminal squares are observations at common H, not extra control updates. Reference is the dashed horizontal line. At most 201 sample markers per case; every interval enters the metrics. ${reconstruct ? 'Curves evaluate the declared continuous plant and held input at 401 display times; straight line segments approximate that physical reconstruction.' : 'Samples have no connecting interpolation. Enable physical reconstruction to evaluate the declared plant and hold between ticks.'}`
    : 'Each horizontal segment is the actual constant held control over that interval. Vertical edges mark updates. Control energy uses every complete or partial hold interval.';
  wrap.append(svg); figure.append(wrap, caption); return figure;
}
