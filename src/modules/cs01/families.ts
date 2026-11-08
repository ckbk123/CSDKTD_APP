import { add, latexRat, mul, neg, parseModel, rat, type Model, type Rational } from './math';

/** An editing vocabulary, not a new solver or a conversion of arbitrary realizations. */
export type FamilyKind = 'canonical' | 'hidden' | 'repeated';
export interface Family {
  readonly kind: FamilyKind;
  readonly first: number;
  readonly second: number;
  readonly pair: boolean;
  readonly jordan: boolean;
}
export interface Handle { readonly id: string; readonly re: number; readonly im: number; readonly label: string }
export const baselineFamily = (): Family => ({ kind: 'canonical', first: -1, second: -2, pair: false, jordan: false });
export function familyPreset(kind: FamilyKind, alternative = false): { family: Family; initial: readonly [number, number] } {
  return kind === 'hidden' ? { family: { kind, first: 1, second: -2, pair: false, jordan: false }, initial: [1, 1] }
    : kind === 'repeated' ? { family: { kind, first: 0, second: 0, pair: false, jordan: alternative }, initial: alternative ? [0, 1] : [1, 1] }
      : { family: alternative ? { kind, first: 0, second: 2, pair: true, jordan: false } : baselineFamily(), initial: [1, 0] };
}
export function gridCoordinate(value: number): number {
  if (!Number.isFinite(value) || Math.abs(value) > 100) throw new Error('Family pole coordinates must be finite and between −100 and 100.');
  const ticks = Math.round(value * 100), snapped = ticks / 100;
  if (Math.abs(value - snapped) > 16 * Number.EPSILON * Math.max(1, Math.abs(value))) throw new Error('Family pole editing uses a 0.01 grid. Arbitrary rational matrices remain available in Practice.');
  return snapped === 0 ? 0 : snapped;
}
export const snapCoordinate = (value: number): number => gridCoordinate(Math.round(value * 100) / 100);
const coordinate = (value: number): Rational => rat(BigInt(Math.round(gridCoordinate(value) * 100)), 100n);
export const matrixLatex = (rows: readonly (readonly Rational[])[]): string => `\\begin{bmatrix}${rows.map(row => row.map(latexRat).join('&')).join('\\\\')}\\end{bmatrix}`;
export function modelLatex(model: Model): readonly [string, string, string, string] {
  return [matrixLatex(model.a), matrixLatex(model.b.map(value => [value])), matrixLatex([model.c]), latexRat(model.d)];
}
export function familyModel(family: Family): Model {
  const first = coordinate(family.first), second = coordinate(family.second), zero = rat(0n), one = rat(1n);
  let a: Rational[][], b = [zero, one], c = [one, zero];
  if (family.kind === 'canonical') {
    if (family.pair && family.second < 0) throw new Error('The conjugate pair frequency is nonnegative.');
    const product = family.pair ? add(mul(first, first), mul(second, second)) : mul(first, second);
    const sum = family.pair ? add(first, first) : add(first, second);
    a = [[zero, one], [neg(product), sum]];
  } else if (family.kind === 'hidden') { a = [[first, zero], [zero, second]]; c = [zero, one]; }
  else { a = [[first, family.jordan ? one : zero], [zero, first]]; if (!family.jordan) b = [one, one]; }
  // Reuse the original entry bounds and grammar, including every derived coefficient.
  try { return parseModel(matrixLatex(a), matrixLatex(b.map(value => [value])), matrixLatex([c]), '0'); }
  catch (error) { throw new Error(`This family position exceeds the original matrix-entry limits (|entry|≤100, denominator≤10⁹). ${error instanceof Error ? error.message : ''}`); }
}
export function handles(family: Family): readonly Handle[] {
  if (family.kind === 'canonical' && family.pair) return [{ id: 'upper', re: family.first, im: family.second, label: 'Upper conjugate' }, { id: 'lower', re: family.first, im: -family.second, label: 'Lower conjugate' }];
  if (family.kind === 'repeated') return [{ id: 'first', re: family.first, im: 0, label: 'Repeated eigenvalue (multiplicity 2)' }];
  return [{ id: 'first', re: family.first, im: 0, label: family.kind === 'hidden' ? 'Hidden state x₁ eigenvalue' : 'First real pole' }, { id: 'second', re: family.second, im: 0, label: family.kind === 'hidden' ? 'Visible state x₂ / channel pole' : 'Second real pole' }];
}
export function moveHandle(family: Family, id: string, real: number, imaginary: number): Family {
  const re = gridCoordinate(real), im = gridCoordinate(imaginary);
  if (family.kind === 'canonical' && family.pair) {
    if ((id === 'upper' && im < 0) || (id === 'lower' && im > 0)) throw new Error('Upper and lower conjugate handles stay on their labelled side of the real axis.');
    return { ...family, first: re, second: Math.abs(im) };
  }
  if (im !== 0) throw new Error('This family handle stays on the real axis; choose the conjugate canonical family for complex poles.');
  return id === 'second' ? { ...family, second: re } : { ...family, first: re };
}
