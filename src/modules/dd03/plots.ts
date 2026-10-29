import { coordinates, frequency, unitPoint, type Model, type Response } from './math';
import { numberText as n } from './format';
const NS = 'http://www.w3.org/2000/svg';
function svg(label: string, content: string) {
  const e = document.createElementNS(NS, 'svg'); e.setAttribute('viewBox', '0 0 680 320'); e.setAttribute('role', 'img'); e.setAttribute('aria-label', label);
  e.innerHTML = `<title>${label}</title>${content}`; return e;
}
const text = (x: number, y: number, s: string, anchor = 'start') => `<text x="${x}" y="${y}" text-anchor="${anchor}">${s}</text>`;
const line = (x: number, y: number, xx: number, yy: number, cls = 'wp-axis') => `<line class="${cls}" x1="${x}" y1="${y}" x2="${xx}" y2="${yy}"/>`;
export function mappingPlot(angle: number, T: number) {
  const max = 2 * Math.tan(.9 * Math.PI / 2) / T, x = (a: number) => 65 + 555 * a / Math.PI, y = (v: number) => 260 - 215 * Math.min(max, v) / max;
  const path = Array.from({ length: 201 }, (_, i) => { const a = .9 * Math.PI * i / 200; return `${i ? 'L' : 'M'}${x(a)},${y(coordinates(a, T).warped)}`; }).join(' ');
  const point = coordinates(angle, T), mark = angle <= .9 * Math.PI ? `<circle class="wp-dot" cx="${x(angle)}" cy="${y(point.warped)}" r="5"/>` : text(390,108,'Cursor above chart range; see exact table');
  return svg('Physical to warped frequency map; curve stops at 90% of Nyquist and diverges at Nyquist', `${line(65,260,620,260)}${line(65,260,65,35)}<path class="wp-trace" d="${path}"/>${line(65,260,x(.9*Math.PI),y(.9*Math.PI/T),'wp-reference')}${mark}${text(65,285,'0')}${text(620,285,n(Math.PI/T),'end')}${text(65,25,`Warped ν (rad/s), top ${n(max)}`)}${text(340,311,'Physical ω (rad/s); ν → ∞ at Nyquist','middle')}${text(390,58,'Solid: exact nonlinear map')}${text(390,80,'Dashed: ν = ω reference')}`);
}
export function polePlot(model: Model, angle: number) {
  const extent = Math.max(1.25, ...model.poles.map(p => Math.hypot(p.re, p.im) * 1.15)), scale = 105 / extent, x = (v: number) => 215 + scale * v, y = (v: number) => 155 - scale * v;
  const point = unitPoint(angle);
  const marks = model.poles.map(p => `${line(x(p.re)-4,y(p.im)-4,x(p.re)+4,y(p.im)+4,'wp-cross')}${line(x(p.re)-4,y(p.im)+4,x(p.re)+4,y(p.im)-4,'wp-cross')}`).join('');
  const c = coordinates(angle, model.T);
  return svg('Full unreduced closed-loop poles and selected unit-circle frequency', `${line(75,155,355,155)}${line(215,285,215,25)}<circle class="wp-reference" cx="215" cy="155" r="${scale}"/>${marks}<circle class="wp-dot" cx="${x(point.re)}" cy="${y(point.im)}" r="5"/>${text(360,158,'Re z')}${text(224,27,'Im z')}${text(400,72,'× All closed-loop modes')}${text(400,103,'○ Unit circle')}${text(400,134,'● Frequency cursor')}${text(400,180,`Ω = ${n(angle)} rad/sample`)}${text(400,211,`w = j ${n(c.warped)} rad/s`)}${text(400,242,`ω = ${n(c.omega)} rad/s`)}${text(215,310,'Full poles retained even for canceling corners','middle')}`);
}
export type Axis = 'physical' | 'warped';
export function frequencyPlot(models: { label: string; model: Model }[], axis: Axis, phase: boolean) {
  const T = models[0].model.T, end = axis === 'warped' ? .98 * Math.PI : Math.PI, lowAngle = Math.PI * .0001;
  const horizontal = (angle: number) => axis === 'warped' ? coordinates(angle, T).warped : angle / T;
  const lo = Math.log10(horizontal(lowAngle)), hi = Math.log10(horizontal(end)), x = (angle: number) => 65 + 555 * (Math.log10(horizontal(angle)) - lo) / (hi - lo);
  const low = phase ? -360 : -80, high = phase ? 0 : 80, y = (v: number) => 260 - 215 * (Math.max(low, Math.min(high, v)) - low) / (high - low);
  const paths = models.map(({model}, k) => {
    let path = '', previous: number | null = null;
    for (let i=0;i<=400;i++) {
      const angle = lowAngle * (end / lowAngle) ** (i / 400), at = frequency(model, angle, T);
      const value = phase ? (at.phase === null ? null : at.phase > 0 ? at.phase - 360 : at.phase) : at.db;
      if (value === null || !Number.isFinite(value)) { previous = null; continue; }
      const jump = phase && previous !== null && Math.abs(value-previous)>180;
      path += `${previous === null || jump ? 'M' : 'L'}${x(angle)},${y(value)} `; previous=value;
    }
    return `<path class="${k ? 'wp-reference' : 'wp-trace'}" d="${path}"/>`;
  }).join('');
  return svg(`${phase ? 'Loop phase' : 'Loop magnitude'} versus ${axis === 'physical' ? 'physical frequency' : 'warped frequency'}; 401-point illustration, crossings solved separately`, `${line(65,260,620,260)}${line(65,260,65,35)}${line(65,y(phase?-180:0),620,y(phase?-180:0),'wp-grid')}${paths}${text(65,24,phase?'Loop phase (degrees)':'Loop magnitude (dB); clipped at ±80dB')}${text(57,49,n(high),'end')}${text(57,264,n(low),'end')}${text(65,285,n(horizontal(lowAngle)))}${text(620,285,n(horizontal(end)),'end')}${text(340,312,`${axis==='physical'?'Physical ω':'Warped ν'} (rad/s), logarithmic axis`,'middle')}`);
}
export function responsePlot(model: Model, r: Response, control: boolean) {
  const values = control ? r.controls : r.values, extent = Math.max(1, ...values.map(Math.abs)), low = Math.min(0, ...values), high = Math.max(1, ...values), span = Math.max(extent * .05, high - low);
  const N = r.values.length - 1, x = (k: number) => 65 + 555 * k / N, y = (v: number) => 250 - 205 * (v - low) / span;
  let path = `M${x(0)},${y(values[0])}`;
  if (control) values.forEach((v, i) => { if(i)path+=` L${x(i)},${y(v)}`; path+=` L${x(i+1)},${y(v)}`; });
  else values.forEach((v, i) => { if(i)path+=` L${x(i)},${y(v)}`; });
  const step = Math.max(1, Math.ceil((values.length - 1) / 200));
  const dots = control ? '' : values.map((v,i)=>i%step===0||i===N?`<circle class="wp-dot" cx="${x(i)}" cy="${y(v)}" r="2"/>`:'').join('');
  return svg(control ? 'Held control u[k] on each interval; no extra terminal update' : 'Output samples y[k]; connectors guide the eye and do not reconstruct intersample output', `${line(65,260,620,260)}${line(65,260,65,35)}${line(65,y(control?0:1),620,y(control?0:1),'wp-reference')}<path class="wp-trace ${control?'':'wp-guide'}" d="${path}"/>${dots}${text(65,24,control?'Held control u[k]':'Sampled output y[k]; at most201 displayed markers')}${text(57,49,n(high),'end')}${text(57,254,n(low),'end')}${text(65,285,'0')}${text(620,285,n(N*model.T),'end')}${text(340,313,'Physical time (s)','middle')}`);
}
