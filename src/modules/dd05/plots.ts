import type { Desired, Model, Performance } from './math';
import { numberText as n } from './format';
const NS = 'http://www.w3.org/2000/svg', W = 680, H = 280, LEFT = 68, RIGHT = 20, TOP = 34, BOTTOM = 52;
function el(tag: string, attributes: Record<string, number | string>, text?: string) {
  const e = document.createElementNS(NS, tag); Object.entries(attributes).forEach(([key, value]) => e.setAttribute(key, String(value))); if (text !== undefined) e.textContent = text; return e;
}
function svg(label: string) { const e = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': label }); e.append(el('title', {}, label)); return e; }
export interface Trace { label: string; model: Model; result: Performance; matched: boolean }
export function polePlot(candidate: Model, desired: Desired, matched?: Model) {
  const chart = svg('All actual poles, desired pair and optional additional PID pole');
  const all = [...candidate.poles ?? [], ...matched?.poles ?? [], ...desired.pair, ...(desired.extra === null ? [] : [{ re: desired.extra, im: 0 }])];
  const extent = Math.max(1.25, ...all.map(z => 1.15 * Math.max(Math.abs(z.re), Math.abs(z.im)))), scale = (H - TOP - BOTTOM) / (2 * extent), cx = W / 2, cy = (TOP + H - BOTTOM) / 2;
  const x = (v: number) => cx + scale * v, y = (v: number) => cy - scale * v;
  chart.append(el('text', { x: LEFT, y: 18 }, '× candidate · + matched · ○ target pair · □ additional target; unit circle radius1'), el('line', { x1: x(-extent), x2: x(extent), y1: cy, y2: cy, class: 'ap-axis' }), el('line', { x1: cx, x2: cx, y1: y(-extent), y2: y(extent), class: 'ap-axis' }), el('circle', { cx, cy, r: scale, class: 'ap-unit' }), el('text', { x: x(1), y: cy + 18 }, '1'), el('text', { x: x(extent) + 5, y: cy }, 'Re z'), el('text', { x: cx + 8, y: TOP }, 'Im z'));
  desired.pair.forEach(z => chart.append(el('circle', { cx: x(z.re), cy: y(z.im), r: 7, class: 'ap-target' })));
  if (desired.extra !== null) chart.append(el('rect', { x: x(desired.extra) - 7, y: cy - 7, width: 14, height: 14, class: 'ap-target' }));
  candidate.poles?.forEach(z => chart.append(el('path', { d: `M${x(z.re) - 5},${y(z.im) - 5}l10,10 M${x(z.re) - 5},${y(z.im) + 5}l10,-10`, class: 'ap-candidate' })));
  matched?.poles?.forEach(z => chart.append(el('path', { d: `M${x(z.re) - 4},${y(z.im)}h8 M${x(z.re)},${y(z.im) - 4}v8`, class: 'ap-matched' })));
  return chart;
}
/** Exact first-order held-plant output at a display time; no linear interpolation. */
export function physicalAt(trace: Trace, time: number) {
  const { result, model } = trace, N = result.samples.length - 1;
  if (!Number.isFinite(time) || time < 0 || time > result.horizon) throw new Error('Inspect physical time between0 and the computed horizon.');
  if (time === result.horizon) return result.samples[N].output;
  const k = Math.max(0, Math.min(N - 1, Math.floor(time / model.settings.T))), sample = result.samples[k], elapsed = Math.max(0, Math.min(model.settings.T, time - k * model.settings.T));
  const ratio = elapsed / model.settings.plant.tau, a = Math.exp(-ratio), oneMinus = -Math.expm1(-ratio), held = model.settings.plant.gain * sample.control!;
  return ratio < .5 ? sample.output + oneMinus * (held - sample.output) : a * sample.output + oneMinus * held;
}
export function responsePlot(traces: Trace[], part: 'output' | 'control') {
  const chart = svg(part === 'output' ? 'Actual sampled output and reconstructed first-order held-plant response' : 'Actual zero-order-held controller output');
  const horizon = traces[0].result.horizon, values = traces.flatMap(t => t.result.samples.map(s => part === 'output' ? s.output : s.control ?? 0));
  const min = Math.min(0, ...values), max = Math.max(1e-3, ...values), pad = .08 * (max - min), bottom = min - pad, top = max + pad;
  const x = (v: number) => LEFT + (W - LEFT - RIGHT) * v / horizon, y = (v: number) => H - BOTTOM - (H - TOP - BOTTOM) * (v - bottom) / (top - bottom);
  for (let i = 0; i <= 4; i++) { const t = horizon * i / 4, v = bottom + (top - bottom) * i / 4; chart.append(el('line', { x1: x(t), x2: x(t), y1: TOP, y2: H - BOTTOM, class: 'ap-gridline' }), el('text', { x: x(t), y: H - BOTTOM + 19, 'text-anchor': 'middle' }, n(t)), el('text', { x: LEFT - 8, y: y(v) + 4, 'text-anchor': 'end' }, n(v))); }
  chart.append(el('text', { x: LEFT, y: 18 }, part === 'output' ? 'y: dashed/square candidate, solid/circle matched;401 reconstructed display times' : 'u held on each [kT,(k+1)T): dashed candidate, solid matched'), el('text', { x: (LEFT + W - RIGHT) / 2, y: H - 8, 'text-anchor': 'middle' }, 'Physical time t (s)'), el('line', { x1: LEFT, x2: W - RIGHT, y1: y(0), y2: y(0), class: 'ap-axis' }));
  traces.forEach(trace => {
    let path = '';
    if (part === 'output') for (let i = 0; i <= 400; i++) { const t = i === 400 ? horizon : horizon * i / 400; path += `${i ? 'L' : 'M'}${x(t)},${y(physicalAt(trace, t))} `; }
    else trace.result.samples.slice(0, -1).forEach((sample, k) => { path += `${k ? 'L' : 'M'}${x(sample.time)},${y(sample.control!)} L${x((k + 1) * trace.model.settings.T)},${y(sample.control!)} `; });
    chart.append(el('path', { d: path, class: trace.matched ? 'ap-matched' : 'ap-candidate', fill: 'none' }));
    if (part === 'output') {
      const N = trace.result.samples.length - 1;
      for (let i = 0; i <= Math.min(200, N); i++) {
        const sample = trace.result.samples[Math.round(i * N / Math.min(200, N))];
        chart.append(el(trace.matched ? 'circle' : 'rect', trace.matched ? { cx: x(sample.time), cy: y(sample.output), r: 2.5, class: 'ap-marker' } : { x: x(sample.time) - 2.5, y: y(sample.output) - 2.5, width: 5, height: 5, class: 'ap-target' }));
      }
    }
  });
  return chart;
}
