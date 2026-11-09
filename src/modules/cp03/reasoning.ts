import { createEquationDisplay } from '../../shared/equations/input';
import { evaluatePolynomial, poles, type Complex } from './math';
import { numberLabel as fmt } from './plots';
import type { Trial } from './calculation';
const mf = (value: number) => fmt(value).replace(/e([+-]?\d+)/, '\\times 10^{$1}');
const degrees = (value: number) => value * 180 / Math.PI;
const complex = (z: Complex) => `${mf(z.re)}${z.im < 0 ? '-' : '+'}${mf(Math.abs(z.im))}j`;
const polynomial = (p: number[]) => p.map((v, i) => v === 0 ? '' : `${v >= 0 ? '+' : '-'}${mf(Math.abs(v))}${i === 1 ? 's' : i === 2 ? 's^2' : ''}`).reverse().join('').replace(/^\+/, '') || '0';
export function reasoning(trial: Trial): HTMLElement {
  const root = document.createElement('div'), { plant, w, A, responseAmplitude, e } = trial, f = e.value;
  const equation = (latex: string, title: string) => root.append(createEquationDisplay(latex, title));
  const paragraph = (text: string) => { const p = document.createElement('p'); p.textContent = text; root.append(p); };
  equation(`G(s)\\approx\\frac{${polynomial(plant.numerator)}}{${polynomial(plant.denominator)}},\\quad u(t)\\approx ${mf(A)}\\sin(${mf(w)}t)`, 'Normalized plant and input, rounded coefficients');
  equation(`s=j\\omega,\\quad j^2=-1,\\quad G(j${mf(w)})\\approx\\frac{${complex(evaluatePolynomial(plant.numerator, w))}}{${complex(evaluatePolynomial(plant.denominator, w))}}\\approx ${complex(f)}`, 'Substitute frequency and divide complex numbers');
  equation(`|G|=\\sqrt{(\\Re G)^2+(\\Im G)^2}\\approx ${mf(f.magnitude)},\\quad B=A|G|\\approx ${mf(responseAmplitude)}`, 'Calculated gain and output amplitude');
  if (f.phase !== null) {
    equation(`\\varphi=\\operatorname{atan2}(\\Im G,\\Re G)\\approx ${mf(f.phase)}\\ \\mathrm{rad}=${mf(degrees(f.phase))}^{\\circ}`, 'Calculated signed principal phase');
    equation(`y_p(t)\\approx ${mf(responseAmplitude)}\\sin\\left(${mf(w)}t${f.phase < 0 ? '-' : '+'}${mf(Math.abs(f.phase))}\\right),\\quad\\Delta t\\equiv-\\frac{\\varphi}{\\omega}\\approx ${mf(-f.phase / w)}\\ \\mathrm{s}`, 'Particular solution and peak shift modulo a period');
  } else paragraph('The gain is zero or within the relative 10⁻¹² numerator tolerance of a zero: phase and a peak time shift are undefined.');
  paragraph(`Denominator poles (rad/s): ${poles(plant).map(p => `${fmt(p.re)}${p.im < 0 ? '−' : '+'}${fmt(Math.abs(p.im))}j`).join(', ') || 'no dynamic poles'}. ${e.stable ? 'All denominator modes decay.' : 'A nondecaying denominator mode prevents a guaranteed steady-state experiment.'} Phase is principal; adding a whole period to a marker preserves its frequency interpretation.`);
  paragraph('Exact identities are shown symbolically; displayed numbers are rounded. The zero-state response is the particular sinusoid plus its homogeneous transient from zero canonical states. Compare an early window with a later one before interpreting actual peaks as steady state.');
  return root;
}
