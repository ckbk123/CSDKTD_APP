import { frequencySamples, response, type Complex, type Construction, type Point, type Response } from './nyquist';
export interface Prediction { readonly source: Complex; readonly guess: Complex }
const fmt = (n: number) => Number(Math.abs(n) < 1e-12 ? 0 : n.toPrecision(6)).toString();
const finiteValue = (r: Response): Complex | undefined => r.kind === 'value' ? r.value : undefined;
function el<K extends keyof HTMLElementTagNameMap>(tag: K, text = '', cls = ''): HTMLElementTagNameMap[K] { const n = document.createElement(tag); n.textContent = text; if (cls) n.className = cls; return n; }
function picture(label: string, width = 420, height = 350) {
  const ns = 'http://www.w3.org/2000/svg', svg = document.createElementNS(ns, 'svg'), region = el('div', '', 'cp05-scroll');
  region.tabIndex = 0; region.setAttribute('role', 'region'); region.setAttribute('aria-label', `${label}. Use arrow keys to scroll.`); svg.setAttribute('viewBox', `0 0 ${width} ${height}`); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', label); if (width > 500) svg.classList.add('cp05-wide');
  function shape(tag: string, attrs: Record<string, string | number>, text = '', parent: SVGElement = svg): SVGElement { const e = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) e.setAttribute(key, String(value)); e.textContent = text; parent.append(e); return e; }
  const defs = shape('defs', {}), id = `cp05-arrow-${crypto.randomUUID()}`, marker = shape('marker', { id, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto-start-reverse' }, '', defs); shape('path', { d: 'M0,0L10,5L0,10Z', class: 'cp05-arrowhead' }, '', marker);
  region.append(svg); return { region, shape, arrow: `url(#${id})` };
}
type Picture = ReturnType<typeof picture>;
function curve(p: Picture, values: readonly (Complex | undefined)[], project: (z: Complex) => Complex, visible: (z: Complex) => boolean, cls: string) {
  let path = '', gap = true;
  for (const value of values) { if (!value || !visible(value)) { gap = true; continue; } const z = project(value); path += `${gap ? 'M' : 'L'}${z.re},${z.im}`; gap = false; }
  p.shape('path', { d: path, class: `cp05-curve ${cls}` });
  // Arrows use actual ordered samples, and disappear when too short to read.
  for (const fraction of [.3, .7]) {
    const i = Math.floor((values.length - 1) * fraction), a = values[i], b = values[Math.min(values.length - 1, i + 6)];
    if (!a || !b || !visible(a) || !visible(b)) continue; const from = project(a), to = project(b);
    if (Math.hypot(to.re - from.re, to.im - from.im) < 4) continue;
    p.shape('path', { d: `M${from.re},${from.im}L${to.re},${to.im}`, class: `cp05-curve ${cls}`, 'marker-end': p.arrow });
  }
}
function cross(p: Picture, z: Complex, project: (z: Complex) => Complex, cls: string) { const v = project(z); p.shape('path', { d: `M${v.re - 5},${v.im - 5}L${v.re + 5},${v.im + 5}M${v.re - 5},${v.im + 5}L${v.re + 5},${v.im - 5}`, class: cls }); }
function axes(p: Picture, span: number, horizontal: string, vertical: string) {
  const project = (z: Complex) => ({ re: 210 + 125 * z.re / span, im: 170 - 125 * z.im / span });
  p.shape('line', { x1: 60, y1: 170, x2: 360, y2: 170, class: 'cp05-axis' }); p.shape('line', { x1: 210, y1: 20, x2: 210, y2: 320, class: 'cp05-axis' });
  for (const n of [-1, 0, 1]) { p.shape('text', { x: project({ re: n * span, im: 0 }).re, y: 189 }, fmt(n * span)); if (n) p.shape('text', { x: 218, y: project({ re: 0, im: n * span }).im }, fmt(n * span)); }
  p.shape('text', { x: 265, y: 342 }, horizontal); p.shape('text', { x: 10, y: 15 }, vertical); return project;
}
function card(title: string, content: HTMLElement, note: string): HTMLElement { const c = el('div', '', 'cp05-card'); c.append(el('h3', title), content, el('p', note)); return c; }
export function makePlots(contour: Construction, active: Point, omega: number, span: number, revealed: boolean, predictions: readonly Prediction[]): HTMLElement {
  const plots = el('div', '', 'cp05-plots'), source = picture('Clockwise finite source contour with denominator roots and selected point'), mapped = picture(revealed ? 'Computed mapped contour and predicted points' : 'Prediction plane before the mapped curve is revealed');
  const sourceSpan = 1.2 * contour.radius, sourceProject = axes(source, sourceSpan, 'σ (s⁻¹)', 'ω (rad/s)'), mapProject = axes(mapped, span, 'Re L (gain)', 'Im L (gain)');
  const insideSource = (z: Complex) => Math.abs(z.re) <= sourceSpan && Math.abs(z.im) <= sourceSpan, insideMap = (z: Complex) => Math.abs(z.re) <= span && Math.abs(z.im) <= span;
  for (const segment of contour.segments) {
    curve(source, segment.points.map(p => p.source), sourceProject, insideSource, `cp05-${segment.kind}`);
    if (revealed) curve(mapped, segment.points.map(p => finiteValue(p.response)), mapProject, insideMap, `cp05-${segment.kind}`);
  }
  for (const pole of contour.poles) if (insideSource(pole)) cross(source, pole, sourceProject, 'cp05-pole');
  cross(source, active.source, sourceProject, 'cp05-selected');
  for (const prediction of predictions) if (insideMap(prediction.guess)) { const z = mapProject(prediction.guess); mapped.shape('circle', { cx: z.re, cy: z.im, r: 5, class: 'cp05-prediction' }); }
  const actual = finiteValue(active.response); if (revealed && actual && insideMap(actual)) cross(mapped, actual, mapProject, 'cp05-selected');
  const outsidePoles = contour.poles.filter(p => !insideSource(p)).length, outsidePredictions = predictions.filter(p => !insideMap(p.guess)).length;
  const legend = 'Solid: positive axis. Dashed: negative axis. Dotted: indent arcs. Long dashes: closing outer arc. Arrows follow increasing contour position where visible.';
  plots.append(card('Source contour', source.region, `${legend} Denominator roots use ×; the selected source uses a heavier ×.${outsidePoles ? ` ${outsidePoles} roots lie outside this source window; all remain in the root list.` : ''}`), card(revealed ? 'Computed Nyquist construction' : 'Place a predicted mapped point', mapped.region, `${revealed ? 'Heavy ×: checked selected point. Open circles: predictions. Segments outside the ±' + fmt(span) + ' gain window are omitted; this clipping is not a finite limit.' : 'Open circles show your entered predictions. The computed curve and checked point remain hidden.'}${outsidePredictions ? ` ${outsidePredictions} predictions are outside this window.` : ''}${revealed && actual && !insideMap(actual) ? ' The selected checked value is outside this window and is reported numerically.' : ''}`));
  if (revealed) {
    const samples = frequencySamples(contour), low = contour.radius * 1e-4, x = (w: number) => 55 + 500 * Math.log10(w / low) / 4;
    const cursor = response(contour.model, { re: 0, im: omega });
    for (const kind of ['magnitude', 'phase'] as const) {
      const p = picture(kind === 'magnitude' ? 'Positive-frequency Bode magnitude in decibels' : 'Positive-frequency principal phase in degrees', 600, 260);
      const values = samples.flatMap(s => s.frequency > 0 && s.response.kind === 'value' && s.response.db !== null ? [s.response.db] : []);
      if (cursor.kind === 'value' && cursor.db !== null) values.push(cursor.db);
      let min = kind === 'phase' ? -180 : values.length ? Math.floor(Math.min(...values) / 20) * 20 : -20, max = kind === 'phase' ? 180 : values.length ? Math.ceil(Math.max(...values) / 20) * 20 : 20; if (min === max) { min -= 10; max += 10; }
      const y = (v: number) => 215 - 175 * (v - min) / (max - min);
      p.shape('line', { x1: 55, y1: 215, x2: 555, y2: 215, class: 'cp05-axis' }); p.shape('line', { x1: 55, y1: 40, x2: 55, y2: 215, class: 'cp05-axis' });
      for (let i = 0; i <= 4; i++) { const w = low * 10 ** i; p.shape('text', { x: x(w) - 12, y: 235 }, fmt(w)); }
      for (const v of [min, (min + max) / 2, max]) p.shape('text', { x: 5, y: y(v) }, fmt(v));
      p.shape('text', { x: 400, y: 255 }, 'ω (rad/s), log axis'); p.shape('text', { x: 58, y: 20 }, kind === 'phase' ? 'principal phase (°)' : 'magnitude (dB)');
      let path = '', gap = true, previous: number | undefined;
      for (const sample of samples) {
        const value = sample.response.kind === 'value' ? kind === 'magnitude' ? sample.response.db : sample.response.phase === null ? null : sample.response.phase * 180 / Math.PI : null;
        if (sample.frequency <= 0 || value === null) { gap = true; previous = undefined; continue; }
        if (kind === 'phase' && previous !== undefined && Math.abs(value - previous) > 180) gap = true;
        path += `${gap ? 'M' : 'L'}${x(sample.frequency)},${y(value)}`; gap = false; previous = value;
      }
      p.shape('path', { d: path, class: 'cp05-curve cp05-positive-axis' });
      const selected = cursor.kind === 'value' ? kind === 'magnitude' ? cursor.db : cursor.phase === null ? null : cursor.phase * 180 / Math.PI : null;
      if (omega >= low && omega <= contour.radius && selected !== null) { p.shape('line', { x1: x(omega), y1: 40, x2: x(omega), y2: 215, class: 'cp05-cursor' }); p.shape('circle', { cx: x(omega), cy: y(selected), r: 4, class: 'cp05-arrowhead' }); }
      plots.append(card(kind === 'phase' ? 'Frequency-response phase' : 'Frequency-response magnitude', p.region, 'This cursor evaluates L(jω), separately from an off-axis contour arc. DC and frequencies below the plotted logarithmic span are reported numerically. Singularities/zeros have undefined phase; principal-phase wraps are gaps.'));
    }
  }
  return plots;
}
