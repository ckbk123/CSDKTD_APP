import { EPS, U, Z, axisMultiplicity, constantOf, constantRF, degree, divQ, divRF, divideP, equalQ, gcdP, latexQ, limitRF, monicP, mulQ, mulRF, negQ, q, signQ, subQ, subRF, symmetricClassification, symmetricClassificationRF, trim, zeroRF, type Poly, type Q, type RF } from './algebra';

export interface Row {
  readonly power: number;
  readonly original: readonly RF[];
  readonly values: readonly RF[];
  readonly treatment: 'ordinary' | 'epsilon' | 'auxiliary';
  readonly coefficientPowers: readonly (number | null)[] | null;
  readonly auxiliary: readonly RF[] | null; // Ascending powers of s, if this row was all zero.
}
export type RowOperation = { readonly kind: 'swap'; readonly first: number; readonly second: number } | { readonly kind: 'eliminate'; readonly source: number; readonly target: number; readonly factor: Q };
export function determinantWork(matrix: readonly (readonly Q[])[]) {
  const n = matrix.length;
  if (!n || n > 6 || matrix.some(row => row.length !== n)) throw new Error('Use a square leading submatrix of order 1..6.');
  const a = matrix.map(row => [...row]), operations: RowOperation[] = [], pivots: Q[] = []; let result = U;
  for (let col = 0; col < n; col++) {
    const pivotRow = a.findIndex((row, index) => index >= col && row[col].n !== 0n);
    if (pivotRow < 0) return { value: Z, operations, pivots, triangular: a, singularColumn: col };
    if (pivotRow !== col) { [a[col], a[pivotRow]] = [a[pivotRow], a[col]]; result = negQ(result); operations.push({ kind: 'swap', first: col, second: pivotRow }); }
    const pivot = a[col][col]; result = mulQ(result, pivot); pivots.push(pivot);
    for (let row = col + 1; row < n; row++) {
      const factor = divQ(a[row][col], pivot); a[row][col] = Z;
      for (let j = col + 1; j < n; j++) a[row][j] = subQ(a[row][j], mulQ(factor, a[col][j]));
      if (factor.n) operations.push({ kind: 'eliminate', source: col, target: row, factor });
    }
  }
  return { value: result, operations, pivots, triangular: a, singularColumn: null };
}
export const determinant = (matrix: readonly (readonly Q[])[]) => determinantWork(matrix).value;
function constructRouth(normalized: Poly): Row[] {
  const n = degree(normalized), width = Math.floor(n / 2) + 1, rows: Row[] = [];
  const zero = constantRF(Z);
  for (let row = 0; row <= n; row++) {
    const power = n - row;
    const coefficientPowers = row < 2 ? Array.from({ length: width }, (_, col) => { const exponent = power - 2 * col; return exponent >= 0 ? exponent : null; }) : null;
    const raw: RF[] = Array.from({ length: width }, (_, col) => {
      if (row < 2) return constantRF(power - 2 * col >= 0 ? normalized[power - 2 * col] : Z);
      const above = rows[row - 2].values, previous = rows[row - 1].values;
      return divRF(subRF(mulRF(previous[0], above[col + 1] ?? zero), mulRF(above[0], previous[col + 1] ?? zero)), previous[0]);
    });
    let treatment: Row['treatment'] = 'ordinary', values = [...raw], auxiliary: RF[] | null = null;
    if (raw.every(zeroRF)) {
      if (!row) throw new Error('The leading coefficient cannot be zero after normalization.');
      treatment = 'auxiliary'; const previous = rows[row - 1];
      auxiliary = Array.from({ length: previous.power + 1 }, () => zero);
      previous.values.forEach((value, col) => { const exponent = previous.power - 2 * col; if (exponent >= 0) auxiliary![exponent] = value; });
      values = previous.values.map((value, col) => { const exponent = previous.power - 2 * col; return exponent > 0 ? mulRF(constantRF(q(exponent)), value) : zero; });
    } else if (zeroRF(raw[0])) { treatment = 'epsilon'; values[0] = EPS; }
    if (zeroRF(values[0])) throw new Error('The special-row continuation did not produce a usable first entry.');
    rows.push({ power, original: raw, values, treatment, coefficientPowers, auxiliary });
  }
  return rows;
}
function columnCount(rows: readonly Row[]) {
  const limits = rows.map(row => limitRF(row.values[0])), signs = limits.map(value => value.sign);
  return { limits, signs, changes: signs.slice(1).filter((sign, i) => sign !== signs[i]).length };
}
export function analyzeCoefficients(coefficients: Poly) {
  const original = trim(coefficients), n = degree(original);
  if (n < 1 || n > 6) throw new Error('Use a nonzero characteristic polynomial of degree 1..6.');
  if (original.some(c => (c.n < 0n ? -c.n : c.n) > 1_000_000_000_000n || c.d > 1_000_000_000_000n)) throw new Error('Reduced input coefficient parts must be at most 10¹².');
  if (original.some(c => (c.n < 0n ? -c.n : c.n) > 1_000_000n * c.d)) throw new Error('Input coefficient magnitudes must be at most 10⁶.');
  const normalized = monicP(original), rows = constructRouth(normalized), { limits, signs, changes } = columnCount(rows), axis = axisMultiplicity(normalized);
  let right = changes;
  let separation: { factor: Poly; quotient: Poly; classification: ReturnType<typeof symmetricClassification>; quotientRows: readonly Row[]; quotientSigns: readonly number[]; quotientRight: number; symmetricRight: number } | null = null;
  if (axis && rows.some(row => row.treatment === 'epsilon')) {
    // An epsilon perturbation can move original axis roots. Count the exact
    // origin-symmetric factor separately before applying epsilon to its quotient.
    const factor = gcdP(normalized, normalized.map((value, i) => i % 2 ? negQ(value) : value));
    const divided = divideP(normalized, factor), quotient = divided.quotient;
    if (degree(divided.remainder) >= 0 || axisMultiplicity(quotient)) throw new Error('Exact symmetric-factor separation failed. Simplify the model.');
    const classification = symmetricClassification(factor), symmetricRight = classification.realPairs + 2 * classification.complexQuartets;
    if (classification.origin + 2 * classification.imaginaryPairs !== axis) throw new Error('The separated axis count disagreed with the original polynomial.');
    const quotientRows = degree(quotient) > 0 ? constructRouth(quotient) : [], quotientCount = columnCount(quotientRows);
    right = symmetricRight + quotientCount.changes;
    separation = { factor, quotient, classification, quotientRows, quotientSigns: quotientCount.signs, quotientRight: quotientCount.changes, symmetricRight };
  }
  const left = n - right - axis;
  if (left < 0) throw new Error('The exact Routh count failed its degree check. Simplify the model.');
  const matrixPowers = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => { const index = n - (2 * j - i + 1); return index >= 0 && index <= n ? index : null; }));
  const matrix = matrixPowers.map(row => row.map(index => index === null ? Z : normalized[index]));
  const minors = Array.from({ length: n }, (_, i) => determinant(matrix.slice(0, i + 1).map(row => row.slice(0, i + 1))));
  const strict = minors.every(value => signQ(value) > 0);
  if (strict !== (right === 0 && axis === 0)) throw new Error('Routh and Hurwitz checks disagreed. Simplify the model.');
  const auxiliaries = rows.flatMap((row, index) => {
    if (!row.auxiliary) return [];
    const constants = row.auxiliary.map(constantOf);
    const polynomial = constants.every((value): value is Q => value !== null) ? constants : null;
    return [{ row: index, polynomial, symbolic: row.auxiliary, classification: polynomial ? symmetricClassification(polynomial) : symmetricClassificationRF(row.auxiliary), epsilonFamily: polynomial === null }];
  });
  return { original, normalized, leading: original[n], degree: n, rows, limits, signs, firstColumnChanges: changes, separation, right, axis, left, strict, matrix, matrixPowers, minors, auxiliaries };
}
export function samePolynomial(a: Poly, b: Poly) {
  const one = trim(a), two = trim(b); return one.length === two.length && one.every((value, i) => equalQ(value, two[i]));
}
/** Exact quadratic auxiliary modes, reducing rational perfect squares only. */
export function quadraticAuxiliaryRoots(source: Poly): string | null {
  const p = trim(source); if (p.length !== 3 || p[1].n || !p[2].n) return null;
  const square = divQ(negQ(p[0]), p[2]);
  if (!square.n) return String.raw`s=0\quad\text{(multiplicity 2)}`;
  const magnitude = square.n < 0n ? negQ(square) : square;
  function integerRoot(value: bigint) {
    if (value < 2n) return value;
    let x = 1n << BigInt(Math.ceil(value.toString(2).length / 2));
    for (let pass = 0; pass < 4096; pass++) { const next = (x + value / x) / 2n; if (next >= x) return x; x = next; }
    throw new Error('Exact square-root reduction exceeded its precision bound.');
  }
  const n = integerRoot(magnitude.n), d = integerRoot(magnitude.d), root = n * n === magnitude.n && d * d === magnitude.d ? latexQ(q(n, d)) : `\\sqrt{${latexQ(magnitude)}}`;
  return `s=\\pm ${root}${square.n < 0n ? '\\mathrm{j}' : ''}`;
}
export type Analysis = ReturnType<typeof analyzeCoefficients>;
