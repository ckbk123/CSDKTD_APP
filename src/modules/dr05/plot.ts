import { fmt, type Result } from './math';
export interface SamplingPlot {
  readonly element: HTMLElement;
  select(k: number): boolean;
  nearest(clientX: number): number | undefined;
}
/** Native text axes retain 12 CSS pixels independently of the responsive signal drawing. */
export function trajectoryPlot(result: Result, panel: 'output' | 'input', selected: number, visibleEnd = result.samples.at(-1)!.t): SamplingPlot {
  const ns = 'http://www.w3.org/2000/svg', figure = document.createElement('figure'); figure.className = 'zoh-chart';
  const caption = document.createElement('figcaption'); caption.textContent = panel === 'output' ? 'Output (normalized units)' : 'Delayed held input (normalized units)';
  const frame = document.createElement('div'); frame.className = 'zoh-axes'; const yScale = document.createElement('div'); yScale.className = 'zoh-y-scale';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', '0 0 510 180'); svg.setAttribute('preserveAspectRatio', 'none'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', panel === 'output' ? 'Continuous held-input trajectory, exact sample circles and approximate sample squares' : 'Delayed held input and physical sample clock');
  const xScale = document.createElement('div'); xScale.className = 'zoh-x-scale'; const title = document.createElement('p'); title.className = 'zoh-axis-title'; title.textContent = 'Time t (s)';
  figure.append(caption, frame); frame.append(yScale, svg, xScale, title);
  const rows = result.samples, T = rows[1].t, x = (t: number) => 8 + 494 * t / visibleEnd;
  // Multiplication can put a mathematically coincident endpoint a few ulps beyond H.
  // This is a display boundary only; keep every computed time and sample unchanged.
  const withinWindow = (t: number) => t <= visibleEnd || Math.abs(t - visibleEnd) <= 8 * Number.EPSILON * Math.max(1, Math.abs(t), Math.abs(visibleEnd));
  const visible = rows.filter(row => withinWindow(row.t));
  const segments = result.segments.filter(segment => segment[0].t < visibleEnd).map(segment => {
    const points = []; for (const point of segment) { points.push(point); if (point.t > visibleEnd) break; } return points;
  });
  const values = panel === 'input' ? visible.map(r => r.held) : segments.flat().map(p => p.y).concat(visible.map(r => r.y), result.comparison?.filter(r => withinWindow(r.t)).map(r => r.y) ?? []);
  const low = Math.min(0, ...values), high = Math.max(0, ...values), padding = Math.max(.1, .1 * (high - low)), minimum = low - padding, maximum = high + padding;
  const y = (v: number) => 168 - 156 * (v - minimum) / (maximum - minimum);
  for (const [value, place] of [[maximum, 'high'], [(minimum + maximum) / 2, 'middle'], [minimum, 'low']] as const) {
    const tick = document.createElement('span'); tick.className = place; tick.textContent = fmt(value); yScale.append(tick);
  }
  for (const value of [0, visibleEnd]) { const tick = document.createElement('span'); tick.textContent = fmt(value); xScale.append(tick); }
  function add<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
    const node = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([key, value]) => node.setAttribute(key, String(value))); svg.append(node); return node;
  }
  const interval = add('rect', { x: 8, y: 12, width: 0, height: 156, class: 'zoh-selected-interval' });
  for (const value of [minimum, (minimum + maximum) / 2, maximum]) add('line', { x1: 8, x2: 502, y1: y(value), y2: y(value), class: 'zoh-grid', 'vector-effect': 'non-scaling-stroke' });
  visible.forEach(row => add('line', { x1: x(row.t), x2: x(row.t), y1: 12, y2: 168, class: 'zoh-clock', 'vector-effect': 'non-scaling-stroke' }));
  const markers: { node: SVGCircleElement; k: number }[] = [];
  if (panel === 'output') {
    // Each interval remains separate: feedthrough jumps never become diagonal chords.
    segments.forEach(segment => add('path', { d: segment.map((p, i) => (i ? 'L' : 'M') + x(p.t) + ',' + y(p.y)).join(' '), class: 'zoh-line', 'vector-effect': 'non-scaling-stroke' }));
    result.comparison?.filter(r => withinWindow(r.t)).forEach(r => add('rect', { x: x(r.t) - 3.5, y: y(r.y) - 3.5, width: 7, height: 7, class: 'zoh-approx' }));
  } else {
    const d = visible.map((r, i) => (i ? 'H' : 'M') + x(r.t) + (i ? 'V' : ',') + y(r.held)).join(' ') + (visible.length ? 'H' + x(Math.min(visibleEnd, (visible.at(-1)!.k + 1) * T)) : '');
    add('path', { d, class: 'zoh-line', 'vector-effect': 'non-scaling-stroke' });
  }
  visible.forEach(row => { const node = add('circle', { cx: x(row.t), cy: y(panel === 'output' ? row.y : row.held), r: 3, class: 'zoh-exact', 'data-sample': row.k }); markers.push({ node, k: row.k }); });
  const cursor = add('line', { x1: 8, x2: 8, y1: 12, y2: 168, class: 'zoh-cursor', 'vector-effect': 'non-scaling-stroke' });
  function select(k: number): boolean {
    const row = rows[k], onScreen = !!row && withinWindow(row.t);
    cursor.setAttribute('visibility', onScreen ? 'visible' : 'hidden'); interval.setAttribute('visibility', onScreen && k < rows.length - 1 ? 'visible' : 'hidden');
    if (onScreen) {
      cursor.setAttribute('x1', String(x(row.t))); cursor.setAttribute('x2', String(x(row.t))); cursor.dataset.sample = String(k);
      interval.setAttribute('x', String(x(row.t))); interval.setAttribute('width', String(Math.max(0, x(Math.min(visibleEnd, row.t + T)) - x(row.t))));
    }
    markers.forEach(marker => { marker.node.setAttribute('r', marker.k === k ? '5' : '3'); marker.node.classList.toggle('zoh-selected', marker.k === k); }); return onScreen;
  }
  select(selected);
  return { element: figure, select, nearest(clientX) {
    const box = svg.getBoundingClientRect(); if (!Number.isFinite(clientX) || !box.width) return;
    const time = Math.min(visibleEnd, Math.max(0, ((clientX - box.left) / box.width * 510 - 8) / 494 * visibleEnd));
    return Math.min(visible.at(-1)?.k ?? 0, Math.max(0, Math.round(time / T)));
  } };
}
