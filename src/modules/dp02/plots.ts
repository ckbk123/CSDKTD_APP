import { mapPole, modeSamples, type Pole } from './math';

const NS = 'http://www.w3.org/2000/svg';
function el(tag: string, attributes: Record<string, string | number>, text?: string): SVGElement {
  const element = document.createElementNS(NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}
function svg(label: string, height = 330): SVGElement {
  const element = el('svg', { viewBox: `0 0 400 ${height}`, role: 'img', 'aria-label': label });
  element.append(el('title', {}, label));
  return element;
}
export function fmt(value: number, digits = 6): string {
  if (Math.abs(value) < 1e-12) return '0';
  return Number(value.toPrecision(digits)).toString();
}
export function complex(pole: Pole): string {
  return `${fmt(pole.real)} ${pole.imag < 0 ? '−' : '+'} ${fmt(Math.abs(pole.imag))}j`;
}
function cross(x: number, y: number, className = 'dp-cross'): SVGElement {
  return el('path', { d: `M${x - 5},${y - 5}l10,10m-10,0l10,-10`, class: className });
}
function plane(label: string, extentX: number, extentY: number, xLabel: string, yLabel: string) {
  const chart = svg(label);
  const x = (value: number) => 200 + value / extentX * 135;
  const y = (value: number) => 160 - value / extentY * 135;
  chart.append(el('path', { d: 'M50,160H350M200,25V295', class: 'dp-axis' }));
  chart.append(el('text', { x: 390, y: 183, 'text-anchor': 'end' }, xLabel), el('text', { x: 204, y: 16 }, yLabel));
  for (const value of [-1, 1]) {
    chart.append(el('text', { x: x(value * extentX), y: 178, 'text-anchor': 'middle' }, fmt(value * extentX, 3)));
    chart.append(el('text', { x: 195, y: y(value * extentY) + 4, 'text-anchor': 'end' }, fmt(value * extentY, 3)));
  }
  chart.append(el('text', { x: 206, y: 176 }, '0'));
  return { chart, x, y };
}

export function polePlanes(pole: Pole, period: number, reference: number, inverse: Pole): HTMLElement {
  const row = document.createElement('div'); row.className = 'dp-planes';
  const target = mapPole(pole, period), previous = mapPole(pole, reference);
  const sx = Math.max(1, Math.abs(pole.real) * 1.3, Math.abs(inverse.real) * 1.3);
  const sy = Math.max(1, Math.abs(pole.imag) * 1.3, Math.abs(inverse.imag) * 1.3);
  const s = plane('Continuous pole and conjugate; diamond is the selected inverse branch', sx, sy, 'σ (s⁻¹)', 'ω (rad/s)');
  s.chart.append(cross(s.x(pole.real), s.y(pole.imag)));
  if (pole.imag !== 0) s.chart.append(cross(s.x(pole.real), s.y(-pole.imag)));
  const ix = s.x(inverse.real), iy = s.y(inverse.imag);
  s.chart.append(el('path', { d: `M${ix},${iy - 9}l9,9l-9,9l-9,-9Z`, class: 'dp-inverse' }));
  const extent = Math.max(1.2, target.radius * 1.2, previous.radius * 1.2);
  const z = plane('Discrete pole and conjugate, unit circle, target radius and angle', extent, extent, 'Re z', 'Im z');
  z.chart.append(el('circle', { cx: 200, cy: 160, r: 135 / extent, class: 'dp-circle' }));
  z.chart.append(el('circle', { cx: 200, cy: 160, r: previous.radius * 135 / extent, class: 'dp-reference' }));
  z.chart.append(el('path', { d: `M200,160L${z.x(target.real)},${z.y(target.imag)}`, class: 'dp-radius' }));
  const steps = 32;
  const arc = Array.from({ length: steps + 1 }, (_, i) => {
    const a = target.angle * i / steps;
    return `${i ? 'L' : 'M'}${200 + 28 * Math.cos(a)},${160 - 28 * Math.sin(a)}`;
  }).join('');
  z.chart.append(el('path', { d: arc, class: 'dp-radius' }));
  for (const sign of new Set([1, target.imag === 0 ? 1 : -1])) z.chart.append(cross(z.x(target.real), z.y(sign * target.imag)));
  for (const [title, chart, caption] of [
    ['s plane', s.chart, '× entered pole and conjugate · ◇ selected inverse branch. Each axis scales independently.'],
    ['z plane', z.chart, '× mapped poles · solid circle |z|=1 · dashed circle at reference T · ray r and arc θ. Equal axis scales.'],
  ] as const) {
    const figure = document.createElement('figure');
    const heading = document.createElement('h4'); heading.textContent = title;
    const note = document.createElement('figcaption'); note.textContent = caption;
    figure.append(heading, chart, note); row.append(figure);
  }
  return row;
}

export function sequencePlot(pole: Pole, period: number, intervals: number): HTMLElement {
  const samples = modeSamples(pole, period, intervals);
  const scale = Math.max(1, ...samples.map(p => p.envelope));
  const chart = svg('Free real modal samples with positive and negative exponential envelopes; no intersample interpolation', 270);
  const x = (k: number) => 55 + k / intervals * 320;
  const y = (v: number) => 125 - v / scale * 80;
  chart.append(el('path', { d: 'M55,35V215M55,125H375', class: 'dp-axis' }));
  for (const sign of [-1, 1]) chart.append(el('path', {
    d: samples.map(p => `${p.k ? 'L' : 'M'}${x(p.k)},${y(sign * p.envelope)}`).join(''), class: 'dp-envelope',
  }));
  for (const p of samples) {
    chart.append(el('line', { x1: x(p.k), x2: x(p.k), y1: 125, y2: y(p.value), class: 'dp-stem' }));
    chart.append(el('circle', { cx: x(p.k), cy: y(p.value), r: intervals > 60 ? 1.6 : 2.5, class: 'dp-sample' }));
  }
  for (const k of new Set([0, Math.floor(intervals / 2), intervals])) chart.append(
    el('text', { x: x(k), y: 230, 'text-anchor': 'middle' }, `${k}`),
    el('text', { x: x(k), y: 247, 'text-anchor': 'middle' }, `${fmt(k * period, 4)}s`),
  );
  chart.append(el('text', { x: 8, y: 25 }, 'amplitude'), el('text', { x: 390, y: 266, 'text-anchor': 'end' }, 'sample k / time kT'));
  for (const v of [-scale, 0, scale]) chart.append(el('text', { x: 49, y: y(v) + 4, 'text-anchor': 'end' }, fmt(v, 3)));
  const figure = document.createElement('figure'); figure.append(chart);
  return figure;
}
