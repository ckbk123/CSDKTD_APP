/** Negative feedback: D(z)+K B(z), D=z²+a1 z+a0, B=b1 z+b0. No cancellation. */
export interface Model { readonly a1: number; readonly a0: number; readonly b1: number; readonly b0: number }
export interface Complex { readonly re: number; readonly im: number }
export interface RootSet { readonly roots: readonly [Complex, Complex]; readonly coefficients: readonly [number, number, number]; readonly residuals: readonly [number, number]; readonly repeated: boolean; readonly nearRepeated: boolean }
export const CIRCLE_TOLERANCE = 1e-9;
export const ANGLE_TOLERANCE = 1e-7;
export const MIN_NONZERO = 1e-100;
const fail = (message: string): never => { throw new Error(message); };
export const magnitude = (z: Complex): number => Math.hypot(z.re, z.im);
export const phase = (z: Complex): number => { const angle = Math.atan2(z.im || 0, z.re); return angle === -Math.PI ? Math.PI : angle; };
export const multiply = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
const subtract = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const divide = (a: Complex, b: Complex): Complex => { const scale = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / scale, im: (a.im * b.re - a.re * b.im) / scale }; };
const wrap = (angle: number): number => Math.atan2(Math.sin(angle), Math.cos(angle));

/** Stable real-root evaluation, retaining the continuous +sqrt / -sqrt branches. */
function quadratic(a: number, b: number): readonly [Complex, Complex] {
  if (b === 0) return a >= 0 ? [{ re: 0, im: 0 }, { re: -a || 0, im: 0 }] : [{ re: -a, im: 0 }, { re: 0, im: 0 }];
  const delta = a * a - 4 * b;
  if (![a, b, delta].every(Number.isFinite)) fail('The quadratic is outside the finite numerical range.');
  if (delta < 0) return [{ re: -a / 2 || 0, im: Math.sqrt(-delta) / 2 }, { re: -a / 2 || 0, im: -Math.sqrt(-delta) / 2 }];
  if (delta === 0) return [{ re: -a / 2 || 0, im: 0 }, { re: -a / 2 || 0, im: 0 }];
  const q = -0.5 * (a + (a >= 0 ? 1 : -1) * Math.sqrt(delta));
  const other = b / q;
  return a >= 0 ? [{ re: other || 0, im: 0 }, { re: q || 0, im: 0 }] : [{ re: q || 0, im: 0 }, { re: other || 0, im: 0 }];
}

export function validateModel(model: Model): Model {
  const { a1, a0, b1, b0 } = model;
  if (![a1, a0, b1, b0].every(Number.isFinite)) fail('All normalized coefficients must be finite.');
  if ([a1, a0, b1, b0].some(value => value !== 0 && Math.abs(value) < MIN_NONZERO)) fail('A nonzero normalized coefficient is below 10⁻¹⁰⁰. Rescale the model.');
  if ([a1, a0, b1, b0].some(value => Math.abs(value) > 100)) fail('Keep each monic-normalized coefficient within ±100.');
  const scale = Math.max(Math.abs(b1), Math.abs(b0));
  if (scale < 1e-4) fail('Use a nonzero numerator with normalized coefficient magnitude at least 0.0001. Rescale the fixed loop factor if needed.');
  if (quadratic(a1, a0).some(z => magnitude(z) > 20) || (b1 !== 0 && Math.abs(b0 / b1) > 20)) fail('Keep the open-loop poles and finite zero within radius 20.');
  return { a1, a0, b1, b0 };
}
export function poles(model: Model): readonly [Complex, Complex] { const m = validateModel(model); return quadratic(m.a1, m.a0); }
export function zero(model: Model): Complex | null { const m = validateModel(model); return m.b1 === 0 ? null : { re: -m.b0 / m.b1 || 0, im: 0 }; }
export function denominator(model: Model, z: Complex): Complex { const squared = multiply(z, z); return { re: squared.re + model.a1 * z.re + model.a0, im: squared.im + model.a1 * z.im }; }
export function numerator(model: Model, z: Complex): Complex { return { re: model.b1 * z.re + model.b0, im: model.b1 * z.im }; }
export function rootsAt(model: Model, gain: number): RootSet {
  const m = validateModel(model);
  if (!Number.isFinite(gain) || gain < 0 || gain > 100) fail('Select a gain K from 0 to 100.');
  if (gain !== 0 && gain < MIN_NONZERO) fail('A nonzero gain below 10⁻¹⁰⁰ is outside the numerical scale. Use 0 explicitly or rescale the loop.');
  const gainProduct = (coefficient: number) => { const value = gain * coefficient; if (gain !== 0 && coefficient !== 0 && value === 0) fail('A nonzero characteristic product is too small to represent. Rescale the loop.'); return value; };
  const a = m.a1 + gainProduct(m.b1), b = m.a0 + gainProduct(m.b0);
  const roots = quadratic(a, b);
  const residual = (z: Complex) => magnitude(denominator({ ...m, a1: a, a0: b }, z)) / Math.max(1, magnitude(z) ** 2 + Math.abs(a) * magnitude(z) + Math.abs(b));
  const residuals = [residual(roots[0]), residual(roots[1])] as const;
  if (residuals.some(value => !Number.isFinite(value) || value > 1e-10)) fail('The roots did not meet the scaled residual tolerance of 10⁻¹⁰. Rescale this model.');
  const delta = a * a - 4 * b;
  return { roots, coefficients: [1, a, b], residuals, repeated: delta === 0 && (b !== 0 || a === 0), nearRepeated: Math.abs(delta) <= 1e-10 * Math.max(1, a * a, Math.abs(4 * b)) };
}
export function diskClass(roots: readonly Complex[]): 'inside' | 'boundary' | 'outside' {
  if (roots.length !== 2 || roots.some(z => ![z.re, z.im].every(Number.isFinite))) fail('Classify both finite characteristic roots, including multiplicity.');
  const radii = roots.map(magnitude);
  if (radii.some(r => r > 1 + CIRCLE_TOLERANCE)) return 'outside';
  return radii.every(r => r < 1 - CIRCLE_TOLERANCE) ? 'inside' : 'boundary';
}

export interface Segment { readonly left: number | null; readonly right: number | null; readonly rightCount: number; readonly onLocus: boolean }
export function realSegments(model: Model): readonly Segment[] {
  const m = validateModel(model), p = poles(m), z = zero(m);
  const realLocations = [...p.filter(point => point.im === 0).map(point => point.re), ...(z ? [z.re] : [])];
  // Partition locations are sorted; root branches themselves are never sorted independently.
  const boundaries = [...new Set(realLocations)].sort((a, b) => a - b);
  const ends: (number | null)[] = [null, ...boundaries, null];
  const negativeLeading = (m.b1 === 0 ? m.b0 : m.b1) < 0;
  return ends.slice(1).map((right, index) => {
    const left = ends[index];
    const probe = left === null ? right === null ? 0 : right - Math.max(1, Math.abs(right)) : right === null ? left + Math.max(1, Math.abs(left)) : left / 2 + right / 2;
    const rightCount = realLocations.filter(value => value > probe).length;
    return { left, right, rightCount, onLocus: rightCount % 2 === (negativeLeading ? 0 : 1) };
  });
}
export function asymptotes(model: Model): { readonly centroid: number; readonly angles: readonly number[] } {
  const m = validateModel(model), z = zero(m), count = z ? 1 : 2;
  const fixedPhase = (m.b1 === 0 ? m.b0 : m.b1) < 0 ? Math.PI : 0;
  return { centroid: (-m.a1 - (z?.re ?? 0)) / count, angles: Array.from({ length: count }, (_, index) => ((2 * index + 1) * Math.PI - fixedPhase) / count) };
}
export interface BreakPoint { readonly position: number; readonly gain: number | null; readonly reason: 'positive' | 'negative' | 'endpoint' | 'singular' }
export function breakPoints(model: Model): readonly BreakPoint[] {
  const m = validateModel(model);
  // D'B - DB' = b1 z² + 2b0 z + a1 b0 - a0 b1.
  const candidates = m.b1 === 0 ? [{ re: -m.a1 / 2, im: 0 }] : quadratic(2 * m.b0 / m.b1, (m.a1 * m.b0 - m.a0 * m.b1) / m.b1);
  return candidates.filter((point, index) => point.im === 0 && candidates.findIndex(other => other.im === 0 && other.re === point.re) === index).map(point => {
    const b = numerator(m, point).re;
    if (Math.abs(b) <= 1e-12 * Math.max(1, Math.abs(m.b1 * point.re), Math.abs(m.b0))) return { position: point.re, gain: null, reason: 'singular' };
    const gain = -denominator(m, point).re / b;
    return { position: point.re, gain, reason: gain > 0 ? 'positive' : gain === 0 ? 'endpoint' : 'negative' };
  });
}
/** Includes unreduced fixed/moving branch intersections where D/B itself is 0/0. */
export function collisionGains(model: Model): readonly number[] {
  const m = validateModel(model), c0 = m.a1 * m.a1 - 4 * m.a0, c1 = 2 * m.a1 * m.b1 - 4 * m.b0;
  const candidates = m.b1 === 0 ? [-c0 / c1] : quadratic(c1 / (m.b1 * m.b1), c0 / (m.b1 * m.b1)).filter(z => z.im === 0).map(z => z.re);
  return [...new Set(candidates.filter(k => Number.isFinite(k) && k >= 0))].sort((a, b) => a - b);
}
export function trace(model: Model, maximum: number): { readonly gains: readonly number[]; readonly branches: readonly [readonly Complex[], readonly Complex[]] } {
  validateModel(model);
  if (!Number.isFinite(maximum) || maximum < 0.01 || maximum > 100) fail('Use a gain window from 0.01 to 100.');
  const gains = [...new Set([...Array.from({ length: 241 }, (_, index) => maximum * index / 240), ...collisionGains(model).filter(k => k <= maximum && (k === 0 || k >= MIN_NONZERO))])].sort((a, b) => a - b);
  const sets = gains.map(k => rootsAt(model, k));
  return { gains, branches: [sets.map(set => set.roots[0]), sets.map(set => set.roots[1])] };
}

export interface PointTest { readonly kind: 'regular' | 'pole' | 'zero' | 'common' | 'near-singular'; readonly point: Complex; readonly gain?: Complex; readonly magnitudeGain?: number; readonly angle?: number; readonly vectorTotal?: number; readonly angleError?: number; readonly onLocus?: boolean }
export function testPoint(model: Model, point: Complex): PointTest {
  const m = validateModel(model);
  if (![point.re, point.im].every(Number.isFinite) || Math.max(Math.abs(point.re), Math.abs(point.im)) > 50) fail('Use finite candidate coordinates within ±50.');
  if ([point.re, point.im].some(value => value !== 0 && Math.abs(value) < MIN_NONZERO)) fail('Use 0 explicitly or candidate component magnitudes of at least 10⁻¹⁰⁰. Smaller components cannot be resolved reliably.');
  const d = denominator(m, point), b = numerator(m, point), dSize = magnitude(d), bSize = magnitude(b);
  if (dSize === 0 && bSize === 0) return { kind: 'common', point };
  if (dSize === 0) return { kind: 'pole', point };
  if (bSize === 0) return { kind: 'zero', point };
  if (bSize < 1e-12 * Math.max(1, Math.abs(m.b1) * magnitude(point), Math.abs(m.b0)) || dSize < 1e-12 * Math.max(1, magnitude(point) ** 2, Math.abs(m.a1) * magnitude(point), Math.abs(m.a0))) return { kind: 'near-singular', point };
  const ratio = divide(d, b), gain = { re: -ratio.re || 0, im: -ratio.im || 0 }, angle = phase(divide(b, d));
  const z = zero(m), fixedPhase = (m.b1 === 0 ? m.b0 : m.b1) < 0 ? Math.PI : 0;
  const vectorTotal = fixedPhase + (z ? phase(subtract(point, z)) : 0) - poles(m).reduce((sum, pole) => sum + phase(subtract(point, pole)), 0);
  const angleError = Math.abs(wrap(angle - Math.PI));
  return { kind: 'regular', point, gain, magnitudeGain: dSize / bSize, angle, vectorTotal, angleError, onLocus: gain.re > 0 && angleError <= ANGLE_TOLERANCE && Math.abs(gain.im) <= 1e-8 * Math.max(1, Math.abs(gain.re)) };
}
export function modalSamples(root: Complex, intervals: number): readonly number[] {
  if (![root.re, root.im].every(Number.isFinite) || magnitude(root) > 20000 || !Number.isInteger(intervals) || intervals < 4 || intervals > 30) fail('Modes support roots within radius 20000 and an integer horizon from 4 to 30.');
  const values = [1]; let value: Complex = { re: 1, im: 0 };
  for (let k = 1; k <= intervals; k++) {
    value = multiply(value, root);
    if (![value.re, value.im].every(Number.isFinite) || magnitude(value) > 1e150) fail('The selected modal horizon exceeds the supported amplitude range.');
    values.push(value.re || 0);
  }
  return values;
}
export function inverseMode(root: Complex, period: number): { readonly sigma: number; readonly omega: number } | null {
  if (![root.re, root.im].every(Number.isFinite) || magnitude(root) > 20000) fail('Use a finite root within radius 20000.');
  if (!Number.isFinite(period) || period < 0.001 || period > 10) fail('Use T from 0.001 to 10 seconds.');
  const radius = magnitude(root);
  return radius === 0 ? null : { sigma: Math.log(radius) / period, omega: phase(root) / period };
}
