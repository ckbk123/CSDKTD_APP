import type { Design, model } from './model';
import type { Metrics } from './response';
type Model = ReturnType<typeof model>;
const NS = 'http://www.w3.org/2000/svg';
function svg(label: string, height = 350) { const el = document.createElementNS(NS, 'svg'); el.setAttribute('viewBox', `0 0 820 ${height}`); el.setAttribute('role', 'img'); el.setAttribute('aria-label', label); return el; }
function item(parent: SVGElement, tag: string, attrs: Record<string, string | number>, value?: string) { const el = document.createElementNS(NS, tag); for (const [key, v] of Object.entries(attrs)) el.setAttribute(key, String(v)); if (value) el.textContent = value; parent.append(el); return el; }
const line = (s: SVGElement, x: number, y: number, x2: number, y2: number, cls = '') => item(s, 'line', { x1: x, y1: y, x2, y2, class: cls });
function frame(s: SVGElement, xlabel: string, ylabel: string) { item(s, 'text', { x: 440, y: 337, 'text-anchor': 'middle' }, xlabel); item(s, 'text', { x: 18, y: 165, transform: 'rotate(-90 18 165)', 'text-anchor': 'middle' }, ylabel); }
export function transientPlot(base: Metrics | undefined, full: Metrics | undefined, horizon: number, band: number, active: boolean): SVGElement | HTMLElement {
  if (!base && !full) { const p = document.createElement('p'); p.textContent = 'Response measurement is unavailable for this horizon or conditioning case.'; return p; }
  const s = svg('Computed unit-step response: dashed proportional reference, solid chosen full loop; time in seconds, normalized output.');
  const values = [...(base?.values ?? []), ...(full?.values ?? []), 0, 1 + band], lo = Math.min(...values), hi = Math.max(...values), span = Math.max(.2, hi - lo), minimum = lo - .08 * span, maximum = hi + .1 * span;
  const x = (t: number) => 85 + 680 * t / horizon, y = (v: number) => 285 - 250 * (v - minimum) / (maximum - minimum);
  item(s, 'rect', { x: 85, y: y(1 + band), width: 680, height: y(1 - band) - y(1 + band), class: 'cd03-band' });
  for (let i = 0; i <= 5; i++) { const t = horizon * i / 5, v = minimum + (maximum - minimum) * i / 5; line(s, x(t), 285, x(t), 290); item(s, 'text', { x: x(t), y: 310, 'text-anchor': 'middle' }, Number(t.toPrecision(4)).toString()); line(s, 80, y(v), 765, y(v), 'cd03-grid'); item(s, 'text', { x: 75, y: y(v) + 4, 'text-anchor': 'end' }, Number(v.toPrecision(3)).toString()); }
  line(s, 85, 35, 85, 285); line(s, 85, 285, 765, 285);
  for (const [m, cls] of [[base, 'cd03-base'], [full, 'cd03-full']] as const) if (m) {
    item(s, 'path', { d: m.times.map((t, i) => `${i ? 'L' : 'M'}${x(t).toFixed(3)},${y(m.values[i]).toFixed(3)}`).join(' '), class: cls });
  }
  const chosen = active ? full : base;
  if (chosen) {
    item(s, 'circle', { cx: x(chosen.peakTime), cy: y(chosen.peak), r: 4, class: 'cd03-point' });
    if (chosen.settling !== undefined) { line(s, x(chosen.settling), 35, x(chosen.settling), 285, 'cd03-marker'); item(s, 'text', { x: Math.min(710, x(chosen.settling) + 5), y: 26 }, 'settling'); }
  }
  frame(s, 'Time t (s)', 'Unit-step output y (dimensionless)'); return s;
}
export function placement(d: Design, m: Model): SVGElement {
  const s = svg('Magnified lag pole and zero on the real axis. The chosen lag pole is nearer the origin. Full closed-loop poles are listed separately.', 190);
  const span = Math.max(.02, d.z * 1.25), x = (v: number) => 80 + 680 * (v + span) / (span * 1.1), y = 90;
  line(s, 80, y, 760, y);
  for (let i = 0; i <= 4; i++) { const v = -span + span * 1.1 * i / 4; line(s, x(v), y - 4, x(v), y + 4); item(s, 'text', { x: x(v), y: y + 30, 'text-anchor': 'middle' }, Number(v.toPrecision(4)).toString()); }
  item(s, 'circle', { cx: x(-d.z), cy: y, r: 8, class: 'cd03-zero' }); item(s, 'text', { x: x(-d.z), y: y - 30, 'text-anchor': 'middle' }, `zero −z = ${-d.z}`);
  const px = x(-d.p); line(s, px - 7, y - 7, px + 7, y + 7, 'cd03-full'); line(s, px - 7, y + 7, px + 7, y - 7, 'cd03-full'); item(s, 'text', { x: px, y: y + 58, 'text-anchor': 'middle' }, `pole −p = ${-d.p}`);
  item(s, 'text', { x: 410, y: 181, 'text-anchor': 'middle' }, `Real part (s⁻¹); ${d.lag ? 'active' : 'draft'} z/p = ${Number((d.z / d.p).toPrecision(6))}; applied accuracy ratio ${Number(m.beta.toPrecision(6))}`); return s;
}
export function polePlot(d: Design, m: Model): SVGElement {
  const s = svg('All full closed-loop poles and vectors from the chosen lag pole and zero to the original upper reference pole.');
  const points = [...m.fullRoots, ...m.baselineRoots, ...(d.lag ? [{ re: -d.z, im: 0 }, { re: -d.p, im: 0 }] : []), { re: 0, im: 0 }];
  const reMin = Math.min(...points.map(p => p.re)), reMax = Math.max(...points.map(p => p.re)), imMax = Math.max(.2, ...points.map(p => Math.abs(p.im))), reSpan = Math.max(.2, reMax - reMin);
  const x = (re: number) => 100 + 620 * (re - reMin + .08 * reSpan) / (1.16 * reSpan), y = (im: number) => 160 - 110 * im / imMax;
  line(s, 85, y(0), 765, y(0)); line(s, x(0), 35, x(0), 285);
  for (let i = 0; i <= 4; i++) { const v = reMin + reSpan * i / 4; item(s, 'text', { x: x(v), y: 307, 'text-anchor': 'middle' }, Number(v.toPrecision(3)).toString()); }
  for (const sign of [-1, 1]) item(s, 'text', { x: 74, y: y(sign * imMax) + 4, 'text-anchor': 'end' }, Number((sign * imMax).toPrecision(3)).toString());
  if (d.lag) {
    for (const v of [-d.z, -d.p]) line(s, x(v), y(0), x(m.s0.re), y(m.s0.im), 'cd03-vector');
    item(s, 'circle', { cx: x(-d.z), cy: y(0), r: 7, class: 'cd03-zero' }); item(s, 'text', { x: x(-d.p), y: y(0) + 5, 'text-anchor': 'middle' }, '+');
  }
  for (const p of m.baselineRoots) item(s, 'path', { d: `M${x(p.re)},${y(p.im) - 9}l-8,15h16z`, class: 'cd03-reference' });
  for (const p of m.fullRoots) { line(s, x(p.re) - 6, y(p.im) - 6, x(p.re) + 6, y(p.im) + 6, 'cd03-full'); line(s, x(p.re) - 6, y(p.im) + 6, x(p.re) + 6, y(p.im) - 6, 'cd03-full'); }
  frame(s, 'Real part (s⁻¹)', 'Imaginary part (rad/s)'); return s;
}
