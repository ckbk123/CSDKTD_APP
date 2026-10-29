import { fmt, type Model, type Result } from './math';
const ns = 'http://www.w3.org/2000/svg';
function node<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, text = ''): SVGElementTagNameMap[K] {
  const e = document.createElementNS(ns, tag); Object.entries(attrs).forEach(([key, value]) => e.setAttribute(key, String(value))); e.textContent = text; return e;
}
function line(host: SVGElement, x1: number, y1: number, x2: number, y2: number): void {
  host.append(node('line', { x1, y1, x2, y2, class: 'state-wire' }));
  host.append(node('path', { d: 'M' + (x2 - 6) + ',' + (y2 - 3) + 'L' + x2 + ',' + y2 + 'L' + (x2 - 6) + ',' + (y2 + 3), class: 'state-wire' }));
}
/** Repeated state labels are explicit signal taps from the integrator outputs. */
export function diagram(m: Model, selected: number): SVGSVGElement {
  const n = m.A.length, height = n * 155 + 145;
  const svg = node('svg', { viewBox: '0 0 750 ' + height, role: 'group', 'aria-label': 'Scalar gain and integrator realization. State labels at branch starts are taps from the integrator outputs shown at right.' });
  m.A.forEach((row, i) => {
    const y = 78 + i * 155, g = node('g', { 'data-state': i, class: i === selected ? 'state-selected' : '' });
    svg.append(g);
    [...row, m.B[i]].forEach((gain, j) => {
      const yj = y - 35 + j * 35;
      g.append(node('text', { x: 17, y: yj + 5, class: 'state-svg-text' }, j === n ? 'u' : 'x' + (j + 1)));
      line(g, 43, yj, 100, yj);
      g.append(node('rect', { x: 100, y: yj - 13, width: 110, height: 26, rx: 4, class: 'state-gain' }));
      g.append(node('text', { x: 155, y: yj + 5, 'text-anchor': 'middle', class: 'state-svg-text' }, fmt(gain)));
      g.append(node('path', { d: 'M210,' + yj + 'H270L320,' + (y + (j - n / 2) * 7), class: 'state-wire' }));
    });
    g.append(node('circle', { cx: 335, cy: y, r: 15, class: 'state-summer' }), node('text', { x: 335, y: y + 5, 'text-anchor': 'middle', class: 'state-svg-text' }, '+'));
    line(g, 350, y, 454, y);
    g.append(node('text', { x: 398, y: y - 12, 'text-anchor': 'middle', class: 'state-svg-text' }, "x" + (i + 1) + "'"));
    const integrator = node('g', { tabindex: 0, role: 'button', 'aria-label': 'Select integrator ' + (i + 1) + ', output state x' + (i + 1), 'aria-pressed': String(i === selected), 'data-state': i, class: 'state-integrator' });
    integrator.append(node('rect', { x: 455, y: y - 28, width: 100, height: 56, rx: 5, class: 'state-block' }), node('text', { x: 505, y: y + 6, 'text-anchor': 'middle', class: 'state-svg-text' }, '∫ dt'));
    g.append(integrator); line(g, 555, y, 680, y);
    g.append(node('text', { x: 690, y: y + 5, class: 'state-svg-text' }, 'x' + (i + 1)), node('text', { x: 505, y: y + 52, 'text-anchor': 'middle', class: 'state-svg-small' }, 'Initial value x' + (i + 1) + '(0)'));
  });
  const y = n * 155 + 40;
  svg.append(node('text', { x: 20, y: y - 18, class: 'state-svg-text' }, 'Algebraic output: no additional state'));
  svg.append(node('rect', { x: 20, y, width: 610, height: 42, rx: 5, class: 'state-gain' }));
  svg.append(node('text', { x: 35, y: y + 27, class: 'state-svg-text' }, m.C.map((v, i) => '(' + fmt(v) + ')x' + (i + 1)).concat(['(' + fmt(m.D) + ')u']).join(' + ')));
  line(svg, 630, y + 21, 680, y + 21); svg.append(node('text', { x: 695, y: y + 26, class: 'state-svg-text' }, 'y'));
  return svg;
}

export function channelDiagram(states: number, channelOrder: number): SVGSVGElement {
  const svg = node('svg', { viewBox: '0 0 710 135', role: 'img', 'aria-label': 'One zero-state transfer block, channel order ' + channelOrder + ', with ' + states + ' original states retained in the integrator realization.' });
  svg.append(node('text', { x: 100, y: 65, class: 'state-svg-text' }, 'u'));
  line(svg, 125, 60, 245, 60);
  svg.append(node('rect', { x: 245, y: 32, width: 180, height: 56, rx: 5, class: 'state-block' }));
  svg.append(node('text', { x: 335, y: 67, 'text-anchor': 'middle', class: 'state-svg-text' }, 'G(s)'));
  line(svg, 425, 60, 580, 60);
  svg.append(node('text', { x: 595, y: 65, class: 'state-svg-text' }, 'y'));
  svg.append(node('text', { x: 355, y: 120, 'text-anchor': 'middle', class: 'state-svg-small' }, '1 channel rectangle; ' + states + ' retained integrator state' + (states === 1 ? '' : 's')));
  return svg;
}

export function responsePlot(r: Result, state: number | 'output', inspect: number): SVGSVGElement {
  const rows = r.points, values = rows.map(p => state === 'output' ? [p.y1, p.y2, p.yFree1, p.yForced] : [p.total1[state], p.total2[state], p.free1[state], p.forced[state]]);
  const all = values.flat(), lo = Math.min(0, ...all), hi = Math.max(0, ...all), range = Math.max(1e-8, hi - lo), min = lo - range * .08, max = hi + range * .08;
  const X = (t: number): number => 80 + 590 * t / rows.at(-1)!.t, Y = (y: number): number => 230 - 185 * (y - min) / (max - min);
  const label = state === 'output' ? 'Output y' : 'State x' + (state + 1);
  const svg = node('svg', { viewBox: '0 0 710 285', role: 'img', 'aria-label': label + ': total for initial A and B, free for A, and shared forced response; time in seconds, values in normalized units.' });
  for (let k = 0; k <= 4; k++) {
    const t = rows.at(-1)!.t * k / 4, y = min + (max - min) * k / 4, x = X(t), py = Y(y);
    svg.append(node('line', { x1: 80, y1: py, x2: 670, y2: py, class: 'state-grid' }), node('line', { x1: x, y1: 45, x2: x, y2: 230, class: 'state-grid' }));
    svg.append(node('text', { x: 72, y: py + 4, 'text-anchor': 'end', class: 'state-svg-small' }, fmt(y)), node('text', { x, y: 250, 'text-anchor': 'middle', class: 'state-svg-small' }, fmt(t)));
  }
  svg.append(node('text', { x: 80, y: 24, class: 'state-svg-text' }, label + ' (normalized units)'), node('text', { x: 375, y: 276, 'text-anchor': 'middle', class: 'state-svg-small' }, 'Time t (s)'));
  ['state-total-a', 'state-total-b', 'state-free', 'state-forced'].forEach((cls, j) => {
    const d = values.map((v, k) => (k ? 'L' : 'M') + X(rows[k].t) + ',' + Y(v[j])).join('');
    svg.append(node('path', { d, class: 'state-curve ' + cls }));
  });
  svg.append(node('line', { x1: X(rows[inspect].t), y1: 45, x2: X(rows[inspect].t), y2: 230, class: 'state-inspect' }));
  svg.append(node('circle', { cx: X(rows[inspect].t), cy: Y(values[inspect][0]), r: 4, class: 'state-point' }));
  return svg;
}
