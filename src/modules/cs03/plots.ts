import { conditions, div, interval, neg, numberOf, type Model, type Complex } from './math';
const ns = 'http://www.w3.org/2000/svg';
function shape(parent: SVGElement, tag: string, attrs: Record<string, number | string>, text?: string) {
  const node = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text; parent.append(node); return node;
}
function figure(title: string, label: string, viewBox: string) {
  const out = document.createElement('figure'), caption = document.createElement('figcaption'); caption.textContent = title;
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); svg.setAttribute('viewBox', viewBox);
  out.append(caption, svg); return { out, svg };
}
const short = (n: number) => {
  if (!n || (Math.abs(n) >= 1e-3 && Math.abs(n) < 1e5)) return n.toLocaleString('en-US', { useGrouping: false, maximumSignificantDigits: 5 });
  const [mantissa, exponent] = n.toExponential(2).split('e');
  return `${mantissa}×10${String(Number(exponent)).replace(/[-0-9]/g, digit => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(digit)])}`;
};
export function conditionPlot(model: Model, gain: number, minimum: number, maximum: number) {
  const { out, svg } = figure('Intersect every condition on the same K axis', 'Four strict Routh conditions and their intersection on a common gain axis', '0 0 480 280');
  out.className = 'c-conditions'; const x = (v: number) => 145 + 305 * (v - minimum) / (maximum - minimum);
  const rows = conditions(model), set = interval(model);
  const spans = rows.map(row => {
    if (!row.slope.n) return row.constant.n > 0n ? [-Infinity, Infinity] : null;
    const bound = numberOf(div(neg(row.constant), row.slope)); return row.slope.n > 0n ? [bound, Infinity] : [-Infinity, bound];
  });
  spans.push(set.kind === 'empty' ? null : set.kind === 'all' ? [-Infinity, Infinity] : [numberOf(set.lower!), numberOf(set.upper!)]);
  for (let i = 0; i < spans.length; i++) {
    const y = 40 + i * 43, span = spans[i];
    shape(svg, 'text', { x: 8, y: y + 5 }, i === 4 ? 'Intersection' : rows[i].label);
    shape(svg, 'line', { x1: 145, x2: 450, y1: y, y2: y, class: 'c-axis' });
    if (span) {
      const lo = Math.max(minimum, span[0]), hi = Math.min(maximum, span[1]);
      if (hi > lo) shape(svg, 'rect', { x: x(lo), y: y - 10, width: x(hi) - x(lo), height: 20, class: 'c-stable' });
      for (const bound of span) if (Number.isFinite(bound) && bound >= minimum && bound <= maximum) shape(svg, 'circle', { cx: x(bound), cy: y, r: 4, class: 'c-open' });
    }
    if (gain >= minimum && gain <= maximum) shape(svg, 'line', { x1: x(gain), x2: x(gain), y1: y - 16, y2: y + 16, class: 'c-selected' });
  }
  shape(svg, 'text', { x: 145, y: 255 }, short(minimum)); shape(svg, 'text', { x: 450, y: 255, 'text-anchor': 'end' }, short(maximum));
  shape(svg, 'text', { x: 300, y: 276, 'text-anchor': 'middle' }, 'K (dimensionless)');
  const note = document.createElement('p'); note.className = 'c-small'; note.textContent = `Tint shows each strict region; open circles exclude equality. The final row is the intersection. The marker is selected K.${gain < minimum || gain > maximum ? ' Selected K lies outside this window.' : ''} Scroll this diagram horizontally on narrow screens. The exact global set is derived above; the drawing is clipped to the chosen window.`; out.append(note); return out;
}
export function rootPlot(roots: readonly Complex[]) {
  const { out, svg } = figure('All three characteristic roots', 'Cubic roots in the complex s plane; shaded left half-plane', '0 0 360 290');
  out.className = 'c-roots'; const largest = Math.max(...roots.map(z => Math.max(Math.abs(z.re), Math.abs(z.im)))), extent = largest ? largest * 1.25 : 1;
  const x = (r: number) => 180 + 130 * r / extent, y = (i: number) => 135 - 110 * i / extent;
  shape(svg, 'rect', { x: 40, y: 25, width: 140, height: 220, class: 'c-left' });
  shape(svg, 'line', { x1: 30, x2: 330, y1: 135, y2: 135, class: 'c-axis' }); shape(svg, 'line', { x1: 180, x2: 180, y1: 15, y2: 255, class: 'c-axis' });
  for (const tick of [-extent, extent]) { shape(svg, 'text', { x: x(tick), y: 157, 'text-anchor': 'middle' }, short(tick)); shape(svg, 'text', { x: 188, y: y(tick) + 5 }, short(tick)); }
  shape(svg, 'text', { x: 315, y: 280, 'text-anchor': 'end' }, 'Re(s) [s⁻¹]'); shape(svg, 'text', { x: 190, y: 15 }, 'Im(s) [s⁻¹]');
  for (const z of roots) { const px = x(z.re), py = y(z.im); shape(svg, 'path', { d: `M${px - 5},${py - 5}l10,10m0,-10l-10,10`, class: 'c-root' }); }
  const note = document.createElement('p'); note.className = 'c-small'; note.textContent = '× numerical roots; repeated roots may overlap. All three modes, including multiplicity, are listed below. The shaded half-plane is Re(s)<0; axis modes are excluded from strict stability.'; out.append(note); return out;
}
