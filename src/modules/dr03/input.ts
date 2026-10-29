import type { Model } from './parser';
import { parseModel } from './parser';
import { validateModel } from './math';
/** Expand native exponent notation into the ordinary decimal notation shown
 * in the visual field. Do not reinterpret a displayed e as an exponent. */
export function decimal(value: number): string {
  if (!Number.isFinite(value)) throw new Error('Use finite coefficient values.');
  if (value === 0) return '0';
  const text = String(value);
  if (!/[eE]/.test(text)) return text;
  const [mantissa, power] = text.toLowerCase().split('e'), sign = mantissa.startsWith('-') ? '-' : '', digits = mantissa.replace('-', '').replace('.', '');
  const point = mantissa.replace('-', '').split('.')[0].length + Number(power);
  return sign + (point <= 0 ? '0.' + '0'.repeat(-point) + digits : point >= digits.length ? digits + '0'.repeat(point - digits.length) : digits.slice(0, point) + '.' + digits.slice(point));
}
function polynomial(a: number[]): string {
  return a.map((v, i) => '(' + decimal(v) + ')' + (i < a.length - 1 ? 'z^{' + (a.length - i - 1) + '}' : '')).join('+');
}
export function modelLatex(model: Model): string {
  validateModel(model);
  const latex = 'G(z)=\\frac{' + polynomial(model.b) + '}{' + polynomial(model.a) + '}';
  // A native alternative may not create an uneditable unsupported visual draft.
  const parsed = parseModel(latex);
  if ([...parsed.a, ...parsed.b].some((v, i) => v !== [...model.a, ...model.b][i])) throw new Error('Rescale coefficients so the visual equation preserves every coefficient.');
  return latex;
}
