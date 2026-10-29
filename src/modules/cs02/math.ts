import { EPS, U, Z, axisMultiplicity, constantOf, constantRF, degree, divQ, divRF, equalQ, limitRF, monicP, mulQ, mulRF, negQ, q, signQ, subQ, subRF, symmetricClassification, trim, zeroRF, type Poly, type Q, type RF } from './algebra';

export interface Row {
  readonly power: number;
  readonly original: readonly RF[];
  readonly values: readonly RF[];
  readonly treatment: 'ordinary' | 'epsilon' | 'auxiliary';
  readonly coefficientPowers: readonly (number | null)[] | null;
  readonly auxiliary: readonly RF[] | null; // Ascending powers of s, if this row was all zero.
}
export function determinant(matrix: readonly (readonly Q[])[]): Q {
  const n = matrix.length;
  if (!n || n > 6 || matrix.some(row => row.length !== n)) throw new Error('Use a square leading submatrix of order 1..6.');
  const a = matrix.map(row => [...row]); let result = U;
  for (let col = 0; col < n; col++) {
    const pivotRow = a.findIndex((row, index) => index >= col && row[col].n !== 0n);
    if (pivotRow < 0) return Z;
    if (pivotRow !== col) { [a[col], a[pivotRow]] = [a[pivotRow], a[col]]; result = negQ(result); }
    const pivot = a[col][col]; result = mulQ(result, pivot);
    for (let row = col + 1; row < n; row++) {
      const factor = divQ(a[row][col], pivot); a[row][col] = Z;
      for (let j = col + 1; j < n; j++) a[row][j] = subQ(a[row][j], mulQ(factor, a[col][j]));
    }
  }
  return result;
}
export function analyzeCoefficients(coefficients: Poly) {
  const original = trim(coefficients), n = degree(original);
  if (n < 1 || n > 6) throw new Error('Use a nonzero characteristic polynomial of degree 1..6.');
  if (original.some(c => (c.n < 0n ? -c.n : c.n) > 1_000_000_000_000n || c.d > 1_000_000_000_000n)) throw new Error('Reduced input coefficient parts must be at most 10¹².');
  if (original.some(c => (c.n < 0n ? -c.n : c.n) > 1_000_000n * c.d)) throw new Error('Input coefficient magnitudes must be at most 10⁶.');
  const normalized = monicP(original), width = Math.floor(n / 2) + 1, rows: Row[] = [];
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
  const limits = rows.map(row => limitRF(row.values[0])), signs = limits.map(value => value.sign);
  const right = signs.slice(1).filter((sign, i) => sign !== signs[i]).length, axis = axisMultiplicity(normalized), left = n - right - axis;
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
    return [{ row: index, polynomial, symbolic: row.auxiliary, classification: polynomial ? symmetricClassification(polynomial) : null }];
  });
  return { original, normalized, leading: original[n], degree: n, rows, limits, signs, right, axis, left, strict, matrix, matrixPowers, minors, auxiliaries };
}
export function samePolynomial(a: Poly, b: Poly) {
  const one = trim(a), two = trim(b); return one.length === two.length && one.every((value, i) => equalQ(value, two[i]));
}
