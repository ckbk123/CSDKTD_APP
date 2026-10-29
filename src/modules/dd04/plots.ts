import type { Step } from './math';
import { numberText } from './format';

function svgElement(tag: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
export function samplePlots(steps: readonly Step[], output0: number, error0: number, period: number): HTMLElement {
  const row = document.createElement('div'); row.className = 'pid-plots';
  for (const [name, values] of [['Output u[k]', [output0, ...steps.map(step => step.position)]], ['Error e[k]', [error0, ...steps.map(step => step.error)]]] as const) {
    const figure = document.createElement('figure');
    const scroll = document.createElement('div'); scroll.className = 'pid-plot-scroll'; scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', `${name} plot, scroll horizontally if needed`);
    const chart = svgElement('svg', { viewBox: '0 0 400 250', role: 'img', 'aria-label': `${name}, committed samples only` });
    chart.append(svgElement('title', {}, `${name}, committed samples only`));
    const maximum = Math.max(1, ...values.map(Math.abs));
    const intervals = Math.max(1, values.length - 1);
    const x = (k: number) => 72 + 303 * k / intervals, y = (value: number) => 115 - 70 * value / maximum;
    chart.append(svgElement('path', { d: 'M72,35V200M72,115H380', class: 'pid-axis' }));
    values.forEach((value, k) => chart.append(
      svgElement('line', { x1: x(k), x2: x(k), y1: 115, y2: y(value), class: 'pid-stem' }),
      svgElement('circle', { cx: x(k), cy: y(value), r: 3, class: 'pid-sample' }),
    ));
    for (const value of [-maximum, 0, maximum]) {
      const tick = Math.abs(value) >= 1e5 ? value.toExponential(2) : numberText(Number(value.toPrecision(3)));
      chart.append(svgElement('text', { x: 66, y: y(value) + 4, 'text-anchor': 'end' }, tick));
    }
    for (const k of new Set([0, Math.floor(intervals / 2), intervals])) chart.append(
      svgElement('text', { x: x(k), y: 214, 'text-anchor': 'middle' }, String(k)),
      svgElement('text', { x: x(k), y: 231, 'text-anchor': 'middle' }, `${numberText(k * period)}s`),
    );
    chart.append(svgElement('text', { x: 12, y: 20 }, name), svgElement('text', { x: 390, y: 246, 'text-anchor': 'end' }, 'k / kT (seconds)'));
    const caption = document.createElement('figcaption'); caption.textContent = `${name}: normalized units, discrete stems; no intersample interpolation.`;
    scroll.append(chart); figure.append(scroll, caption); row.append(figure);
  }
  return row;
}
