import { add, divide, isZero, minus, numeric, one, over, same, times, trim, type Poly, type Rational } from './exact';
import { construct, evaluate, imaginaryPoles, response, validateModel, type Complex, type Construction, type Point, type Segment } from './nyquist';
import { numericRoots, type Root } from './roots';

/** Exact Routh counts for real polynomials through degree three. Axis factors
 * are counted separately, including zero rows and repeated origin roots. */
export function counts(input: Poly): { rhp: number; axis: number } {
  let p = trim(input), axis = 0;
  if (isZero(p) || p.length > 4) throw new Error('Pole counts need a nonzero polynomial of degree at most three.');
  while (p.length > 1 && p[0].n === 0n) { axis++; p = p.slice(1); }
  if (p.length === 1) return { rhp: 0, axis };
  p = p.map(c => over(c, p.at(-1)!));
  const sign = (x: Rational) => x.n < 0n ? -1 : x.n > 0n ? 1 : 0;
  const changes = (v: number[]) => v.slice(1).reduce((n, s, i) => n + Number(s !== v[i]), 0);
  if (p.length === 2) return { rhp: Number(sign(p[0]) < 0), axis };
  if (p.length === 3) {
    if (!p[1].n) return { rhp: Number(p[0].n < 0n), axis: axis + (p[0].n > 0n ? 2 : 0) };
    return { rhp: changes([1, sign(p[1]), sign(p[0])]), axis };
  }
  if (!p[2].n) return { rhp: p[0].n > 0n ? 2 : 1, axis };
  const b = minus(times(p[2], p[1]), p[0]);
  if (!b.n) return { rhp: Number(p[2].n < 0n) + Number(p[1].n < 0n), axis: axis + (p[1].n > 0n ? 2 : 0) };
  return { rhp: changes([1, sign(p[2]), sign(b) * sign(p[2]), sign(p[0])]), axis };
}

function common(a: Poly, b: Poly): Poly {
  for (let i = 0; !isZero(b) && i < 6; i++) { const r = divide(a, b).remainder; a = b; b = r; }
  return trim(a);
}
export interface Loop {
  readonly n: Poly; readonly d: Poly; readonly characteristic: Poly;
  readonly open: ReturnType<typeof counts>; readonly closed: ReturnType<typeof counts>;
  readonly openRoots: readonly Root[]; readonly closedRoots: readonly Root[];
  readonly radiusBound: number;
}
function roots(p: Poly, expected: ReturnType<typeof counts>): Root[] {
  const result = numericRoots(p.map(numeric));
  const axis = imaginaryPoles({ n: [one], d: p });
  const onAxis = (z: Root) => axis.some(a => Math.hypot(z.re, z.im - a.frequency) < 1e-7 * Math.max(1, Math.abs(a.frequency)));
  if (result.filter(z => !onAxis(z) && z.re > 0).length !== expected.rhp || result.filter(onAxis).length !== expected.axis) throw new Error('Root positions and exact Routh counts disagree at this numerical scale. Rescale or separate the roots.');
  return result;
}
export function compose(n: Poly, d: Poly, controller: Rational, sensor: Rational): Loop {
  if (Math.abs(numeric(controller)) < .05 || Math.abs(numeric(controller)) > 50 || numeric(sensor) < .05 || numeric(sensor) > 20) throw new Error('Use controller magnitude 0.05–50 and positive sensor gain H from 0.05–20.');
  const plant = validateModel(n, d);
  if (isZero(plant.n)) throw new Error('Use a nonzero plant numerator.');
  if (common(plant.n, plant.d).length > 1) throw new Error('Use a coprime plant numerator and denominator. Common factors are outside this exercise; RHP/axis cancellations can hide modes and cannot establish internal stability.');
  const loop = validateModel(plant.n.map(c => times(times(c, controller), sensor)), plant.d);
  const characteristic = add(loop.d, loop.n);
  if (characteristic.length !== loop.d.length) throw new Error('The direct feedback term makes 1+C H G(∞)=0. This algebraic loop is not well posed in the supported model.');
  const normalized = characteristic.map(c => over(c, characteristic.at(-1)!));
  if (normalized.some(c => Math.abs(numeric(c)) > 1e6)) throw new Error('Feedback polynomial coefficients are too large after normalization. Rescale the loop.');
  const open = counts(loop.d), closed = counts(characteristic);
  // Minimum of Cauchy and conservative Fujiwara bounds: every root is inside.
  const bound = (p: Poly) => {
    const coefficients = p.slice(0, -1).map(c => Math.abs(numeric(over(c, p.at(-1)!))));
    return Math.min(1 + Math.max(...coefficients), 2 * Math.max(...coefficients.map((v, i) => v ** (1 / (p.length - 1 - i)))));
  };
  return { ...loop, characteristic, open, closed, openRoots: roots(loop.d, open), closedRoots: roots(characteristic, closed), radiusBound: Math.max(bound(loop.d), bound(characteristic)) };
}

const norm = (z: Complex) => Math.hypot(z.re, z.im);
const sub = (a: Complex, b: Complex): Complex => ({ re: a.re - b.re, im: a.im - b.im });
const angle = (a: Complex, b: Complex) => Math.atan2(a.re * b.im - a.im * b.re, a.re * b.re + a.im * b.im);
function f(loop: Loop, z: Complex): Complex {
  // Evaluate (D+N)/D directly, avoiding cancellation in floating-point 1+L.
  const a = evaluate(loop.characteristic, z).value, b = evaluate(loop.d, z).value, q = b.re * b.re + b.im * b.im;
  const value = { re: (a.re * b.re + a.im * b.im) / q, im: (a.im * b.re - a.re * b.im) / q };
  if (!Number.isFinite(norm(value)) || norm(value) < 1e-9) throw new Error('The curve is too close to −1 to resolve its winding. Move away from the boundary or rescale the loop.');
  return value;
}

/** Taylor's finite polynomial expansion bounds its image in a disk. If that
 * disk excludes zero, the change in argument is at most 2 asin(radius/center).
 * Padding 1e-12 times the coefficient scale covers floating arithmetic here;
 * this is a guarded numerical calculation, not an interval-arithmetic proof. */
export function argumentBound(p: Poly, center: Complex, radius: number): number {
  let variation = 0;
  for (let k = 1; k < p.length; k++) {
    const derivative = p.slice(k).map((c, j) => {
      let choose = 1; for (let t = 1; t <= k; t++) choose *= (j + t) / t;
      return times(c, { n: BigInt(Math.round(choose)), d: 1n });
    });
    variation += norm(evaluate(derivative, center).value) * radius ** k;
  }
  const scale = p.reduce((sum, c, i) => sum + Math.abs(numeric(c)) * (norm(center) + radius) ** i, 0);
  const error = 1e-12 * scale, ratio = (variation + error) / (norm(evaluate(p, center).value) - error);
  return ratio >= 0 && ratio < 1 ? 2 * Math.asin(ratio) : Infinity;
}
function midpoint(a: Complex, b: Complex, segment: Segment, contour: Construction): { value: Complex; length: number } {
  if (segment.kind.endsWith('axis')) return { value: { re: 0, im: (a.im + b.im) / 2 }, length: Math.abs(b.im - a.im) };
  const origin = segment.pole?.frequency ?? 0, radius = segment.kind === 'indent' ? contour.epsilon : contour.radius;
  const first = Math.atan2(a.im - origin, a.re), last = Math.atan2(b.im - origin, b.re), theta = (first + last) / 2;
  return { value: { re: radius * Math.cos(theta), im: origin + radius * Math.sin(theta) }, length: radius * Math.abs(last - first) };
}
export interface Winding { readonly n: number; readonly turns: number; readonly points: readonly Point[]; readonly phase: readonly number[]; readonly maxBound: number }
/** Stateless compatible extension of CP05's Construction/Point contract.
 * It counts the mapped curve, never deriving N from P−Z or root signs. */
export function winding(loop: Loop, contour: Construction, limit = 32768): Winding {
  if (!same(loop.n, contour.model.n) || !same(loop.d, contour.model.d)) throw new Error('The contour and loop must use the same coefficients. Construct this loop’s own curve.');
  if (!Number.isInteger(limit) || limit < 16 || limit > 32768) throw new Error('Use a contour work limit from 16 to 32768.');
  const points: Point[] = [], phase: number[] = []; let total = 0, maxBound = 0, evaluations = 0;
  function visit(a: Complex, b: Complex, segment: Segment, depth: number) {
    if (++evaluations > limit || depth > 30) throw new Error('The contour winding did not resolve within the point/depth limit. Change the contour or separate the near-boundary model.');
    const mid = midpoint(a, b, segment, contour);
    const bound = argumentBound(loop.characteristic, mid.value, mid.length / 2) + argumentBound(loop.d, mid.value, mid.length / 2);
    const fa = f(loop, a), fb = f(loop, b), ra = response(loop, a), rb = response(loop, b), rm = response(loop, mid.value);
    if (ra.kind !== 'value' || rb.kind !== 'value' || rm.kind !== 'value') throw new Error('A mapped contour segment is numerically undefined. Rescale the loop/contour.');
    const chordMid = { re: (ra.value.re + rb.value.re) / 2, im: (ra.value.im + rb.value.im) / 2 };
    const curved = norm(sub(rm.value, chordMid)) > .004 * Math.max(1, norm(ra.value), norm(rb.value), norm(rm.value));
    if (bound >= Math.PI / 3 || curved) { visit(a, mid.value, segment, depth + 1); visit(mid.value, b, segment, depth + 1); return; }
    maxBound = Math.max(maxBound, bound); total += angle(fa, fb);
    points.push({ source: b, response: rb, kind: segment.kind }); phase.push(total);
  }
  for (const segment of contour.segments) {
    if (!points.length) { points.push(segment.points[0]); phase.push(0); }
    for (let i = 1; i < segment.points.length; i++) visit(segment.points[i - 1].source, segment.points[i].source, segment, 0);
  }
  const turns = total / (2 * Math.PI), n = Math.round(turns) || 0;
  if (Math.abs(turns - n) > 1e-7) throw new Error('The completed curve did not produce a resolved integer winding.');
  return { n, turns, points, phase, maxBound };
}
export type Analysis = { readonly contour: Construction; readonly kind: 'boundary'; readonly message: string }
  | { readonly contour: Construction; readonly kind: 'unresolved'; readonly message: string }
  | { readonly contour: Construction; readonly kind: 'stable' | 'unstable'; readonly winding: Winding; readonly confirmation: Winding; readonly z: number };
export function analyze(loop: Loop, radius: number, epsilon: number): Analysis {
  const contour = construct(loop.n, loop.d, radius, epsilon);
  if (loop.closed.axis) {
    const frequencies = imaginaryPoles({ n: [one], d: loop.characteristic }).map(p => p.frequency);
    const segments = contour.segments.map(segment => {
      if (!segment.kind.endsWith('axis')) return segment;
      const start = segment.points[0].source.im, end = segment.points.at(-1)!.source.im;
      const w = [...new Set([...segment.points.map(p => p.source.im), ...frequencies.filter(v => v >= start && v <= end)])].sort((a, b) => a - b);
      return { ...segment, points: w.map(im => { const source = { re: 0, im }; return { source, response: response(loop, source), kind: segment.kind }; }) };
    });
    return { contour: { ...contour, segments, points: segments.flatMap(s => s.points) }, kind: 'boundary', message: `The ordinary imaginary-axis response reaches −1 at ω=${frequencies.map(v => v.toPrecision(7)).join(', ')} rad/s. No N is reported for this boundary case; the finite view can omit or bypass that frequency. Imaginary-axis closed-loop roots do not establish strict stability.` };
  }
  try {
    if (radius <= 1.05 * loop.radiusBound) throw new Error(`R is too small for this complete-root bound. Use R greater than ${(1.05 * loop.radiusBound).toPrecision(6)} (maximum 10000). A finite partial contour cannot give the full RHP count.`);
    for (const pole of contour.axisPoles) {
      if (!Number.isFinite(argumentBound(loop.characteristic, { re: 0, im: pole.frequency }, epsilon))) throw new Error('Cannot confirm that every indent disk is free of closed-loop roots. Reduce ε before using this count.');
    }
    const result = winding(loop, contour), nextR = radius < 5000 ? radius * 2 : radius / 1.01;
    const nextE = epsilon > .00002 ? epsilon / 2 : epsilon * 1.01;
    if (nextR <= 1.05 * loop.radiusBound || nextE > 1 || nextE >= nextR / 4) throw new Error('No second safe contour fits the supported limits. Move R/ε away from their limits.');
    const confirmationContour = construct(loop.n, loop.d, nextR, nextE);
    for (const pole of confirmationContour.axisPoles) if (!Number.isFinite(argumentBound(loop.characteristic, { re: 0, im: pole.frequency }, nextE))) throw new Error('The second indentation cannot be checked as free of closed-loop roots. Reduce ε.');
    const confirmation = winding(loop, confirmationContour), z = loop.open.rhp - result.n;
    if (confirmation.n !== result.n || z !== loop.closed.rhp) throw new Error('Contour convergence, winding and independent exact Routh counts do not agree. No stability conclusion is reported.');
    return { contour, kind: z === 0 ? 'stable' : 'unstable', winding: result, confirmation, z };
  } catch (error) { return { contour, kind: 'unresolved', message: error instanceof Error ? error.message : 'Contour count unresolved.' }; }
}
