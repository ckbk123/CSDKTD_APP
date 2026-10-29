/** Bounded exact rational arithmetic for polynomial identities. No exercise
 * state lives here. Decimal source constants and binary matrix values have
 * separate constructors; conversion to browser numbers is explicit. */
export interface Q { readonly n: bigint; readonly d: bigint }
export const ZERO: Q = Object.freeze({ n: 0n, d: 1n });
export const ONE: Q = Object.freeze({ n: 1n, d: 1n });
const abs = (n: bigint): bigint => n < 0n ? -n : n;
const bits = (n: bigint): number => abs(n).toString(2).length;
const fail = (): never => { throw new Error('Exact coefficient arithmetic exceeds the 8192-bit or numeric range. Simplify or rescale the expression.'); };
function gcd(a: bigint, b: bigint): bigint { a = abs(a); b = abs(b); while (b) [a, b] = [b, a % b]; return a; }
export function rational(n: bigint, d = 1n): Q {
  if (!d) throw new Error('A coefficient denominator cannot be zero.');
  if (!n) return ZERO;
  if (bits(n) > 8192 || bits(d) > 8192) return fail();
  const g = gcd(n, d), sign = d < 0n ? -1n : 1n;
  return { n: sign * n / g, d: sign * d / g };
}
export const neg = (a: Q): Q => ({ n: -a.n, d: a.d });
export const add = (a: Q, b: Q): Q => rational(a.n * b.d + b.n * a.d, a.d * b.d);
export const sub = (a: Q, b: Q): Q => add(a, neg(b));
export const mul = (a: Q, b: Q): Q => rational(a.n * b.n, a.d * b.d);
export const div = (a: Q, b: Q): Q => rational(a.n * b.d, a.d * b.n);
export const compare = (a: Q, b: Q): number => {
  const difference = a.n * b.d - b.n * a.d; return difference < 0n ? -1 : difference > 0n ? 1 : 0;
};
export const magnitude = (a: Q): Q => ({ n: abs(a.n), d: a.d });

export function fromDecimal(text: string): Q {
  if (!/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(text) || text.length > 512) throw new Error('Use a bounded ordinary decimal coefficient.');
  const [whole, fraction = ''] = text.split('.');
  const digits = ((whole || '') + fraction).replace(/^0+/, '') || '0';
  return rational(BigInt(digits), 10n ** BigInt(fraction.length));
}

/** Exact IEEE-754 value, used when checking a generated numerical matrix. */
export function fromNumber(value: number): Q {
  if (!Number.isFinite(value)) return fail();
  if (value === 0) return ZERO;
  const view = new DataView(new ArrayBuffer(8)); view.setFloat64(0, value, false);
  const raw = view.getBigUint64(0, false), sign = raw >> 63n ? -1n : 1n;
  const exponent = Number((raw >> 52n) & 2047n), fraction = raw & ((1n << 52n) - 1n);
  const mantissa = exponent ? (1n << 52n) + fraction : fraction;
  const power = exponent ? exponent - 1023 - 52 : -1074;
  return power >= 0 ? rational(sign * (mantissa << BigInt(power))) : rational(sign * mantissa, 1n << BigInt(-power));
}

export function toNumber(value: Q, minimum = 1e-300, maximum = 1e300): number {
  if (!value.n) return 0;
  const n = abs(value.n), d = value.d;
  let exponent = bits(n) - bits(d);
  if (exponent >= 0 ? n < (d << BigInt(exponent)) : (n << BigInt(-exponent)) < d) exponent--;
  if (exponent > 1023) return fail();
  // Round the integer significand once, including subnormal values and
  // halfway ties. A leading-bit ratio can introduce an extra rounding error.
  const scale = Math.max(-1074, exponent - 52);
  const numerator = scale < 0 ? n << BigInt(-scale) : n;
  const denominator = scale >= 0 ? d << BigInt(scale) : d;
  let significand = numerator / denominator;
  const twiceRemainder = 2n * (numerator % denominator);
  if (twiceRemainder > denominator || (twiceRemainder === denominator && (significand & 1n))) significand++;
  const converted = Number(significand) * 2 ** scale;
  if (!Number.isFinite(converted) || converted < minimum || converted > maximum || converted === 0) return fail();
  return value.n < 0n ? -converted : converted;
}
