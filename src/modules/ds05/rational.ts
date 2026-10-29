/** Bounded exact arithmetic for DS05 coefficients and root/count identities, not a CAS. */
export interface Rational { readonly n: bigint; readonly d: bigint }
const MAX_BITS = 4096;
export const ZERO: Rational = Object.freeze({ n: 0n, d: 1n });
export const ONE: Rational = Object.freeze({ n: 1n, d: 1n });
const abs = (n: bigint): bigint => n < 0n ? -n : n;
function gcd(a: bigint, b: bigint): bigint { while (b) { const r = a % b; a = b; b = r; } return a; }
export function rational(n: bigint, d = 1n): Rational {
  if (!d) throw new Error('A fraction cannot have a zero denominator.');
  if (abs(n).toString(2).length > 2 * MAX_BITS || abs(d).toString(2).length > 2 * MAX_BITS) throw new Error('Exact coefficient work exceeds its bounded digit budget. Simplify the numbers.');
  if (!n) return ZERO;
  if (d < 0n) { n = -n; d = -d; }
  const common = gcd(abs(n), d); n /= common; d /= common;
  if (abs(n).toString(2).length > MAX_BITS || d.toString(2).length > MAX_BITS) throw new Error('Exact coefficients support at most 4096 bits per numerator and denominator. Simplify the numbers.');
  return { n, d };
}
export const add = (a: Rational, b: Rational): Rational => rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const neg = (a: Rational): Rational => rational(-a.n, a.d);
export const sub = (a: Rational, b: Rational): Rational => add(a, neg(b));
export const mul = (a: Rational, b: Rational): Rational => rational(a.n * b.n, a.d * b.d);
export const div = (a: Rational, b: Rational): Rational => rational(a.n * b.d, a.d * b.n);
export const compare = (a: Rational, b: Rational): number => { const value = a.n * b.d - b.n * a.d; return value < 0n ? -1 : value > 0n ? 1 : 0; };

/** Exponent syntax is opt-in, solely for already validated native number controls. */
export function decimal(text: string, nativeExponent = false): Rational {
  if (text.length > 1200) throw new Error('Use a shorter numeric coefficient.');
  const match = /^([+-]?)(?:(\d+)(?:\.(\d*))?|\.(\d+))(?:[eE]([+-]?\d+))?$/.exec(text);
  if (!match || (!nativeExponent && match[5] !== undefined)) throw new Error('Use a decimal numeric literal; e/E is not a scientific shortcut in visual equations.');
  const fraction = match[3] ?? match[4] ?? '';
  const digits = (match[2] ?? '0') + fraction;
  if (!/[1-9]/.test(digits)) return ZERO; // Intentional 0e-999 remains exactly zero.
  const exponent = Number(match[5] ?? 0);
  if (!Number.isInteger(exponent) || Math.abs(exponent) > 1200) throw new Error('The numeric exponent exceeds the exact coefficient budget.');
  const scale = exponent - fraction.length;
  const n = BigInt(digits) * (match[1] === '-' ? -1n : 1n);
  return scale >= 0 ? rational(n * 10n ** BigInt(scale)) : rational(n, 10n ** BigInt(-scale));
}

/** Conversion for a separately labelled numerical trace; never used to test exact zero. */
export function toNumber(value: Rational, allowUnderflow = false): number {
  if (!value.n) return 0;
  const ordinaryNumerator = Number(value.n), ordinaryDenominator = Number(value.d);
  if (Number.isFinite(ordinaryNumerator) && Number.isFinite(ordinaryDenominator)) {
    const ordinary = ordinaryNumerator / ordinaryDenominator;
    if (!Number.isFinite(ordinary)) throw new Error('A coefficient is outside the finite numerical range. Rescale it.');
    if (!allowUnderflow && ordinary === 0) throw new Error('A nonzero coefficient is too small to represent numerically. Rescale it.');
    return ordinary;
  }
  const numerator = abs(value.n).toString(), denominator = value.d.toString();
  const mantissa = Number('0.' + numerator.slice(0, 17)) / Number('0.' + denominator.slice(0, 17));
  const result = Number(`${value.n < 0n ? -mantissa : mantissa}e${numerator.length - denominator.length}`);
  if (!Number.isFinite(result)) throw new Error('A coefficient is outside the finite numerical range. Rescale it.');
  if (!allowUnderflow && result === 0) throw new Error('A nonzero coefficient is too small to represent numerically. Rescale it.');
  return result;
}
export function exactText(value: Rational): string { return value.d === 1n ? String(value.n) : `${value.n}/${value.d}`; }
