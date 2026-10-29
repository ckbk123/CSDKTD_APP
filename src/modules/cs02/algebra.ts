/** Bounded private rational/polynomial arithmetic. Arrays use ascending powers. */
export interface Q { readonly n: bigint; readonly d: bigint }
const abs = (n: bigint) => n < 0n ? -n : n;
export function q(n: number | bigint, d: number | bigint = 1): Q {
  let a = BigInt(n), b = BigInt(d);
  if (!b) throw new Error('A fraction cannot divide by zero.');
  if (b < 0n) { a = -a; b = -b; }
  if (abs(a).toString(2).length > 4096 || b.toString(2).length > 4096) throw new Error('Exact precision limit reached. Simplify the coefficients.');
  let x = abs(a), y = b; while (y) { const r = x % y; x = y; y = r; }
  return { n: a / x, d: b / x };
}
export const Z = q(0), U = q(1);
export const addQ = (a: Q, b: Q) => q(a.n * b.d + b.n * a.d, a.d * b.d);
export const subQ = (a: Q, b: Q) => q(a.n * b.d - b.n * a.d, a.d * b.d);
export const mulQ = (a: Q, b: Q) => q(a.n * b.n, a.d * b.d);
export const divQ = (a: Q, b: Q) => q(a.n * b.d, a.d * b.n);
export const negQ = (a: Q) => q(-a.n, a.d);
export const signQ = (a: Q) => a.n < 0n ? -1 : a.n > 0n ? 1 : 0;
export const equalQ = (a: Q, b: Q) => a.n === b.n && a.d === b.d;
export const textQ = (a: Q) => a.d === 1n ? String(a.n) : `${a.n}/${a.d}`;
export const latexQ = (a: Q) => a.d === 1n ? String(a.n) : `${a.n < 0n ? '-' : ''}\\frac{${abs(a.n)}}{${a.d}}`;
export function fromNumber(value: number): Q {
  if (!Number.isFinite(value)) throw new Error('Enter a finite number.');
  const [mantissa, exponent = '0'] = String(value).split('e');
  const places = (mantissa.split('.')[1]?.length ?? 0) - Number(exponent), digits = BigInt(mantissa.replace('.', ''));
  return places >= 0 ? q(digits, 10n ** BigInt(places)) : q(digits * 10n ** BigInt(-places));
}

export type Poly = readonly Q[];
export function trim(p: Poly): Q[] {
  let end = p.length; while (end > 1 && !p[end - 1].n) end--;
  const out = p.slice(0, end); if (!out.length) out.push(Z);
  if (out.length > 33) throw new Error('Symbolic polynomial degree limit reached. Simplify the model.');
  return out;
}
export const zeroP = (p: Poly) => p.every(c => !c.n);
export const degree = (p: Poly) => zeroP(p) ? -1 : trim(p).length - 1;
export function addP(a: Poly, b: Poly, subtract = false): Q[] {
  return trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => subtract ? subQ(a[i] ?? Z, b[i] ?? Z) : addQ(a[i] ?? Z, b[i] ?? Z)));
}
export const scaleP = (p: Poly, factor: Q) => trim(p.map(c => mulQ(c, factor)));
export function mulP(a: Poly, b: Poly): Q[] {
  if (zeroP(a) || zeroP(b)) return [Z];
  if (degree(a) + degree(b) > 32) throw new Error('Symbolic polynomial degree limit reached. Simplify the model.');
  const out = Array.from({ length: a.length + b.length - 1 }, () => Z);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] = addQ(out[i + j], mulQ(a[i], b[j]));
  return trim(out);
}
export function divideP(numerator: Poly, denominator: Poly) {
  const divisor = trim(denominator); if (zeroP(divisor)) throw new Error('Polynomial division by zero.');
  let remainder = trim(numerator); const quotient = Array.from({ length: Math.max(1, degree(remainder) - degree(divisor) + 1) }, () => Z);
  for (let steps = 0; degree(remainder) >= degree(divisor); steps++) {
    if (steps > 32) throw new Error('Polynomial division did not reduce its degree.');
    const shift = degree(remainder) - degree(divisor), factor = divQ(remainder[remainder.length - 1], divisor[divisor.length - 1]);
    quotient[shift] = addQ(quotient[shift], factor);
    remainder = addP(remainder, [...Array.from({ length: shift }, () => Z), ...scaleP(divisor, factor)], true);
  }
  return { quotient: trim(quotient), remainder };
}
export function monicP(p: Poly): Q[] { const a = trim(p); return zeroP(a) ? [Z] : scaleP(a, divQ(U, a[a.length - 1])); }
export function gcdP(a: Poly, b: Poly): Q[] {
  let x = trim(a), y = trim(b);
  for (let steps = 0; !zeroP(y); steps++) {
    if (steps > 33) throw new Error('Polynomial GCD did not converge.');
    const remainder = divideP(x, y).remainder; x = y; y = remainder;
  }
  return monicP(x);
}
export const derivativeP = (p: Poly) => trim(p.slice(1).map((c, i) => mulQ(c, q(i + 1))));
export function evaluateP(p: Poly, x: Q): Q { let out = Z; for (let i = p.length - 1; i >= 0; i--) out = addQ(mulQ(out, x), p[i]); return out; }
export function formatP(p: Poly, variable: string, latex = false): string {
  let out = '';
  for (let i = p.length - 1; i >= 0; i--) {
    const coefficient = p[i]; if (!coefficient.n) continue;
    const magnitude = q(abs(coefficient.n), coefficient.d);
    out += out ? coefficient.n < 0n ? '-' : '+' : coefficient.n < 0n ? '-' : '';
    out += i && equalQ(magnitude, U) ? '' : latex ? latexQ(magnitude) : textQ(magnitude);
    out += i ? variable + (i > 1 ? latex ? `^{${i}}` : `^${i}` : '') : '';
  }
  return out || '0';
}

/** Rational functions of a positive infinitesimal epsilon; no numeric epsilon. */
export interface RF { readonly n: Poly; readonly d: Poly }
export function rf(n: Poly, d: Poly = [U]): RF {
  const numerator = trim(n), denominator = trim(d);
  if (zeroP(denominator)) throw new Error('Symbolic division by zero.');
  if (zeroP(numerator)) return { n: [Z], d: [U] };
  const common = gcdP(numerator, denominator), top = divideP(numerator, common).quotient, bottom = divideP(denominator, common).quotient;
  const normalize = divQ(U, bottom[bottom.length - 1]);
  return { n: scaleP(top, normalize), d: scaleP(bottom, normalize) };
}
export const constantRF = (value: Q): RF => ({ n: [value], d: [U] });
export const EPS = rf([Z, U]);
export const zeroRF = (a: RF) => zeroP(a.n);
export const addRF = (a: RF, b: RF) => rf(addP(mulP(a.n, b.d), mulP(b.n, a.d)), mulP(a.d, b.d));
export const subRF = (a: RF, b: RF) => rf(addP(mulP(a.n, b.d), mulP(b.n, a.d), true), mulP(a.d, b.d));
export const mulRF = (a: RF, b: RF) => rf(mulP(a.n, b.n), mulP(a.d, b.d));
export const divRF = (a: RF, b: RF) => rf(mulP(a.n, b.d), mulP(a.d, b.n));
export function constantOf(a: RF): Q | null { return degree(a.n) <= 0 && degree(a.d) === 0 ? divQ(a.n[0], a.d[0]) : null; }
export function limitRF(a: RF): { kind: 'finite'; value: Q; sign: number } | { kind: 'infinite'; sign: number } {
  if (zeroRF(a)) return { kind: 'finite', value: Z, sign: 0 };
  const top = a.n.findIndex(c => c.n !== 0n), bottom = a.d.findIndex(c => c.n !== 0n), sign = signQ(a.n[top]) * signQ(a.d[bottom]);
  if (top < bottom) return { kind: 'infinite', sign };
  return { kind: 'finite', value: top > bottom ? Z : divQ(a.n[top], a.d[bottom]), sign };
}
export function latexRF(a: RF): string {
  if (degree(a.d) === 0) return formatP(scaleP(a.n, divQ(U, a.d[0])), '\\varepsilon', true);
  return `\\frac{${formatP(a.n, '\\varepsilon', true)}}{${formatP(a.d, '\\varepsilon', true)}}`;
}

const variations = (signs: readonly number[]) => { const nonzero = signs.filter(Boolean); return nonzero.slice(1).filter((s, i) => s !== nonzero[i]).length; };
/** Sturm signs at 0+ and +infinity, so roots at zero are excluded. */
export function positiveDistinctRoots(p: Poly): number {
  const first = monicP(p); if (degree(first) <= 0) return 0;
  const sequence = [first, derivativeP(first)];
  while (!zeroP(sequence[sequence.length - 1])) {
    if (sequence.length > 34) throw new Error('Sturm sequence exceeded its degree bound.');
    const remainder = scaleP(divideP(sequence[sequence.length - 2], sequence[sequence.length - 1]).remainder, q(-1));
    if (zeroP(remainder)) break;
    const lead = remainder[remainder.length - 1]; sequence.push(scaleP(remainder, divQ(U, q(abs(lead.n), lead.d))));
  }
  const atZero = sequence.map(poly => signQ(poly.find(c => c.n !== 0n) ?? Z));
  const atInfinity = sequence.map(poly => signQ(poly[poly.length - 1]));
  return variations(atZero) - variations(atInfinity);
}
export function positiveRootsWithMultiplicity(p: Poly): number {
  let current = trim(p), count = 0;
  for (let pass = 0; degree(current) > 0; pass++) {
    if (pass > 32) throw new Error('Root multiplicity exceeded its degree bound.');
    count += positiveDistinctRoots(current); current = gcdP(current, derivativeP(current));
  }
  return count;
}
/** Exact imaginary-axis multiplicity of a real polynomial, including the origin. */
export function axisMultiplicity(p: Poly): number {
  let origin = 0; while (origin < p.length && !p[origin].n) origin++;
  if (origin === p.length) throw new Error('The zero polynomial has no finite root count.');
  const nonzero = p.slice(origin), even = nonzero.filter((_c, i) => i % 2 === 0).map((c, i) => i % 2 ? negQ(c) : c);
  const odd = nonzero.filter((_c, i) => i % 2 === 1).map((c, i) => i % 2 ? negQ(c) : c);
  const common = gcdP(even, odd.length ? odd : [Z]);
  return origin + 2 * positiveRootsWithMultiplicity(common);
}
/** A(s)=s^parity B(s²): classify symmetric real/axis pairs and complex quartets. */
export function symmetricClassification(p: Poly) {
  const polynomial = trim(p); if (zeroP(polynomial)) throw new Error('An auxiliary polynomial cannot be zero.');
  const parity = degree(polynomial) % 2;
  if (polynomial.some((c, i) => c.n && i % 2 !== parity)) throw new Error('Auxiliary powers must have one parity.');
  const half = trim(polynomial.filter((_c, i) => i % 2 === parity));
  let originPairs = 0; while (originPairs < half.length && !half[originPairs].n) originPairs++;
  const origin = parity + 2 * originPairs, realPairs = positiveRootsWithMultiplicity(half);
  const imaginaryPairs = positiveRootsWithMultiplicity(half.map((c, i) => i % 2 ? negQ(c) : c));
  const remaining = degree(polynomial) - origin - 2 * realPairs - 2 * imaginaryPairs;
  if (remaining < 0 || remaining % 4) throw new Error('Auxiliary root classification failed its degree check.');
  return { origin, realPairs, imaginaryPairs, complexQuartets: remaining / 4 };
}
