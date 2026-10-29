import { constantOf, equalQ, limitRF, textQ, type Q, type RF } from './algebra';
import type { Analysis } from './math';
export type Treatment = 'ordinary' | 'epsilon' | 'auxiliary' | 'both';
export function requiredTreatment(result: Analysis): Treatment {
  const epsilon = result.rows.some(row => row.treatment === 'epsilon'), auxiliary = result.rows.some(row => row.treatment === 'auxiliary');
  return epsilon && auxiliary ? 'both' : epsilon ? 'epsilon' : auxiliary ? 'auxiliary' : 'ordinary';
}
const treatmentName = { ordinary: 'ordinary recurrence', epsilon: 'isolated-zero positive-epsilon treatment', auxiliary: 'all-zero-row auxiliary-polynomial treatment', both: 'both special treatments, each at its detected row' };
export function gradeCount(result: Analysis, count: number, treatment: Treatment) {
  if (!Number.isInteger(count) || count < 0 || count > result.degree) throw new Error(`Enter an integer RHP root count from 0 through ${result.degree}.`);
  const required = requiredTreatment(result), correct = count === result.right && treatment === required;
  return { correct, message: correct ? 'Your RHP count and row-treatment choice agree.' : `The original polynomial has ${result.right} RHP root(s). This table requires ${treatmentName[required]}. Inspect the detected rows and exact signs.` };
}
export interface EntryPrediction { readonly kind: 'finite' | 'positive-infinity' | 'negative-infinity'; readonly value?: Q; readonly side?: number }
export function gradeEntry(expected: RF, answer: EntryPrediction) {
  const limit = limitRF(expected), constant = constantOf(expected);
  if (limit.kind === 'infinite') {
    const correct = answer.kind === (limit.sign > 0 ? 'positive-infinity' : 'negative-infinity');
    return { correct, message: correct ? 'Your one-sided infinite limit agrees.' : `The limit is ${limit.sign > 0 ? 'positive' : 'negative'} infinity as epsilon approaches zero from above.` };
  }
  if (answer.kind !== 'finite') return { correct: false, message: `The value/limit is finite: ${textQ(limit.value)}.` };
  if (!answer.value) throw new Error('Complete the exact numeric answer.');
  if (!equalQ(answer.value, limit.value)) return { correct: false, message: `The exact value/limit is ${textQ(limit.value)}. Use a fraction for a nonterminating value.` };
  if (constant === null && !limit.value.n && answer.side !== limit.sign) return { correct: false, message: `The limit is zero, but its sign for positive epsilon is ${limit.sign > 0 ? 'positive' : 'negative'}. A zero limit alone does not determine the Routh sign.` };
  return { correct: true, message: constant === null ? 'Your one-sided limit and required sign agree.' : 'Your exact entry agrees.' };
}
