import { parseErrors } from './input';

/** Publish full decimal digits through the existing visual-list grammar. */
export function errorDecimal(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) > 10000) throw new Error('An error sample must be finite with magnitude at most 10000.');
  const [mantissa, exponent] = value.toString().split('e');
  if (exponent === undefined) return mantissa;
  const negative = mantissa.startsWith('-'), unsigned = negative ? mantissa.slice(1) : mantissa;
  const [integer, fraction = ''] = unsigned.split('.'), digits = integer + fraction, point = integer.length + Number(exponent);
  const text = point <= 0 ? '0.' + '0'.repeat(-point) + digits : point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point) + '.' + digits.slice(point);
  return (negative ? '-' : '') + text;
}

/** Edits never rewrite error history that has already been committed to memory. */
export function editFutureError(errors: readonly number[], nextK: number, selectedK: number, value: number): { errors: readonly number[]; latex: string } {
  if (!errors.length || errors.length > 40) throw new Error('Keep the original 1–40 error samples.');
  if (!Number.isInteger(nextK) || nextK < 1 || nextK > errors.length + 1 || !Number.isInteger(selectedK) || selectedK < 1 || selectedK > errors.length) throw new Error('Select an actual error sample in the current sequence.');
  if (selectedK < nextK) throw new Error('This input is already committed. Restart or explicitly replay from that sample before editing it.');
  const candidate = errors.map((old, i) => i === selectedK - 1 ? value : old);
  const latex = '[' + candidate.map(errorDecimal).join(',') + ']';
  let parsed: readonly number[];
  try { parsed = parseErrors(latex); }
  catch (error) { throw new Error(`Direct editing cannot publish this sequence within the existing equation-entry limits. ${error instanceof Error ? error.message : ''}`); }
  if (parsed.length !== candidate.length || parsed.some((x, i) => x !== candidate[i])) throw new Error('The displayed error sequence did not preserve its numeric values.');
  return { errors: parsed, latex };
}
