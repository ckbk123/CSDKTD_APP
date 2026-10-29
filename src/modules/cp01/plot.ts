import type { Point } from './response';

export const numeric = (value: number): string => value === 0 ? '0' : Number(value.toPrecision(7)).toString();
const axisNumber = (value: number): string => value === 0 ? '0' : Number(value.toPrecision(4)).toString();
const NS = 'http://www.w3.org/2000/svg';
const svgNode = <K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>, text?: string): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text; return node;
};
export interface Plot { readonly element: HTMLElement; cursor(t: number): void }
/** Event samples include both sides, so ordinary jumps are explicit vertical segments. */
export function responsePlot(points: readonly Point[], input: boolean, title: string, impulseArea?: string): Plot {
  const scroll = document.createElement('div'); scroll.className = 'cp-plot-scroll'; scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', `${title}; horizontally scrollable`);
  const svg = svgNode('svg', { viewBox: '0 0 760 270', role: 'img', 'aria-label': title }); scroll.append(svg);
  svg.append(svgNode('title', {}, title));
  const keys = input ? ['input'] as const : ['free', 'forced', 'total'] as const;
  let low = 0, high = 0;
  for (const p of points) for (const key of keys) { low = Math.min(low, p[key]); high = Math.max(high, p[key]); }
  const span = high - low || 1; low -= .1 * span; high += .1 * span;
  const end = points.at(-1)?.t || 1, x = (t: number): number => 90 + 645 * t / end;
  const y = (value: number): number => 215 - 185 * (value - low) / (high - low);
  for (let i = 0; i <= 4; i++) {
    const value = low + (high - low) * i / 4, time = end * i / 4;
    svg.append(svgNode('line', { x1: '90', x2: '735', y1: String(y(value)), y2: String(y(value)), class: 'cp-gridline' }));
    svg.append(svgNode('text', { x: '82', y: String(y(value) + 4), 'text-anchor': 'end' }, axisNumber(value)));
    svg.append(svgNode('text', { x: String(x(time)), y: '237', 'text-anchor': 'middle' }, numeric(time)));
  }
  svg.append(svgNode('line', { x1: '90', x2: '735', y1: String(y(0)), y2: String(y(0)), class: 'cp-axis' }));
  svg.append(svgNode('text', { x: '412', y: '261', 'text-anchor': 'middle' }, 'Time t (s)'));
  svg.append(svgNode('text', { x: '90', y: '17' }, input ? 'Input u (normalized units)' : 'Output y (normalized units)'));
  for (const key of keys) {
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(3)} ${y(p[key]).toFixed(3)}`).join(' ');
    svg.append(svgNode('path', { d, class: `cp-curve cp-${key}`, fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
  }
  if (impulseArea !== undefined) {
    // A symbol for signed AREA, deliberately independent of the vertical signal scale.
    svg.append(svgNode('path', { d: 'M90 73 L90 34 M84 42 L90 34 L96 42', class: 'cp-impulse', fill: 'none' }));
    svg.append(svgNode('text', { x: '102', y: '39' }, `δ at 0: signed area ${impulseArea} (symbol only)`));
  }
  const line = svgNode('line', { x1: '90', x2: '90', y1: '28', y2: '218', class: 'cp-cursor' }); svg.append(line);
  return { element: scroll, cursor(t) { line.setAttribute('x1', String(x(t))); line.setAttribute('x2', String(x(t))); } };
}
