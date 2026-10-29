import { frequency, type FrequencyAnalysis, type Model, type Response } from './math';
import { number as n } from './format';
const NS = 'http://www.w3.org/2000/svg';
const W = 680, H = 270, L = 64, R = 22, TOP = 30, BOTTOM = 51;
type Attribute = string | number;
function node(tag: string, attributes: Record<string, Attribute>, text?: string) {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}
function chart(label: string) {
  const svg = node('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label }); svg.append(node('title', {}, label)); return svg;
}
function frame(svg: Element, xmax: number, ymin: number, ymax: number, xlabel: string, ylabel: string) {
  const x = (v: number) => L + (W - L - R) * v / xmax, y = (v: number) => H - BOTTOM - (H - TOP - BOTTOM) * (v - ymin) / (ymax - ymin);
  for (let i = 0; i <= 4; i++) {
    const xv = xmax * i / 4, yv = ymin + (ymax - ymin) * i / 4;
    svg.append(node('line', { x1: x(xv), x2: x(xv), y1: TOP, y2: H - BOTTOM, class: 'fq-gridline' }), node('text', { x: x(xv), y: H - BOTTOM + 19, 'text-anchor': 'middle' }, n(xv, 4)), node('text', { x: L - 8, y: y(yv) + 4, 'text-anchor': 'end' }, n(yv, 4)));
  }
  svg.append(node('line', { x1: L, x2: W - R, y1: H - BOTTOM, y2: H - BOTTOM, class: 'fq-axis' }), node('text', { x: (L + W - R) / 2, y: H - 8, 'text-anchor': 'middle' }, xlabel), node('text', { x: L, y: 17 }, ylabel));
  return { x, y };
}
export type Axis = 'angle' | 'omega' | 'hz' | 'warped';
export function frequencyPlot(model: Model, T: number, cursor: number, axis: Axis, part: 'db' | 'phase', analysis?: FrequencyAnalysis) {
  const isWarped = axis === 'warped', endpoint = isWarped ? .98 * Math.PI : Math.PI;
  const axisValue = (angle: number) => axis === 'angle' ? angle : axis === 'omega' ? angle / T : axis === 'hz' ? angle / (2 * Math.PI * T) : 2 * Math.tan(angle / 2) / T;
  const xmax = axisValue(endpoint), xlabel = axis === 'angle' ? 'Ω (rad/sample)' : axis === 'omega' ? 'ω = Ω/T (rad/s)' : axis === 'hz' ? 'f = Ω/(2πT) (Hz)' : 'ν = (2/T)tan(Ω/2) (rad/s); finite view to 0.98π';
  const svg = chart(part === 'db' ? 'Loop and closed-loop frequency magnitudes' : 'Loop and closed-loop principal phases');
  const minimum = part === 'db' ? -80 : -180, maximum = part === 'db' ? 80 : 180, { x, y } = frame(svg, xmax, minimum, maximum, xlabel, part === 'db' ? 'Magnitude (dB): solid L, dashed N/(D+N)' : 'Principal phase (degrees): solid L, dashed N/(D+N)');
  svg.append(node('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), class: 'fq-axis' }));
  for (const closed of [false, true]) {
    let path = '', previous: number | null = null;
    for (let i = 0; i <= 400; i++) {
      const xv = xmax * i / 400, angle = axis === 'warped' ? 2 * Math.atan(xv * T / 2) : endpoint * i / 400;
      const f = frequency({ numerator: model.numerator, denominator: closed ? model.closed : model.denominator }, angle, T), v = f[part];
      if (f.status !== 'finite' || v === null || !Number.isFinite(v)) { previous = null; continue; }
      const yy = Math.max(minimum, Math.min(maximum, v));
      path += `${previous === null || part === 'phase' && Math.abs(previous - v) > 180 ? 'M' : 'L'}${x(xv)},${y(yy)} `; previous = v;
    }
    svg.append(node('path', { d: path, class: closed ? 'fq-curve fq-closed' : 'fq-curve', fill: 'none' }));
  }
  if (cursor <= endpoint) svg.append(node('line', { x1: x(axisValue(cursor)), x2: x(axisValue(cursor)), y1: TOP, y2: H - BOTTOM, class: 'fq-cursor' }));
  if (analysis && part === 'db') for (const crossing of analysis.gain.points) if (crossing.angle <= endpoint) svg.append(node('circle', { cx: x(axisValue(crossing.angle)), cy: y(0), r: 4, class: 'fq-marker' }));
  return svg;
}
export function polePlot(model: Model, cursor: number) {
  const svg = chart('Full closed-loop poles, open-loop poles and unit-circle cursor');
  const extent = Math.max(1.25, ...model.poles.concat(model.openPoles).map(p => 1.15 * Math.max(Math.abs(p.re), Math.abs(p.im)))), size = H - TOP - BOTTOM, cx = W / 2, cy = (TOP + H - BOTTOM) / 2, scale = size / (2 * extent);
  const x = (v: number) => cx + scale * v, y = (v: number) => cy - scale * v;
  svg.append(node('text', { x: L, y: 17 }, '× full D+N poles · ○ open D poles · □ z cursor; unit circle radius1'), node('line', { x1: x(-extent), x2: x(extent), y1: cy, y2: cy, class: 'fq-axis' }), node('line', { x1: cx, x2: cx, y1: y(-extent), y2: y(extent), class: 'fq-axis' }), node('circle', { cx, cy, r: scale, class: 'fq-unit' }), node('text', { x: x(1), y: cy + 17 }, '1'), node('text', { x: x(extent) + 8, y: cy }, 'Re z'), node('text', { x: cx + 8, y: TOP }, 'Im z'));
  model.openPoles.forEach(p => svg.append(node('circle', { cx: x(p.re), cy: y(p.im), r: 5, class: 'fq-open-pole' })));
  model.poles.forEach(p => svg.append(node('path', { d: `M${x(p.re) - 5},${y(p.im) - 5}l10,10 M${x(p.re) - 5},${y(p.im) + 5}l10,-10`, class: 'fq-curve' })));
  svg.append(node('rect', { x: x(Math.cos(cursor)) - 4, y: y(Math.sin(cursor)) - 4, width: 8, height: 8, class: 'fq-marker' }));
  return svg;
}
export function responsePlot(response: Response) {
  const svg = chart('Zero-state unit-step output at actual sample times');
  const min = Math.min(0, ...response.values, response.limit ?? 0), max = Math.max(1e-3, ...response.values, response.limit ?? 0), gap = (max - min) * .08;
  const { x, y } = frame(svg, response.lastSample, min - gap, max + gap, 't = kT (s)', 'Sampled y[k]; at most201 markers; no intersample reconstruction');
  svg.append(node('line', { x1: L, x2: W - R, y1: y(0), y2: y(0), class: 'fq-axis' }));
  if (response.limit !== null) svg.append(node('line', { x1: L, x2: W - R, y1: y(response.limit), y2: y(response.limit), class: 'fq-cursor' }));
  const count = response.values.length - 1;
  for (let i = 0; i <= Math.min(200, count); i++) { const k = Math.round(i * count / Math.min(200, count)); svg.append(node('circle', { cx: x(k * response.T), cy: y(response.values[k]), r: 2.7, class: 'fq-marker' })); }
  return svg;
}
