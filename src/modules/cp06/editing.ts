import { buildModel, type Model } from './model';
import { degree, divide, evaluateExact, monic, product, zero, type Polynomial } from './polynomial';
import { add, decimal, mul, neg, ONE, rational, type Rational } from './rational';
import { roots } from './roots';

export type FactorKind = 'pole' | 'zero';
export interface EditFactor {
  readonly id: string; readonly kind: FactorKind; readonly index: number;
  readonly re: number; readonly im: number; readonly pair: boolean; readonly multiplicity: number;
  readonly exact?: Polynomial; readonly remainder?: Polynomial;
}
export interface EditedModel { readonly model: Model; readonly note: string }
export const SNAP = .01;
export function snapCoordinate(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 100) throw new Error('Factor coordinates must be finite and within ±100 s⁻¹.');
  return Math.round(value * 100) / 100 || 0;
}
const power = (p: Polynomial, count: number): Polynomial => Array.from({ length: count }).reduce<Polynomial>(a => product(a, p), [ONE]);
function factorAt(re: number, im: number, pair: boolean, count = 1): Polynomial {
  const r = decimal(snapCoordinate(re).toFixed(2)), i = decimal(snapCoordinate(Math.abs(im)).toFixed(2));
  return power(pair ? [add(mul(r, r), mul(i, i)), neg(mul(rational(2n), r)), ONE] : [neg(r), ONE], count);
}
/** Continued fractions only propose rationals; exact substitution decides whether a root is rational. */
function exactReal(p: Polynomial, value: number): Rational | undefined {
  let x = Math.abs(value), h0 = 0, h1 = 1, k0 = 1, k1 = 0;
  for (let step = 0; step < 32; step++) {
    const a = Math.floor(x), h = a * h1 + h0, k = a * k1 + k0;
    if (!Number.isSafeInteger(h) || !Number.isSafeInteger(k) || k > 1e9) break;
    const candidate = rational(BigInt(value < 0 ? -h : h), BigInt(k));
    if (!evaluateExact(p, candidate).n) return candidate;
    const tail = x - a; if (!tail) break;
    [h0, h1, k0, k1, x] = [h1, h, k1, k, 1 / tail];
  }
  return undefined;
}
function groups(p: Polynomial, kind: FactorKind): EditFactor[] {
  const all = roots(p), list = all.filter(root => root.im >= 0);
  return list.map((root, index) => {
    let exact: Polynomial | undefined;
    if (!root.im) {
      const r = exactReal(p, root.re); if (r) exact = power([neg(r), ONE], root.multiplicity);
    } else if (degree(p) === 2) exact = monic(p);
    else {
      const other = all.find(value => !value.im), r = other && exactReal(p, other.re);
      if (r) exact = divide(monic(p), [neg(r), ONE]).quotient;
    }
    const division = exact && divide(p, exact);
    if (division && !zero(division.remainder)) exact = undefined;
    return { id: `${kind}-${index}`, kind, index, re: root.re, im: Math.abs(root.im), pair: root.im !== 0, multiplicity: root.multiplicity, exact, remainder: exact ? division!.quotient : undefined };
  });
}
/** Full plant factors include exact pole/zero cancellations; effective PI factors are derived separately. */
export function editableFactors(model: Model): EditFactor[] { return [...groups(model.plantD, 'pole'), ...groups(model.plantN, 'zero')]; }
function changed(model: Model, kind: FactorKind, polynomial: Polynomial): Model {
  return buildModel(kind === 'zero' ? polynomial : model.plantN, kind === 'pole' ? polynomial : model.plantD, model.mode, model.integral);
}
export function moveFactor(model: Model, id: string, real: number, imaginary: number): EditedModel {
  const list = editableFactors(model), selected = list.find(f => f.id === id);
  if (!selected) throw new Error('Select a plant pole or zero first.');
  if (!selected.pair && imaginary !== 0) throw new Error('A real factor stays on the real axis. Add a conjugate pair to create complex roots.');
  const replacement = factorAt(real, imaginary, selected.pair, selected.multiplicity);
  let p: Polynomial, approximate = false;
  if (selected.remainder) p = product(selected.remainder, replacement);
  else {
    approximate = true;
    const source = selected.kind === 'pole' ? model.plantD : model.plantN;
    p = list.filter(f => f.kind === selected.kind).reduce<Polynomial>((result, f) => product(result, f.id === id ? replacement : f.exact ?? factorAt(f.re, f.im, f.pair, f.multiplicity)), [source.at(-1)!]);
  }
  const next = changed(model, selected.kind, p);
  return { model: next, note: approximate ? 'Applied on the 0.01 grid. Other roots without an exact split in this polynomial were also rounded to that grid; untouched exact factors are preserved. The displayed equation is the resulting model.' : 'Applied on the 0.01 grid. Untouched exact factors and the polynomial leading scale are preserved.' };
}
export function removeFactor(model: Model, id: string): EditedModel {
  const list = editableFactors(model), selected = list.find(f => f.id === id);
  if (!selected) throw new Error('Select a plant pole or zero first.');
  let p = selected.remainder;
  if (!p) {
    const source = selected.kind === 'pole' ? model.plantD : model.plantN;
    p = list.filter(f => f.kind === selected.kind && f.id !== id).reduce<Polynomial>((result, f) => product(result, f.exact ?? factorAt(f.re, f.im, f.pair, f.multiplicity)), [source.at(-1)!]);
  }
  return { model: changed(model, selected.kind, p), note: selected.remainder ? 'Removed the selected factor group. Untouched factors retain their exact coefficients.' : 'Removed the group; remaining roots without an exact split were rounded to the 0.01 grid, while untouched exact factors are preserved.' };
}
export function addFactor(model: Model, kind: FactorKind, pair: boolean, re: number, im: number): EditedModel {
  if (!pair && im !== 0) throw new Error('A real factor has zero imaginary coordinate.');
  const source = kind === 'pole' ? model.plantD : model.plantN;
  return { model: changed(model, kind, product(source, factorAt(re, im, pair))), note: `Added ${pair ? 'a conjugate pair' : 'a real factor'} on the 0.01 grid, preserving existing factors and leading scale.` };
}
export function additionLimit(model: Model, kind: FactorKind, pair: boolean): string | undefined {
  const count = pair ? 2 : 1, denominator = degree(model.plantD), numerator = degree(model.plantN), maximum = model.mode === 'pi' ? 2 : 3;
  if (kind === 'pole' && denominator + count > maximum) return `This ${model.mode === 'pi' ? 'PI plant' : 'loop'} supports at most ${maximum} poles. Remove a group or try the two-pole experiment.`;
  if (kind === 'zero' && numerator + count >= denominator) return 'Keep fewer zeros than poles for a strictly proper plant. Add a pole first or remove a zero group.';
  return undefined;
}
export function factorLabel(f: EditFactor): string {
  return `${f.kind === 'pole' ? 'Pole' : 'Zero'} ${f.index + 1}${f.pair ? ' pair' : ''}${f.multiplicity > 1 ? ` ×${f.multiplicity}` : ''}: ${Number(f.re.toPrecision(6))}${f.pair ? ` ± j${Number(f.im.toPrecision(6))}` : ''}`;
}
