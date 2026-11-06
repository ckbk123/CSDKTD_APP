import type { Point } from './response';

export const numeric = (value: number): string => value === 0 ? '0' : Number(value.toPrecision(7)).toString();
export function numericLatex(value: number): string {
  const text = numeric(value), scientific = /^(.+)e([+-]?\d+)$/.exec(text);
  return scientific ? `${scientific[1]}\\times10^{${Number(scientific[2])}}` : text;
}
const axisNumber = (value: number): string => value === 0 ? '0' : Number(value.toPrecision(4)).toString();
const NS = 'http://www.w3.org/2000/svg';
const svgNode = <K extends keyof SVGElementTagNameMap>(tag: K, attributes: Record<string, string>, text?: string): SVGElementTagNameMap[K] => {
  const node = document.createElementNS(NS, tag); for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  if (text !== undefined) node.textContent = text; return node;
};
export interface Plot { readonly element: HTMLElement; cursor(t: number): void }
/** Event samples include both sides, so ordinary jumps are explicit vertical segments. */
export function responsePlot(points: readonly Point[], input: boolean, title: string, impulseArea?: string, signal?: AbortSignal): Plot {
  const scroll = document.createElement('div'); scroll.className = 'cp-plot-scroll'; scroll.tabIndex = 0;
  scroll.setAttribute('role', 'region'); scroll.setAttribute('aria-label', title);
  const media = window.matchMedia?.('(max-width: 700px)');
  let measuredWidth: number | undefined, selected = 0, line: SVGLineElement, project = (time: number): number => time;
  function draw(): void {
  if (signal?.aborted) return;
  const compact = measuredWidth !== undefined ? measuredWidth < 560 : media?.matches ?? false, left = compact ? 74 : 90, right = compact ? 360 : 735, bottom = compact ? 190 : 215;
  const height = compact ? 157 : 185, labelY = compact ? 212 : 237;
  const svg = svgNode('svg', { viewBox: compact ? '0 0 380 244' : '0 0 760 270', role: 'img', 'aria-label': title, 'data-compact': String(compact) }); scroll.replaceChildren(svg);
  if (measuredWidth) svg.style.setProperty('--cp-plot-font', `${12 * (compact ? 380 : 760) / measuredWidth}px`);
  svg.append(svgNode('title', {}, title));
  const keys = input ? ['input'] as const : ['free', 'forced', 'total'] as const;
  let low = 0, high = 0;
  for (const p of points) for (const key of keys) { low = Math.min(low, p[key]); high = Math.max(high, p[key]); }
  const span = high - low || 1; low -= .1 * span; high += .1 * span;
  const end = points.at(-1)?.t || 1, x = (t: number): number => left + (right - left) * t / end;
  project = x;
  const y = (value: number): number => bottom - height * (value - low) / (high - low), ticks = compact ? 2 : 4;
  for (let i = 0; i <= ticks; i++) {
    const value = low + (high - low) * i / ticks, time = end * i / ticks;
    svg.append(svgNode('line', { x1: String(left), x2: String(right), y1: String(y(value)), y2: String(y(value)), class: 'cp-gridline' }));
    svg.append(svgNode('text', { x: String(left - 8), y: String(y(value) + 4), 'text-anchor': 'end' }, axisNumber(value)));
    svg.append(svgNode('text', { x: String(x(time)), y: String(labelY), 'text-anchor': i === ticks ? 'end' : i ? 'middle' : 'start' }, axisNumber(time)));
  }
  svg.append(svgNode('line', { x1: String(left), x2: String(right), y1: String(y(0)), y2: String(y(0)), class: 'cp-axis' }));
  svg.append(svgNode('text', { x: String((left + right) / 2), y: String(compact ? 237 : 261), 'text-anchor': 'middle' }, 'Time t (s)'));
  svg.append(svgNode('text', { x: String(left), y: '17' }, input ? 'Input u (normalized units)' : 'Output y (normalized units)'));
  for (const key of keys) {
    const d = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(3)} ${y(p[key]).toFixed(3)}`).join(' ');
    svg.append(svgNode('path', { d, class: `cp-curve cp-${key}`, fill: 'none', 'vector-effect': 'non-scaling-stroke' }));
  }
  if (impulseArea !== undefined) {
    // A symbol for signed AREA, deliberately independent of the vertical signal scale.
    svg.append(svgNode('path', { d: `M${left} 73 L${left} 34 M${left - 6} 42 L${left} 34 L${left + 6} 42`, class: 'cp-impulse', fill: 'none' }));
    svg.append(svgNode('text', { x: String(left + 12), y: '39' }, compact ? 'δ: area, not height' : `δ at 0: signed area ${impulseArea} (symbol only)`));
    if (compact) { const note = document.createElement('p'); note.className = 'cp-note'; note.textContent = `Ideal impulse at 0: signed area ${impulseArea}. The arrow is an area symbol, not a finite peak.`; scroll.append(note); }
  }
  line = svgNode('line', { x1: String(x(selected)), x2: String(x(selected)), y1: '28', y2: String(bottom + 3), class: 'cp-cursor' }); svg.append(line);
  }
  draw();
  if (signal) media?.addEventListener('change', draw, { signal });
  if (signal && typeof ResizeObserver !== 'undefined') {
    const observer = new ResizeObserver(entries => {
      const width = entries[0]?.contentRect.width;
      if (width && width > 0 && Math.abs(width - (measuredWidth ?? 0)) > .5) { measuredWidth = width; draw(); }
    });
    observer.observe(scroll);
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });
    if (signal.aborted) observer.disconnect();
  }
  return { element: scroll, cursor(time) { selected = time; line?.setAttribute('x1', String(project(time))); line?.setAttribute('x2', String(project(time))); } };
}
