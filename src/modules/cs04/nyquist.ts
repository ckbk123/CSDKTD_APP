import { divide, isZero, minus, numeric, one, over, times, validatePolynomial, zero, type Poly, type Rational } from './exact';
import { numericRoots, type Root } from './roots';

export interface Complex { readonly re: number; readonly im: number }
export interface Model { readonly n: Poly; readonly d: Poly }
export type Response = { readonly kind: 'value'; readonly value: Complex; readonly magnitude: number; readonly phase: number | null; readonly db: number | null } | { readonly kind: 'undefined'; readonly message: string };
export type Kind = 'positive-axis' | 'negative-axis' | 'indent' | 'outer-arc';
export interface Point { readonly source: Complex; readonly response: Response; readonly kind: Kind }
export interface AxisPole { readonly frequency: number; readonly square: Rational; readonly multiplicity: number; readonly numeratorOrder: number | null; readonly unboundedOrder: number; readonly extension?: Complex }
export interface Segment { readonly kind: Kind; readonly points: readonly Point[]; readonly pole?: AxisPole }
export interface Construction { readonly model: Model; readonly radius: number; readonly epsilon: number; readonly poles: readonly Root[]; readonly axisPoles: readonly AxisPole[]; readonly outsideAxis: readonly AxisPole[]; readonly segments: readonly Segment[]; readonly points: readonly Point[]; readonly outerLimit: Rational; readonly decayOrder: number | null }
const mul = (a: Complex, b: Complex): Complex => ({ re: a.re * b.re - a.im * b.im, im: a.re * b.im + a.im * b.re });
export function evaluate(p: Poly, z: Complex): { value: Complex; scale: number } {
  let value: Complex = { re: 0, im: 0 }, scale = 0;
  for (let i = p.length - 1; i >= 0; i--) { const product = mul(value, z); value = { re: product.re + numeric(p[i]), im: product.im }; scale = scale * Math.hypot(z.re, z.im) + Math.abs(numeric(p[i])); }
  return { value, scale };
}
function quotient(a: Complex, b: Complex): Complex { const norm = b.re * b.re + b.im * b.im; return { re: (a.re * b.re + a.im * b.im) / norm, im: (a.im * b.re - a.re * b.im) / norm }; }
export function response(model: Model, z: Complex): Response {
  if (![z.re, z.im].every(Number.isFinite)) throw new Error('Choose finite source coordinates.');
  const n = evaluate(model.n, z), d = evaluate(model.d, z);
  if (Math.hypot(d.value.re, d.value.im) <= 1e-10 * d.scale) return { kind: 'undefined', message: 'The denominator is zero or unresolved at this numerical scale. The original expression has no reported finite value here.' };
  const value = quotient(n.value, d.value), magnitude = Math.hypot(value.re, value.im);
  if (!Number.isFinite(magnitude)) return { kind: 'undefined', message: 'The mapped value exceeded numerical range. Rescale the model or contour.' };
  const isZeroValue = Math.hypot(n.value.re, n.value.im) <= 1e-14 * n.scale;
  return { kind: 'value', value, magnitude, phase: isZeroValue ? null : Math.atan2(value.im, value.re), db: isZeroValue ? null : 20 * Math.log10(magnitude) };
}
export function validateModel(n: Poly, d: Poly): Model {
  n = validatePolynomial(n, true); d = validatePolynomial(d);
  if (d.length < 2 || d.length > 4 || n.length > d.length) throw new Error('Use a proper real rational model: denominator degree1–3 and numerator degree no larger than the denominator.');
  const lead = d.at(-1)!, model = { n: n.map(c => over(c, lead)), d: d.map(c => over(c, lead)) };
  if ([...model.n, ...model.d].some(c => Math.abs(numeric(c)) > 1e6)) throw new Error('Normalized coefficient magnitude must be at most1,000,000.');
  return model;
}
function removeFactor(p: Poly, factor: Poly): { order: number | null; rest: Poly } {
  if (isZero(p)) return { order: null, rest: [zero] };
  let order = 0, rest = p;
  while (rest.length >= factor.length) { const result = divide(rest, factor); if (!isZero(result.remainder)) break; order++; rest = result.quotient; }
  return { order, rest };
}
/** Exact imaginary-axis denominator roots through degree3. A nonzero pair
 * satisfies d0*d3=d2*d1 and omega²=d1/d3, or d1=0 for a quadratic. */
export function imaginaryPoles(model: Model): AxisPole[] {
  const d = model.d, seeds: { frequency: number; square: Rational; factor: Poly }[] = [];
  if (d[0].n === 0n) seeds.push({ frequency: 0, square: zero, factor: [zero, one] });
  let square: Rational | undefined;
  if (d.length === 3 && d[1].n === 0n) square = over(d[0], d[2]);
  if (d.length === 4 && minus(times(d[0], d[3]), times(d[2], d[1])).n === 0n) square = over(d[1], d[3]);
  if (square && square.n > 0n) for (const sign of [-1, 1]) seeds.push({ frequency: sign * Math.sqrt(numeric(square)), square, factor: [square, zero, one] });
  return seeds.map(seed => {
    const denominator = removeFactor(d, seed.factor), numerator = removeFactor(model.n, seed.factor), order = numerator.order === null ? 0 : Math.max(0, denominator.order! - numerator.order);
    let extension: Complex | undefined;
    if (!order) extension = numerator.order === null || numerator.order! > denominator.order! ? { re: 0, im: 0 } : quotient(evaluate(numerator.rest, { re: 0, im: seed.frequency }).value, evaluate(denominator.rest, { re: 0, im: seed.frequency }).value);
    return { frequency: seed.frequency, square: seed.square, multiplicity: denominator.order!, numeratorOrder: numerator.order, unboundedOrder: order, extension };
  }).sort((a, b) => a.frequency - b.frequency);
}
/** Finite clockwise RHP contour, upward imaginary axis with right-half-plane
 * indent semicircles; outer arc returns from+jR to-jR. No stability count. */
export function construct(n: Poly, d: Poly, radius: number, epsilon: number): Construction {
  const model = validateModel(n, d);
  if (!Number.isFinite(radius) || radius < .01 || radius > 10000) throw new Error('Choose contour radius R from0.01 to10,000 in the units of s.');
  if (!Number.isFinite(epsilon) || epsilon < .00001 || epsilon > 1 || epsilon >= radius / 4) throw new Error('Choose indent radius ε from0.00001 to1, and smaller than R/4.');
  const poles = numericRoots(model.d.map(numeric)), axisPoles = imaginaryPoles(model), inside = axisPoles.filter(p => Math.abs(p.frequency) < radius);
  if (axisPoles.some(p => Math.abs(Math.abs(p.frequency) - radius) <= epsilon)) throw new Error('An axis denominator root is too close to a contour endpoint. Increase/change R so the indent fits.');
  for (const pole of poles) if (pole.re >= -1e-9 && Math.abs(Math.hypot(pole.re, pole.im) - radius) <= 1e-8 * Math.max(1, radius)) throw new Error('The outer semicircle meets or nearly meets a denominator root. Change R.');
  inside.forEach((axis, i) => {
    if (i && axis.frequency - inside[i - 1].frequency <= 2 * epsilon) throw new Error('Axis indents overlap. Reduce ε.');
    for (const pole of poles) { const distance = Math.hypot(pole.re, pole.im - axis.frequency); if (distance > 1e-7 * Math.max(1, Math.abs(axis.frequency)) && epsilon >= .45 * distance) throw new Error('An indent is too close to another denominator root. Reduce ε.'); }
  });
  const segments: Segment[] = [];
  function segment(kind: Kind, sources: Complex[], pole?: AxisPole) { segments.push({ kind, points: sources.map(source => ({ source, response: response(model, source), kind })), pole }); }
  function axis(a: number, b: number) {
    if (a >= b) return; if (a < 0 && b > 0) { axis(a, 0); axis(0, b); return; }
    segment(b <= 0 ? 'negative-axis' : 'positive-axis', Array.from({ length: 65 }, (_, i) => ({ re: 0, im: a + (b - a) * i / 64 })));
  }
  let start = -radius;
  for (const pole of inside) {
    axis(start, pole.frequency - epsilon);
    segment('indent', Array.from({ length: 65 }, (_, i) => i === 0 ? { re: 0, im: pole.frequency - epsilon } : i === 64 ? { re: 0, im: pole.frequency + epsilon } : { re: epsilon * Math.cos(-Math.PI / 2 + Math.PI * i / 64), im: pole.frequency + epsilon * Math.sin(-Math.PI / 2 + Math.PI * i / 64) }), pole);
    start = pole.frequency + epsilon;
  }
  axis(start, radius);
  segment('outer-arc', Array.from({ length: 129 }, (_, i) => i === 0 ? { re: 0, im: radius } : i === 128 ? { re: 0, im: -radius } : { re: radius * Math.cos(Math.PI / 2 - Math.PI * i / 128), im: radius * Math.sin(Math.PI / 2 - Math.PI * i / 128) }));
  const points = segments.flatMap(s => s.points);
  if (points.length > 1200) throw new Error('Contour sample limit exceeded.');
  return { model, radius, epsilon, poles, axisPoles, outsideAxis: axisPoles.filter(p => Math.abs(p.frequency) > radius), segments, points, outerLimit: model.n.length === model.d.length ? model.n.at(-1)! : zero, decayOrder: isZero(model.n) ? null : model.d.length - model.n.length };
}
export function atFrequency(contour: Construction, frequency: number): { contourPoint: Point; bode: Response; indented: boolean } {
  if (!Number.isFinite(frequency) || Math.abs(frequency) > contour.radius) throw new Error('Choose a finite frequency within−R to+R.');
  const indent = contour.axisPoles.find(p => Math.abs(frequency - p.frequency) < contour.epsilon && Math.abs(p.frequency) < contour.radius);
  const source = indent ? { re: Math.sqrt(Math.max(0, contour.epsilon ** 2 - (frequency - indent.frequency) ** 2)), im: frequency } : { re: 0, im: frequency };
  return { contourPoint: { source, response: response(contour.model, source), kind: indent ? 'indent' : frequency < 0 ? 'negative-axis' : 'positive-axis' }, bode: response(contour.model, { re: 0, im: frequency }), indented: !!indent };
}
export function frequencySamples(contour: Construction): { frequency: number; response: Response }[] {
  // Include exact numerator-axis zeros too, so a sampled phase trace does not
  // bridge a known zero merely because it falls between logarithmic samples.
  const zeros = !isZero(contour.model.n) && contour.model.n.length > 1 ? imaginaryPoles({ n: [one], d: contour.model.n }) : [];
  const frequencies = [0, ...Array.from({ length: 241 }, (_, i) => contour.radius * 1e-4 * 10 ** (4 * i / 240)), ...[...contour.axisPoles, ...zeros].filter(p => p.frequency > 0 && p.frequency < contour.radius).map(p => p.frequency)];
  return [...new Set(frequencies)].sort((a, b) => a - b).map(frequency => ({ frequency, response: response(contour.model, { re: 0, im: frequency }) }));
}
