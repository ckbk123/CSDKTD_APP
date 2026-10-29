import { frequency, standardStep, type Estimate, type Loop, type StepResult } from './performance';
import { norm } from './spectral';
export const fmt = (n: number) => Number(n.toPrecision(7)).toString();
export interface Comparison { readonly loop: Loop; readonly step: StepResult; readonly estimate?: Estimate; readonly name: string }
function chart(label: string, width = 600, height = 280) {
  const ns = 'http://www.w3.org/2000/svg', region = document.createElement('div'), svg = document.createElementNS(ns, 'svg');
  region.className = 'cf05-scroll'; region.tabIndex = 0; region.setAttribute('role', 'region'); region.setAttribute('aria-label', `${label}. Use arrow keys to scroll.`);
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); region.append(svg);
  const shape = (tag: string, attrs: Record<string, string | number>, text = '') => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v)); e.textContent = text; svg.append(e); return e; };
  function line(points: readonly ({ x: number; y: number } | undefined)[], cls: string) {
    let path = '', gap = true; for (const p of points) { if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)) { gap = true; continue; } path += `${gap ? 'M' : 'L'}${p.x},${p.y}`; gap = false; } shape('path', { d: path, class: `cf05-line ${cls}` });
  }
  return { region, shape, line };
}
export function stepPlot(current: Comparison, previous: Comparison | undefined, cursorTime: number): HTMLElement {
  const p = chart('Full step response, equivalent second-order estimate and retained comparison'), horizon = Math.max(current.step.points.at(-1)!.t, previous?.step.points.at(-1)!.t ?? 0);
  const estimateValues = current.estimate && current.step.final !== undefined ? Array.from({ length: 601 }, (_, i) => current.step.final! * standardStep(current.estimate!, current.step.points.at(-1)!.t * i / 600)) : [];
  const values = [0, 1, ...current.step.points.map(s => s.y), ...(previous?.step.points.map(s => s.y) ?? []), ...estimateValues];
  const minimum = Math.min(...values), maximum = Math.max(...values), padding = .1 * (maximum - minimum || 1), low = minimum - padding, high = maximum + padding;
  const x = (t: number) => 60 + 490 * t / horizon, y = (v: number) => 225 - 180 * (v - low) / (high - low);
  p.shape('path', { d: 'M60,35V225H555', class: 'cf05-axis' });
  for (let i = 0; i <= 4; i++) { const t = horizon * i / 4; p.shape('text', { x: x(t), y: 245 }, fmt(t)); const v = low + (high - low) * i / 4; p.shape('text', { x: 4, y: y(v) }, fmt(v)); }
  p.shape('text', { x: 430, y: 270 }, 'time t (s)'); p.shape('text', { x: 65, y: 20 }, 'output y (unit step)');
  if (current.step.final !== undefined) for (const sign of [-1, 1]) { const v = current.step.final + sign * .02 * Math.abs(current.step.final); p.shape('line', { x1: 60, x2: 550, y1: y(v), y2: y(v), class: 'cf05-band' }); }
  function samples(c: Comparison, cls: string) { const stride = Math.ceil(c.step.points.length / 1200); p.line(c.step.points.filter((_, i, a) => i % stride === 0 || i === a.length - 1).map(s => ({ x: x(s.t), y: y(s.y) })), cls); }
  if (previous) samples(previous, 'cf05-previous');
  if (current.estimate && current.step.final !== undefined) p.line(Array.from({ length: 601 }, (_, i) => { const t = current.step.points.at(-1)!.t * i / 600; return { x: x(t), y: y(current.step.final! * standardStep(current.estimate!, t)) }; }), 'cf05-estimate');
  samples(current, 'cf05-actual');
  const at = current.step.points.reduce((best, s) => Math.abs(s.t - cursorTime) < Math.abs(best.t - cursorTime) ? s : best, current.step.points[0]);
  p.shape('circle', { cx: x(at.t), cy: y(at.y), r: 4, class: 'cf05-point' }); return p.region;
}
export function frequencyPlot(loop: Loop, frequencies: readonly number[], dc: number | undefined): HTMLElement {
  const p = chart('Loop magnitude and normalized closed-loop magnitude'), valid = frequencies.filter(w => w > 0), low = Math.min(.01, ...valid.map(w => w / 30)), high = Math.max(100, ...valid.map(w => w * 30));
  const samples = Array.from({ length: 301 }, (_, i) => { const w = low * (high / low) ** (i / 300), l = frequency(loop.n, loop.d, w), t = frequency(loop.n, loop.characteristic, w); return { w, l: l && norm(l) > 0 ? 20 * Math.log10(norm(l)) : undefined, t: t && dc ? 20 * Math.log10(norm(t) / Math.abs(dc)) : undefined }; });
  const min = -60, max = 40, x = (w: number) => 60 + 490 * Math.log(w / low) / Math.log(high / low), y = (db: number) => 225 - 180 * (db - min) / (max - min);
  p.shape('path', { d: 'M60,35V225H555', class: 'cf05-axis' });
  for (const v of [-60, -40, -20, 0, 20, 40]) p.shape('text', { x: 5, y: y(v) }, String(v));
  for (let i = 0; i <= 4; i++) { const w = low * (high / low) ** (i / 4); p.shape('text', { x: x(w) - 8, y: 245 }, fmt(w)); }
  p.shape('text', { x: 65, y: 20 }, 'magnitude (dB)'); p.shape('text', { x: 380, y: 270 }, 'ω (rad/s), log axis');
  for (const db of [0, 20 * Math.log10(Math.SQRT1_2)]) p.shape('line', { x1: 60, x2: 550, y1: y(db), y2: y(db), class: 'cf05-band' });
  for (const kind of ['l', 't'] as const) p.line(samples.map(s => { const v = s[kind]; return v === undefined || !Number.isFinite(v) || v < min || v > max ? undefined : { x: x(s.w), y: y(v) }; }), kind === 'l' ? 'cf05-actual' : 'cf05-estimate');
  return p.region;
}
