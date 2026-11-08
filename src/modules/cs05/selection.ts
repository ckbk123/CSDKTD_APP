import { decimal, numeric, zero } from './exact';
import { rationalCut, type Cut } from './gains';

export function nativeGain(raw: string): Cut {
  const value = decimal(raw, true), number = numeric(value);
  if (value.n < 0n || !Number.isFinite(number) || number > 10000) throw new Error('Enter a rational gain from 0 to 10,000, or select an exact endpoint.');
  return rationalCut(value);
}
/** A declared cursor precision, never an approximation to an exact endpoint identity. */
export function cursorGain(value: number): Cut {
  if (!Number.isFinite(value) || value < 0 || value > 10000) throw new Error('Keep the gain cursor from 0 to 10,000.');
  if (value === 0) return rationalCut(zero);
  if (value < 1e-15) throw new Error('This nonzero cursor gain is below its 10⁻¹⁵ precision; it was not changed to zero.');
  const digits = Math.max(1, Math.min(12, 16 + Math.floor(Math.log10(value))));
  return rationalCut(decimal(value.toExponential(digits - 1), true));
}
