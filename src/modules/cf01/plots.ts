import type { Measurement, Targets } from './measure';
import { normalizedAt, type Complex } from './response';
import { format as f } from './input';
const ns = 'http://www.w3.org/2000/svg';
const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = '') => { const n = document.createElement(tag); n.textContent = text; n.className = cls; return n; };
const shape = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => { const n = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) n.setAttribute(key, String(value)); return n; };
function chart(caption: string, label: string, square: boolean) {
  const figure = node('figure', '', 'cf1-chart'), frame = node('div', '', 'cf1-axes'), y = node('div', '', 'cf1-y-axis'), stage = node('div', '', square ? 'cf1-stage cf1-square' : 'cf1-stage'), x = node('div', '', 'cf1-x-axis');
  const svg = shape('svg', { viewBox: square ? '0 0 300 300' : '0 0 600 220', role: 'img', 'aria-label': label, preserveAspectRatio: square ? 'xMidYMid meet' : 'none' });
  const description = document.createElementNS(ns, 'desc'); description.textContent = label; svg.append(description);
  figure.append(node('figcaption', caption), frame); stage.append(svg); frame.append(y, stage, x);
  return { figure, frame, y, x, stage, svg, add: <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>) => { const n = shape(tag, attrs); svg.append(n); return n; } };
}
function ticks(host: HTMLElement, values: number[]) { for (const value of values) host.append(node('span', f(value))); }
const shown = (m: Measurement) => m.samples.filter((_, i) => i % Math.max(1, Math.floor(m.samples.length / 1000)) === 0 || i === m.samples.length - 1);
export interface ResponseDrawing { element: HTMLElement; cursor(time: number): void; fromEvent(clientX: number): number | undefined }
export function responsePlot(pair: Measurement, full: Measurement, time: number, revealed = false): ResponseDrawing {
  const p = chart('Unit-step response · normalized output y/y∞', 'Full chosen response solid; target pair dashed. Time in seconds, output divided by its positive final value. Lines join numerical drawing points.', false);
  const values = [...pair.samples, ...full.samples].map(v => v.value), band = full.band / 100, low = Math.min(0, ...values, 1 - band), high = Math.max(1 + band, ...values), span = high - low;
  const min = low - .05 * span, max = high + .05 * span, X = (t: number) => 12 + 576 * t / full.horizon, Y = (v: number) => 208 - 196 * (v - min) / (max - min);
  ticks(p.y, [max, (min + max) / 2, min]); ticks(p.x, [0, full.horizon / 2, full.horizon]); p.frame.append(node('p', 'Time t (s)', 'cf1-axis-title'));
  p.add('rect', { x: 12, y: Y(1 + band), width: 576, height: Y(1 - band) - Y(1 + band), class: 'cf1-area' });
  for (const value of [min, (min + max) / 2, max]) p.add('line', { x1: 12, x2: 588, y1: Y(value), y2: Y(value), class: 'cf1-grid', 'vector-effect': 'non-scaling-stroke' });
  p.add('line', { x1: 12, x2: 588, y1: Y(1), y2: Y(1), class: 'cf1-reference', 'vector-effect': 'non-scaling-stroke' });
  for (const [m, cls] of [[pair, 'pair'], [full, 'full']] as const) p.add('path', { d: shown(m).map((v, i) => (i ? 'L' : 'M') + X(v.t) + ',' + Y(v.value)).join(' '), class: 'cf1-line cf1-' + cls, 'vector-effect': 'non-scaling-stroke' });
  if (revealed) for (const [t, title] of [[full.riseStart, 'rise start'], [full.riseEnd, 'rise end'], [full.peakTime, 'detected peak'], [full.settlingTime, 'established settling']] as const) {
    if (t === undefined) continue;
    const n = p.add('circle', { cx: X(t), cy: Y(normalizedAt(full.response, t).value), r: 4, class: 'cf1-marker', 'data-measurement': title }); const text = document.createElementNS(ns, 'title'); text.textContent = title + ' at ' + f(t) + ' s'; n.append(text);
  }
  const line = p.add('line', { x1: X(time), x2: X(time), y1: 12, y2: 208, class: 'cf1-cursor', 'vector-effect': 'non-scaling-stroke' });
  function cursor(t: number) { line.setAttribute('x1', String(X(t))); line.setAttribute('x2', String(X(t))); }
  return { element: p.figure, cursor, fromEvent(clientX) { const box = p.svg.getBoundingClientRect(); if (!box.width || !Number.isFinite(clientX)) return; return Math.max(0, Math.min(full.horizon, ((clientX - box.left) / box.width * 600 - 12) * full.horizon / 576)); } };
}
type Vertex = [number, number];
function clip(poly: Vertex[], value: (v: Vertex) => number): Vertex[] {
  const out: Vertex[] = [];
  for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], fa = value(a), fb = value(b); if (fa <= 0) out.push(a); if ((fa <= 0) !== (fb <= 0)) { const t = fa / (fa - fb); out.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]); } }
  return out;
}
export type Handle = 'pair-upper' | 'pair-lower' | 'pole' | 'zero';
export interface PoleWindow { extent: number }
export const fitPoles = (full: Measurement, targets: Targets): PoleWindow => ({ extent: 1.2 * Math.max(2, targets.decayMinimum, ...full.response.poles.flatMap(p => [Math.abs(p.re), Math.abs(p.im)]), Math.abs(full.response.model.zero ?? 0)) });
export interface PoleDrawing { element: HTMLElement; fromEvent(clientX: number, clientY: number): Complex | undefined; clipped: boolean }
export function polePlot(full: Measurement, targets: Targets, window = fitPoles(full, targets)): PoleDrawing {
  const p = chart('Pole region · guideline, checked by the full response', 'Equal-unit s-plane. Crosses retain every denominator mode, ring marks the optional zero. Shading is a damping/decay guideline, not proof of full-model performance.', true), r = full.response, extent = window.extent;
  const X = (v: number) => 150 + 138 * v / extent, Y = (v: number) => 150 - 138 * v / extent;
  ticks(p.y, [extent, 0, -extent]); ticks(p.x, [-extent, 0, extent]); p.frame.append(node('p', 'Real σ (s⁻¹) · vertical imaginary ω (s⁻¹)', 'cf1-axis-title'));
  const tangent = Math.tan(Math.acos(targets.dampingMinimum)); let polygon: Vertex[] = [[-extent, -extent], [extent, -extent], [extent, extent], [-extent, extent]];
  for (const boundary of [(v: Vertex) => v[0] + targets.decayMinimum, (v: Vertex) => v[1] + tangent * v[0], (v: Vertex) => -v[1] + tangent * v[0]]) polygon = clip(polygon, boundary);
  if (polygon.length) p.add('polygon', { points: polygon.map(v => X(v[0]) + ',' + Y(v[1])).join(' '), class: 'cf1-area' });
  for (const value of [-extent, 0, extent]) { p.add('line', { x1: X(value), x2: X(value), y1: 12, y2: 288, class: value === 0 ? 'cf1-reference' : 'cf1-grid' }); p.add('line', { x1: 12, x2: 288, y1: Y(value), y2: Y(value), class: value === 0 ? 'cf1-reference' : 'cf1-grid' }); }
  if (targets.decayMinimum <= extent) p.add('line', { x1: X(-targets.decayMinimum), x2: X(-targets.decayMinimum), y1: 12, y2: 288, class: 'cf1-cursor' });
  if (targets.dampingMinimum === 1 && targets.decayMinimum <= extent) p.add('line', { x1: 12, x2: X(-targets.decayMinimum), y1: Y(0), y2: Y(0), class: 'cf1-line cf1-full' });
  let clipped = false;
  function handle(kind: Handle, value: Complex, text: string) {
    if (Math.abs(value.re) > extent || Math.abs(value.im) > extent) return;
    const b = node('button', '', 'cf1-pole-handle'); b.type = 'button'; b.dataset.handle = kind; b.setAttribute('aria-label', text); b.title = text; b.style.left = X(value.re) / 3 + '%'; b.style.top = Y(value.im) / 3 + '%'; p.stage.append(b);
  }
  r.poles.forEach((value, i) => {
    if (Math.abs(value.re) > extent || Math.abs(value.im) > extent) { clipped = true; return; }
    const x = X(value.re), y = Y(value.im); p.add('path', { d: 'M' + (x - 5) + ',' + (y - 5) + 'L' + (x + 5) + ',' + (y + 5) + 'M' + (x - 5) + ',' + (y + 5) + 'L' + (x + 5) + ',' + (y - 5), class: 'cf1-line cf1-' + (i < 2 ? 'full' : 'pair'), 'vector-effect': 'non-scaling-stroke' });
    if (i < 2 && r.damping < 1 && value.im !== 0) handle(value.im > 0 ? 'pair-upper' : 'pair-lower', value, 'Move target conjugate pair from its ' + (value.im > 0 ? 'upper' : 'lower') + ' pole');
    if (i === 2) handle('pole', value, 'Move added stable real pole');
  });
  if (r.model.zero !== undefined) { const value = { re: -r.model.zero, im: 0 }; if (Math.abs(value.re) <= extent) { p.add('circle', { cx: X(value.re), cy: Y(0), r: 6, class: 'cf1-zero' }); handle('zero', value, 'Move added real zero'); } else clipped = true; }
  const list = node('p', 'Retained poles (s⁻¹): ' + r.poles.map(v => f(v.re) + (v.im ? (v.im < 0 ? ' − j' : ' + j') + f(Math.abs(v.im)) : '')).join('; ') + (r.model.zero !== undefined ? '. Zero: ' + f(-r.model.zero) + '.' : '.'), 'cf1-muted'); p.figure.append(list);
  if (r.damping >= 1) p.figure.append(node('p', 'Critical and overdamped real pairs use the full ζ and ωn controls above the response.', 'cf1-muted'));
  if (clipped) p.figure.append(node('p', 'Some poles or the zero are outside the fixed view. All remain listed; use Fit pole view.', 'cf1-muted'));
  return { element: p.figure, clipped, fromEvent(clientX, clientY) { const box = p.svg.getBoundingClientRect(); if (!box.width || !box.height || !Number.isFinite(clientX) || !Number.isFinite(clientY)) return; const scale = Math.min(box.width / 300, box.height / 300), left = (box.width - 300 * scale) / 2, top = (box.height - 300 * scale) / 2; return { re: ((clientX - box.left - left) / scale - 150) * extent / 138, im: (150 - (clientY - box.top - top) / scale) * extent / 138 }; } };
}
