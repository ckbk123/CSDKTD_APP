import { formatNumber as fmt, inverse } from './math';
import type { Checked } from './session';
export interface Limits { state: [number, number]; output: [number, number]; plane: number }
const ns = 'http://www.w3.org/2000/svg';
function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text = '') {
  const result = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) result.setAttribute(key, String(value)); result.textContent = text; return result;
}
function extent(values: readonly number[]): [number, number] { let low = Math.min(0, ...values), high = Math.max(0, ...values); const pad = high === low ? 1 : (high - low) * .12; low -= pad; high += pad; return [low, high]; }
function axis(value: number) { return value !== 0 && (Math.abs(value) < .001 || Math.abs(value) >= 1e4) ? value.toExponential(2) : Number(value.toPrecision(3)).toString(); }
export function fit(checked: Checked, selected: number, pair: readonly [number, number]): Limits {
  const n = checked.experiment.model.A.length, i = Math.min(selected, Math.max(0, n - 1));
  const inv = inverse(checked.experiment.T).matrix;
  return { state: extent(n ? [...checked.original.map(p => p.state[i]), ...checked.changed.map(p => p.state[i])] : [0]),
    output: extent([...checked.original.map(p => p.output), ...checked.changed.map(p => p.output)]),
    plane: Math.max(2.5, ...[...checked.original, ...checked.changed].flatMap(p => pair.map(i => Math.abs(p.state[i] ?? 0) * 1.15)), ...pair.flatMap(i => pair.map(j => Math.abs(inv[i]?.[j] ?? 0) * 1.15))) };
}
function frame(width: number, height: number, label: string) { return node('svg', { viewBox: `0 0 ${width} ${height}`, role: 'img', 'aria-label': label, 'data-outer': 'true' }); }
function text(svg: SVGSVGElement, value: string, x: number, y: number, anchor = 'start') { svg.append(node('text', { x, y, 'text-anchor': anchor, 'font-size': 12 }, value)); }
function curve(svg: SVGSVGElement, points: readonly [number, number][], dashed: boolean, clip: string) {
  svg.append(node('path', { d: points.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '), fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, ...(dashed ? { 'stroke-dasharray': '6 4' } : {}), 'clip-path': `url(#${clip})` }));
}
function clipping(svg: SVGSVGElement, id: string, x: number, y: number, width: number, height: number) { const defs = node('defs'), clip = node('clipPath', { id }); clip.append(node('rect', { x, y, width, height })); defs.append(clip); svg.append(defs); }
function timeline(checked: Checked, index: number, values: readonly number[][], width: number, limits: [number, number], id: string, label: string) {
  const svg = frame(width, 225, label), left = 70, right = width - 15, top = 28, bottom = 183;
  const x = (k: number) => left + (right - left) * k / (checked.original.length - 1), y = (v: number) => bottom - (bottom - top) * (v - limits[0]) / (limits[1] - limits[0]);
  clipping(svg, id, left, top, right - left, bottom - top);
  svg.append(node('path', { d: `M${left} ${top}V${bottom}H${right}`, fill: 'none', stroke: 'currentColor', opacity: .4 }));
  values.forEach((series, i) => curve(svg, series.map((v, k) => [x(k), y(v)]), i === 1, id));
  svg.append(node('path', { d: `M${x(index)} ${top}V${bottom}`, stroke: 'currentColor', 'stroke-dasharray': '2 3', opacity: .5 }));
  values.forEach((series, i) => { const value = series[index]; if (value >= limits[0] && value <= limits[1]) svg.append(node('circle', { cx: x(index), cy: y(value), r: i ? 5 : 3, fill: i ? 'var(--surface)' : 'currentColor', stroke: 'currentColor' })); });
  text(svg, axis(limits[1]), left - 8, top + 4, 'end'); text(svg, axis(limits[0]), left - 8, bottom + 4, 'end');
  text(svg, width < 260 ? 'Units' : id.endsWith('state') ? 'Coordinate units' : 'Output units', left, 16);
  text(svg, '0', left, 203); text(svg, fmt(checked.experiment.horizon), right, 203, 'end'); text(svg, 'Time t (s)', (left + right) / 2, 220, 'middle');
  const below = values.flat().some(v => v < limits[0]), above = values.flat().some(v => v > limits[1]);
  if (below || above) text(svg, `${below ? '↓' : ''}${above ? '↑' : ''} Fit`, right, 16, 'end');
  return svg;
}
function plane(checked: Checked, index: number, pair: readonly [number, number], width: number, bound: number, mapped: boolean, handles: boolean) {
  const size = Math.min(width - 72, 240), left = (width - size) / 2, top = 28, mid = left + size / 2, centerY = top + size / 2;
  const x = (v: number) => mid + v * size / (2 * bound), y = (v: number) => centerY - v * size / (2 * bound);
  const [i, j] = pair, symbol = mapped ? 'z' : 'x', label = `${mapped ? 'Transformed' : 'Original'} ${symbol}${i + 1}, ${symbol}${j + 1} ${checked.experiment.model.A.length > 2 ? 'projection' : 'coordinate plane'}`;
  const svg = frame(width, size + 68, label); svg.dataset.plane = mapped ? 'z' : 'x'; svg.dataset.bound = String(bound); svg.dataset.left = String(left); svg.dataset.top = String(top); svg.dataset.size = String(size);
  clipping(svg, `cr03-explore-plane-${symbol}`, left, top, size, size);
  svg.append(node('path', { d: `M${left} ${centerY}H${left + size}M${mid} ${top}V${top + size}`, stroke: 'currentColor', opacity: .35 }));
  text(svg, `${symbol}${i + 1}`, left + size, centerY - 6, 'end'); text(svg, `${symbol}${j + 1}`, mid + 6, top + 5); text(svg, `±${axis(bound)} · equal scale`, mid, top + size + 23, 'middle');
  const points = (mapped ? checked.changed : checked.original).map(p => [x(p.state[i]), y(p.state[j])] as [number, number]);
  curve(svg, points, mapped, `cr03-explore-plane-${symbol}`);
  const value = (mapped ? checked.changed : checked.original)[index].state;
  if (Math.abs(value[i]) <= bound && Math.abs(value[j]) <= bound) svg.append(node('circle', { cx: x(value[i]), cy: y(value[j]), r: 5, fill: 'currentColor' }));
  else text(svg, 'Selected point outside view · Fit', mid, 15, 'middle');
  if (!mapped) {
    const Tinv = inverse(checked.experiment.T).matrix;
    for (const [k, name] of [[i, 'scale'], [j, 'shear']] as const) {
      const px = x(Tinv[i][k]), py = y(Tinv[j][k]);
      svg.append(node('path', { d: `M${mid} ${centerY}L${px} ${py}`, stroke: 'currentColor', 'stroke-width': 2, opacity: .6, 'clip-path': 'url(#cr03-explore-plane-x)' }));
      if (handles && px >= left && px <= left + size && py >= top && py <= top + size) {
        const group = node('g', { tabindex: 0, role: 'slider', 'aria-label': name === 'scale' ? 'Coordinate scale handle' : 'Coordinate shear handle', 'aria-valuemin': name === 'scale' ? .5 : -2, 'aria-valuemax': 2, 'data-handle': name });
        group.append(node('circle', { cx: px, cy: py, r: 22, fill: 'transparent' }), node('circle', { cx: px, cy: py, r: 6, fill: 'var(--surface)', stroke: 'currentColor', 'stroke-width': 2 })); svg.append(group);
      }
    }
  }
  return svg;
}
export function draw(checked: Checked, index: number, selected: number, pair: readonly [number, number], width: number, limits: Limits, handles: boolean) {
  width = Math.max(200, Math.min(960, width));
  const n = checked.experiment.model.A.length, state = document.createElement('div'), output = document.createElement('div'), planes = document.createElement('div');
  const heading = (text: string) => { const h = document.createElement('h4'); h.textContent = text; return h; };
  if (n) state.append(heading(`State ${selected + 1}: original x / mapped z`), timeline(checked, index, [checked.original.map(p => p.state[selected]), checked.changed.map(p => p.state[selected])], width, limits.state, 'cr03-explore-state', `State ${selected + 1}: original x solid, mapped z dashed; coordinate units`));
  else state.textContent = 'Static gain: there are no dynamic states or state coordinates.';
  output.append(heading('Same output y in both coordinates'), timeline(checked, index, [checked.original.map(p => p.output), checked.changed.map(p => p.output)], width, limits.output, 'cr03-explore-output', 'Output y: original solid, mapped dashed; normalized output units'));
  if (n > 1) { planes.append(plane(checked, index, pair, width, limits.plane, false, handles), plane(checked, index, pair, width, limits.plane, true, false)); }
  return { state, output, planes };
}
