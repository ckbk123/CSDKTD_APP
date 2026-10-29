import { asymptotes, breakPoints, poles, realSegments, zero } from './math';
import type { Complex, Model, RootSet } from './math';
import { complexText, numberText } from './format';

function svg(tag: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [name, value] of Object.entries(attrs)) node.setAttribute(name, String(value));
  if (text !== undefined) node.textContent = text;
  return node;
}
function figure(label: string, chart: SVGElement, caption: string): HTMLElement {
  const element = document.createElement('figure'), scroll = document.createElement('div'); scroll.className = 'rl-scroll'; scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', `${label}, scroll horizontally if needed`);
  const text = document.createElement('figcaption'); text.textContent = caption;
  scroll.append(chart); element.append(scroll, text); return element;
}
export interface PlotOptions {
  readonly range: number;
  readonly branches?: readonly [readonly Complex[], readonly Complex[]];
  readonly selected?: RootSet;
  readonly candidate?: Complex | null;
  readonly segments?: boolean;
  readonly asymptotes?: boolean;
  readonly breaks?: boolean;
  readonly vectors?: boolean;
  readonly showBranches?: boolean;
}
export function locusPlot(model: Model, options: PlotOptions): HTMLElement {
  const range = options.range, scale = 360 / (2 * range);
  const x = (value: number) => 180 + value * scale, y = (value: number) => 180 - value * scale;
  const chart = svg('svg', { viewBox: '0 0 460 450', role: 'img', 'aria-label': 'Discrete root locus, equal z-plane scales and visible unit circle' });
  chart.append(svg('title', {}, 'Discrete root locus with all selected roots, without canceling factors'));
  // A nested viewport clips the drawing without document-global clip-path IDs.
  const plane = svg('svg', { x: 50, y: 30, width: 360, height: 360, viewBox: '0 0 360 360', overflow: 'hidden' });
  plane.append(svg('path', { d: 'M0,180H360M180,0V360', class: 'rl-axis' }), svg('circle', { cx: 180, cy: 180, r: scale, class: 'rl-unit' }));
  if (options.segments) for (const segment of realSegments(model).filter(value => value.onLocus)) plane.append(svg('line', { x1: x(segment.left ?? -range), x2: x(segment.right ?? range), y1: 180, y2: 180, class: 'rl-segment' }));
  if (options.asymptotes) {
    const construction = asymptotes(model);
    const rayLength = Math.abs(construction.centroid) + 4 * range;
    for (const angle of construction.angles) plane.append(svg('line', { x1: x(construction.centroid), y1: 180, x2: x(construction.centroid + rayLength * Math.cos(angle)), y2: y(rayLength * Math.sin(angle)), class: 'rl-asymptote' }));
  }
  if (options.branches && options.showBranches) options.branches.forEach((branch, index) => plane.append(svg('path', { d: branch.map((point, at) => `${at ? 'L' : 'M'}${x(point.re)},${y(point.im)}`).join(''), class: index ? 'rl-branch rl-secondary' : 'rl-branch' })));
  const openPoles = poles(model), openZero = zero(model);
  if (options.candidate && options.vectors) {
    const target = options.candidate;
    for (const [point, kind] of [...openPoles.map(point => [point, 'pole'] as const), ...(openZero ? [[openZero, 'zero'] as const] : [])]) {
      const fromX = x(point.re), fromY = y(point.im), toX = x(target.re), toY = y(target.im), dx = toX - fromX, dy = toY - fromY, size = Math.hypot(dx, dy);
      if (size < 1e-10) continue;
      const ux = dx / size, uy = dy / size;
      plane.append(svg('line', { x1: fromX, y1: fromY, x2: toX, y2: toY, class: `rl-vector rl-${kind}-vector` }), svg('path', { d: `M${toX - 10 * ux + 4 * uy},${toY - 10 * uy - 4 * ux}L${toX},${toY}L${toX - 10 * ux - 4 * uy},${toY - 10 * uy + 4 * ux}`, class: `rl-vector rl-${kind}-vector` }));
    }
  }
  if (options.breaks) for (const point of breakPoints(model).filter(value => value.reason === 'positive')) plane.append(svg('rect', { x: x(point.position) - 4, y: 176, width: 8, height: 8, class: 'rl-break' }));
  openPoles.forEach((point, index) => {
    const px = x(point.re), py = y(point.im);
    plane.append(svg('path', { d: `M${px - 5},${py - 5}L${px + 5},${py + 5}M${px - 5},${py + 5}L${px + 5},${py - 5}`, class: 'rl-pole' }), svg('text', { x: px + 8, y: py - 8 }, `p${index + 1}`));
  });
  if (openZero) plane.append(svg('circle', { cx: x(openZero.re), cy: 180, r: 6, class: 'rl-zero' }));
  if (options.selected) options.selected.roots.forEach((point, index) => {
    const px = x(point.re), py = y(point.im), radius = index ? 7 : 4;
    plane.append(svg('path', { d: `M${px},${py - radius}L${px + radius},${py}L${px},${py + radius}L${px - radius},${py}Z`, class: index ? 'rl-root-marker rl-root-marker-second' : 'rl-root-marker' }));
  });
  if (options.candidate) plane.append(svg('circle', { cx: x(options.candidate.re), cy: y(options.candidate.im), r: 10, class: 'rl-candidate' }));
  chart.append(plane);
  for (const tick of [-range, 0, range]) chart.append(svg('text', { x: 50 + x(tick), y: 411, 'text-anchor': 'middle' }, numberText(tick)), svg('text', { x: 43, y: 34 + y(tick), 'text-anchor': 'end' }, numberText(tick)));
  chart.append(svg('text', { x: 410, y: 434, 'text-anchor': 'end' }, 'Re z (normalized)'), svg('text', { x: 50, y: 18 }, 'Im z (normalized)'));
  const outside = options.selected?.roots.filter(point => Math.abs(point.re) > range || Math.abs(point.im) > range).length ?? 0;
  const openOutside = [...openPoles, ...(openZero ? [openZero] : [])].filter(point => Math.abs(point.re) > range || Math.abs(point.im) > range).length;
  const caption = `× open poles; ○ finite zero; diamonds selected roots; ring last tested point; squares positive-gain break candidates. Unit circle always shown. View ±${numberText(range)}, equal scales; ${openOutside} open-loop markers are outside the view and their coordinates remain listed above. ${outside} selected roots outside this view remain in the table. ${options.branches ? 'Polyline branches are finite computed gain samples, not a proof of an entire stability interval.' : 'Predict the real-axis segments before revealing the branches.'}${options.candidate ? ` Last plotted point: ${complexText(options.candidate)}.` : ''}`;
  return figure('z-plane construction', chart, caption);
}

export function modePlot(values: readonly number[], period: number, branch: number): HTMLElement {
  const intervals = values.length - 1, maximum = Math.max(1, ...values.map(Math.abs));
  const x = (k: number) => 100 + 330 * k / intervals, y = (value: number) => 105 - 65 * value / maximum;
  const chart = svg('svg', { viewBox: '0 0 460 245', role: 'img', 'aria-label': `Branch ${branch} unit real root-mode samples` });
  chart.append(svg('title', {}, `Branch ${branch} real root mode, not a forced system response`), svg('path', { d: 'M100,30V185M100,105H435', class: 'rl-axis' }));
  values.forEach((value, k) => chart.append(svg('line', { x1: x(k), x2: x(k), y1: 105, y2: y(value), class: 'rl-stem' }), svg('circle', { cx: x(k), cy: y(value), r: 2.5, class: 'rl-sample' })));
  for (const tick of [-maximum, 0, maximum]) chart.append(svg('text', { x: 94, y: y(tick) + 4, 'text-anchor': 'end' }, numberText(Number(tick.toPrecision(3)))));
  for (const k of new Set([0, Math.floor(intervals / 2), intervals])) chart.append(svg('text', { x: x(k), y: 204, 'text-anchor': 'middle' }, String(k)), svg('text', { x: x(k), y: 222, 'text-anchor': 'middle' }, `${numberText(k * period)}s`));
  chart.append(svg('text', { x: 12, y: 19 }, `Branch ${branch}: Re(zᵏ), x[0]=1`), svg('text', { x: 448, y: 241, 'text-anchor': 'end' }, 'sample k / time kT'));
  return figure(`Branch ${branch} root-mode plot`, chart, 'Unit-amplitude basis only, normalized amplitude. Discrete stems have no inferred intersample output; tiny decaying tails may round to zero.');
}
