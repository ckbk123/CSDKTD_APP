import { absC, angle, c, divC, evaluate, residual, scaleC, wrap, type Complex } from './complex';
import { parsePolynomial } from './parser';
import { degree, gcd, monic, plus, product, quotient, scale, zero, type Polynomial } from './polynomial';
import { compare, decimal, div, ONE, rational, ZERO, type Rational } from './rational';
import { roots, type Root } from './roots';

export interface Model {
  readonly mode: 'gain' | 'pi'; readonly plantN: Polynomial; readonly plantD: Polynomial;
  readonly integral: Rational; readonly numerator: Polynomial; readonly denominator: Polynomial;
  readonly reducedN: Polynomial; readonly reducedD: Polynomial; readonly common: Polynomial;
  readonly poles: readonly Root[]; readonly zeros: readonly Root[]; readonly fixed: readonly Root[];
}
const limit = rational(1000n);
function coefficients(p: Polynomial, label: string): void {
  if (p.some(value => compare(value, limit) > 0 || compare(value, rational(-1000n)) < 0 || value.d > 1_000_000_000n)) throw new Error(`${label}: normalized coefficients must have magnitude ≤ 1000 and denominator ≤ 10⁹. Rescale or simplify the data.`);
}
export function buildModel(numerator: Polynomial, denominator: Polynomial, mode: 'gain' | 'pi' = 'gain', integral: Rational = rational(27n, 10n)): Model {
  if (zero(denominator)) throw new Error('The denominator cannot be the zero polynomial.');
  const dn = degree(denominator), nn = degree(numerator);
  if (zero(numerator)) throw new Error('A root-locus exercise needs a nonzero numerator.');
  if (dn < 1 || dn > (mode === 'pi' ? 2 : 3) || nn >= dn) throw new Error(mode === 'pi' ? 'Use a strictly proper plant of degree one or two for fixed-Ki PI variation.' : 'Use a strictly proper loop with denominator degree 1–3 and numerator degree below it.');
  const divisor = div(ONE, denominator.at(-1)!);
  const plantD = monic(denominator), plantN = scale(numerator, divisor);
  coefficients(plantN, 'Numerator'); coefficients(plantD, 'Denominator');
  if (plantN.at(-1)!.n <= 0n) throw new Error('This negative-feedback exercise supports a positive leading numerator after denominator normalization. Use a positive loop sign.');
  if (integral.n < 0n || compare(integral, limit) > 0 || integral.d > 1_000_000_000n) throw new Error('Keep fixed Ki between 0 and 1000, with denominator at most 10⁹.');
  const effectiveD = mode === 'pi' ? plus(product([ZERO, ONE], plantD), scale(plantN, integral)) : plantD;
  const effectiveN = mode === 'pi' ? product([ZERO, ONE], plantN) : plantN;
  coefficients(effectiveD, 'Effective denominator'); coefficients(effectiveN, 'Effective numerator');
  const common = gcd(effectiveD, effectiveN), reducedD = quotient(effectiveD, common), reducedN = quotient(effectiveN, common);
  return { mode, plantN, plantD, integral, numerator: effectiveN, denominator: effectiveD, reducedN, reducedD, common, poles: roots(reducedD), zeros: roots(reducedN), fixed: degree(common) ? roots(common) : [] };
}
export function parseModel(n: string, d: string, mode: 'gain' | 'pi' = 'gain', integral = '2.7'): Model { return buildModel(parsePolynomial(n), parsePolynomial(d), mode, decimal(integral, true)); }
export function gainValue(text: string): Rational {
  const value = decimal(text, true); if (value.n < 0n || compare(value, limit) > 0 || value.d > 1_000_000_000n) throw new Error('Use a gain from 0 to 1000 with denominator at most 10⁹.'); return value;
}
export function characteristic(model: Model, gain: Rational, reduced = false): Polynomial {
  if (gain.n < 0n || compare(gain, limit) > 0) throw new Error('Use a gain from 0 to 1000.');
  return plus(reduced ? model.reducedD : model.denominator, scale(reduced ? model.reducedN : model.numerator, gain));
}
export interface Candidate {
  readonly kind: 'ordinary' | 'pole' | 'zero' | 'fixed'; readonly loop?: Complex;
  readonly angleResidual?: number; readonly complexGain?: Complex; readonly magnitudeGain?: number;
  readonly onPositiveLocus: boolean; readonly candidateResidual?: number; readonly selectedResidual: number;
}
/** Point tests use the unreduced Q as a final residual; a retained common-factor mode has a separate meaning. */
export function candidate(model: Model, point: Complex, selectedGain: Rational): Candidate {
  if (![point.re, point.im].every(Number.isFinite) || absC(point) > 100) throw new Error('Enter a finite candidate with |s| ≤ 100 rad/s.');
  const fullQ = characteristic(model, selectedGain), selectedResidual = residual(fullQ, point);
  const fixed = degree(model.common) > 0 && residual(model.common, point) <= 1e-12;
  if (fixed) return { kind: 'fixed', onPositiveLocus: true, selectedResidual };
  const n = evaluate(model.reducedN, point), d = evaluate(model.reducedD, point);
  if (!absC(n)) return { kind: 'zero', onPositiveLocus: false, selectedResidual };
  if (!absC(d)) return { kind: 'pole', onPositiveLocus: true, magnitudeGain: 0, selectedResidual };
  const loop = divC(n, d), complexGain = scaleC(divC(d, n), -1), magnitudeGain = absC(complexGain);
  const angleResidual = wrap(angle(loop) - Math.PI);
  let candidateResidual: number | undefined;
  if (complexGain.re >= 0 && complexGain.re <= 1000 && Math.abs(complexGain.im) <= 1e-8 * Math.max(1, magnitudeGain)) {
    candidateResidual = residual(plus(model.denominator, scale(model.numerator, decimal(String(complexGain.re), true))), point);
  }
  return { kind: 'ordinary', loop, complexGain, magnitudeGain, angleResidual, selectedResidual, candidateResidual,
    onPositiveLocus: Math.abs(angleResidual) <= 1e-6 && complexGain.re >= 0 && candidateResidual !== undefined && candidateResidual <= 2e-8 };
}
export const baseline = (): Model => parseModel('1', 's(s+2)(s+5)');
export const pointOnAxis = (omega: number): Complex => c(0, omega);
