import { parseTransfer } from './input';
import { buildResponse, type Model } from './response';
export type PairModel = Pick<Model, 'g' | 'a1' | 'a0'>;
/** Full Number round-trip digits as decimal coefficients accepted by the existing grammar. */
export function decimalCoefficient(value: number): string {
  if (!Number.isFinite(value)) throw new Error('Use finite model coefficients.');
  const [mantissa, exponent] = value.toString().split('e');
  if (exponent === undefined) return mantissa;
  const negative = mantissa.startsWith('-'), unsigned = negative ? mantissa.slice(1) : mantissa;
  const [integer, fraction = ''] = unsigned.split('.'), digits = integer + fraction, point = integer.length + Number(exponent);
  const result = point <= 0 ? '0.' + '0'.repeat(-point) + digits : point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point) + '.' + digits.slice(point);
  return (negative ? '-' : '') + result;
}
export function pairEquation(model: PairModel): string {
  return 'T(s)=\\frac{' + decimalCoefficient(model.g) + '}{s^2+' + decimalCoefficient(model.a1) + 's+' + decimalCoefficient(model.a0) + '}';
}
export function editedPair(base: PairModel, damping: number, frequency: number): { model: PairModel; latex: string } {
  if (!Number.isFinite(damping) || damping < .02 || damping > 3 || !Number.isFinite(frequency) || frequency < .05 || frequency > 20) throw new Error('Use damping ζ from 0.02 to 3 and natural frequency ωn from 0.05 to 20 rad/s.');
  const a0 = frequency * frequency, candidate = { g: (base.g / base.a0) * a0, a1: 2 * damping * frequency, a0 };
  if (candidate.g < 1e-9 || candidate.g > 1000 || !Number.isFinite(candidate.g)) throw new Error('Preserving the positive DC gain would put the numerator outside 10⁻⁹–1000. The pair/equation were not changed; edit the original model explicitly instead.');
  const latex = pairEquation(candidate), model = parseTransfer(latex);
  if (model.g !== candidate.g || model.a1 !== candidate.a1 || model.a0 !== candidate.a0) throw new Error('The pair coefficients did not round-trip through the supported equation grammar.');
  buildResponse(model); return { model, latex };
}
export function draggedPair(base: PairModel, real: number, imaginary: number): ReturnType<typeof editedPair> {
  if (!Number.isFinite(real) || !Number.isFinite(imaginary) || real >= 0 || imaginary === 0) throw new Error('Keep the conjugate handle in the left half-plane with a nonzero imaginary part. Critical/overdamped pairs use the full numeric controls.');
  const frequency = Math.hypot(real, imaginary);
  return editedPair(base, -real / frequency, frequency);
}
