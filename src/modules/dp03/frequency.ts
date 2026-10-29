import type { FrequencyModel } from './expression';

export interface Complex { readonly re: number; readonly im: number }
export type FrequencyResult = { readonly kind: 'pole'; readonly message: string }
  | { readonly kind: 'value'; readonly value: Complex; readonly magnitude: number; readonly db: number | null; readonly phase: number | null };
interface EvaluationModel extends FrequencyModel { readonly aScale?: readonly number[]; readonly bScale?: readonly number[] }
export interface WarpedModel extends EvaluationModel { readonly period: number }
const TAU = 2 * Math.PI;
const magnitude = (x: Complex) => Math.hypot(x.re, x.im);
const product = (x: Complex, y: Complex): Complex => ({ re: x.re * y.re - x.im * y.im, im: x.re * y.im + x.im * y.re });

export function validatePeriod(period: number): void {
  if (!Number.isFinite(period) || period < 1e-6 || period > 100) throw new Error('Sample period T must be between 0.000001 and 100 seconds.');
}
export function principalAngle(angle: number): number {
  if (!Number.isFinite(angle) || Math.abs(angle) > 1e5) throw new Error('Use a finite normalized frequency of magnitude at most 100,000 rad/sample.');
  let result = ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
  if (Math.abs(result) < 1e-14) result = 0;
  if (Math.abs(result + Math.PI) < 1e-14 && angle > 0) result = Math.PI;
  return result;
}
export function fromPhysical(frequency: number, period: number): { raw: number; angle: number; aliased: boolean } {
  validatePeriod(period);
  if (!Number.isFinite(frequency) || Math.abs(frequency) > 1e5) throw new Error('Use a finite physical frequency of magnitude at most 100,000 rad/s.');
  const raw = frequency * period, angle = principalAngle(raw);
  return { raw, angle, aliased: Math.abs(raw) > Math.PI + 1e-12 };
}
export function polynomialAt(coefficients: readonly number[], point: Complex): Complex {
  let value: Complex = { re: 0, im: 0 };
  for (let i = coefficients.length - 1; i >= 0; i--) {
    const next = product(value, point); value = { re: next.re + coefficients[i], im: next.im };
  }
  return value;
}
function scaledNorm(coefficients: readonly number[], point: Complex): number {
  const radius = magnitude(point);
  return coefficients.reduce((sum, value, i) => sum + Math.abs(value) * radius ** i, 0);
}
export function rationalAt(model: EvaluationModel, point: Complex): FrequencyResult {
  const den = polynomialAt(model.a, point), num = polynomialAt(model.b, point);
  const denScale = scaledNorm(model.aScale ?? model.a, point), numScale = scaledNorm(model.bScale ?? model.b, point);
  if (![den.re, den.im, num.re, num.im, denScale, numScale].every(Number.isFinite)) throw new Error('Frequency evaluation exceeds the numerical range. Reduce the scales.');
  if (magnitude(den) <= 1e-10 * denScale) return { kind: 'pole', message: 'The denominator is zero or too close to zero at this frequency (relative threshold 10⁻¹⁰). No finite gain or phase is reported.' };
  if (magnitude(num) <= 1e-14 * numScale) return { kind: 'value', value: { re: 0, im: 0 }, magnitude: 0, db: null, phase: null };
  const denSquared = den.re ** 2 + den.im ** 2;
  const value = { re: (num.re * den.re + num.im * den.im) / denSquared, im: (num.im * den.re - num.re * den.im) / denSquared };
  const gain = magnitude(value);
  if (![value.re, value.im, gain].every(Number.isFinite) || gain === 0) throw new Error('The nonzero response overflowed or underflowed numerically. Use less extreme scales.');
  return { kind: 'value', value, magnitude: gain, db: 20 * Math.log10(gain), phase: Math.atan2(value.im, value.re) };
}
export function unitResponse(model: FrequencyModel, angle: number): FrequencyResult {
  const principal = principalAngle(angle);
  const endpoint = Math.abs(Math.abs(principal) - Math.PI) < 1e-14;
  const q = endpoint ? { re: -1, im: 0 } : { re: Math.cos(principal), im: -Math.sin(principal) };
  return rationalAt(model, q);
}

function realProduct(a: readonly number[], b: readonly number[]): number[] {
  const result = Array(a.length + b.length - 1).fill(0) as number[];
  a.forEach((x, i) => b.forEach((y, j) => {
    const term = x * y;
    if (x !== 0 && y !== 0 && term === 0) throw new Error('Bilinear coefficients underflow. Use less extreme coefficients or T.');
    result[i + j] += term;
  }));
  if (result.some(x => !Number.isFinite(x) || Math.abs(x) > 1e16)) throw new Error('Bilinear coefficients exceed their numerical bound. Reduce coefficient scales or T.');
  return result;
}
function power(base: readonly number[], order: number): number[] {
  let result = [1];
  for (let i = 0; i < order; i++) result = realProduct(result, base);
  return result;
}
/** q=(1-Tw/2)/(1+Tw/2); coefficients ascend in w, with the common denominator cleared. */
export function bilinear(model: FrequencyModel, period: number): WarpedModel {
  validatePeriod(period);
  const degree = Math.max(model.a.length, model.b.length) - 1, h = period / 2;
  const convert = (coefficients: readonly number[]): { coefficients: number[]; scales: number[] } => {
    const result = Array(degree + 1).fill(0) as number[];
    const scales = Array(degree + 1).fill(0) as number[];
    coefficients.forEach((coefficient, i) => {
      const basis = realProduct(power([1, -h], i), power([1, h], degree - i));
      basis.forEach((value, j) => {
        const term = value * coefficient;
        if (value !== 0 && coefficient !== 0 && term === 0) throw new Error('Bilinear coefficients underflow. Use less extreme coefficient scales.');
        result[j] += term;
        scales[j] += Math.abs(term);
      });
    });
    if (result.some(x => !Number.isFinite(x) || Math.abs(x) > 1e16)) throw new Error('Transformed coefficients exceed the numerical bound.');
    return { coefficients: result, scales };
  };
  const numerator = convert(model.b), denominator = convert(model.a);
  return { b: numerator.coefficients, a: denominator.coefficients, bScale: numerator.scales, aScale: denominator.scales, period };
}
export function warpedResponse(model: FrequencyModel, transformed: WarpedModel, angle: number): { frequency: number | null; result: FrequencyResult; endpoint: boolean } {
  const principal = principalAngle(angle);
  if (Math.abs(Math.abs(principal) - Math.PI) < 1e-14) return { frequency: null, result: unitResponse(model, principal), endpoint: true };
  const frequency = 2 / transformed.period * Math.tan(principal / 2);
  return { frequency, result: rationalAt(transformed, { re: 0, im: frequency }), endpoint: false };
}
export function frequencySamples(model: FrequencyModel, period: number, count = 241): readonly { angle: number; exact: FrequencyResult; unwarped: FrequencyResult }[] {
  validatePeriod(period);
  if (!Number.isInteger(count) || count < 20 || count > 600) throw new Error('Choose 20–600 frequency samples.');
  const transformed = bilinear(model, period);
  return Array.from({ length: count }, (_, i) => {
    const angle = Math.PI * i / (count - 1);
    return { angle, exact: unitResponse(model, angle), unwarped: rationalAt(transformed, { re: 0, im: angle / period }) };
  });
}
export function format(value: number): string { return value === 0 ? '0' : Number(value.toPrecision(7)).toString(); }
export function numberLatex(value: number): string { return format(value).replace(/e([+-]?\d+)/, '\\times10^{$1}'); }
export function polynomialLatex(coefficients: readonly number[], variable: string): string {
  return coefficients.flatMap((value, i) => value === 0 ? [] : [{ negative: value < 0, term: `${Math.abs(value) === 1 && i ? '' : numberLatex(Math.abs(value))}${i ? i === 1 ? variable : `${variable}^{${i}}` : ''}` }])
    .map(({ negative, term }, i) => `${negative ? '-' : i ? '+' : ''}${term}`).join('') || '0';
}
