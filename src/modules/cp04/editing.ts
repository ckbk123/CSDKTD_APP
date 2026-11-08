import { frequency, normalize, normalizeFactor, parseDelay, parseReal, type Factor, type Model } from './math';

/** Serialize into the existing scalar grammar, then use the reparsed value.
 * A bounded continued fraction avoids rounding a small coefficient to zero and
 * keeps ordinary ratios such as 2/3 readable. This is numerical serialization,
 * not exact symbolic recovery of an arbitrary floating-point input. */
export function scalarText(value: number, delay = false): string {
  const parse = delay ? parseDelay : parseReal;
  if (!Number.isFinite(value)) throw new Error('The proposed value is not finite.');
  if (delay ? value < 0 || value > 10 : Math.abs(value) > 1e6 || value !== 0 && Math.abs(value) < 1e-6) throw new Error('This edit would exceed the supported coefficient bounds. Use the raw model editors.');
  if (value === 0) return '0';
  const sign = value < 0 ? '-' : '', target = Math.abs(value);
  const integer = Math.round(target);
  if (target === integer) return `${sign}${integer}`;
  let x = target, h0 = 0, h1 = 1, k0 = 1, k1 = 0;
  let best = '';
  for (let i = 0; i < 40; i++) {
    const a = Math.floor(x), h = a * h1 + h0, k = a * k1 + k0;
    if (!Number.isSafeInteger(h) || !Number.isSafeInteger(k) || h > 999999999999 || k > 999999999999 || !k) break;
    best = `${sign}${h}/${k}`;
    if (Math.abs(h / k - target) <= 4 * Number.EPSILON * target) break;
    h0 = h1; h1 = h; k0 = k1; k1 = k;
    const remainder = x - a; if (!remainder) break; x = 1 / remainder;
  }
  if (!best || Math.abs(parse(best) - value) > 1e-10 * Math.abs(value)) throw new Error('This edit cannot be represented at the supported scalar precision. Use the raw model editors.');
  return best;
}

export interface FactorEdit { readonly factor: Factor; readonly a1: string; readonly a2: string; readonly actualCorner: number; readonly damping?: number }
export function editFactor(factor: Factor, corner: number, damping = normalizeFactor(factor).damping): FactorEdit {
  const original = normalizeFactor(factor); frequency(corner);
  if (factor.kind === 'second' && (damping === undefined || !Number.isFinite(damping) || damping < .05 || damping > 1)) throw new Error('Damping ratio must be from 0.05 to 1.');
  const a1 = scalarText(factor.kind === 'first' ? Math.sign(factor.a1) * factor.a0 / corner : 2 * damping! * factor.a0 / corner);
  const a2 = factor.kind === 'first' ? '0' : scalarText(factor.a0 / corner ** 2);
  const candidate = { ...factor, a1: parseReal(a1), a2: parseReal(a2) }, checked = normalizeFactor(candidate);
  if (Math.abs(Math.log10(checked.corner / corner)) > 1e-8 || original.damping !== undefined && Math.abs(checked.damping! - damping!) > 1e-8) throw new Error('The displayed coefficient precision cannot retain this requested corner/damping.');
  return { factor: candidate, a1, a2, actualCorner: checked.corner, damping: checked.damping };
}

export function replaceFactor(model: Model, index: number, edit: FactorEdit): Model {
  if (!Number.isInteger(index) || index < 0 || index >= model.factors.length) throw new Error('Select an existing factor.');
  const candidate = { ...model, factors: model.factors.map((f, i) => i === index ? edit.factor : f) }; normalize(candidate); return candidate;
}
