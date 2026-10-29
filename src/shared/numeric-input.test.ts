import { describe, expect, it } from 'vitest';
import { readNumericInput } from './numeric-input';

function field(raw: string): HTMLInputElement {
  const input = document.createElement('input'); input.type = 'number'; input.value = raw;
  return input;
}

describe('native numeric input values', () => {
  it.each(['1e-999', '-1e-999', '1.2e-999', '0.0000001e-999', '1e-324', '-2e-324'])('rejects nonzero %s rounded to zero by the native control', raw => {
    const input = field(raw);
    expect(input.value).toBe(raw);
    expect(input.valueAsNumber === 0).toBe(true);
    expect(() => readNumericInput(input, 'Input amplitude A')).toThrow('Input amplitude A is nonzero but too small to represent');
    expect(input.value).toBe(raw);
  });
  it.each(['0', '0e-999', '0.000e-999', '-0', '-0e-999'])('preserves intentional zero %s', raw => {
    const input = field(raw);
    expect(Object.is(readNumericInput(input, 'Gain'), input.valueAsNumber)).toBe(true);
    expect(input.value).toBe(raw);
  });
  it.each([['1e-2', 0.01], ['-1e-2', -0.01], ['2E+3', 2000], ['.5', 0.5], ['5e-324', Number.MIN_VALUE]] as const)('preserves representable native number %s', (raw, expected) => {
    expect(readNumericInput(field(raw), 'Coefficient')).toBe(expected);
  });
  it.each(['', ' ', 'NaN', 'Infinity', '1e999', '0x10', '1.2.3', '1e'])('rejects empty, nonfinite or malformed native value %s', raw => {
    expect(() => readNumericInput(field(raw), 'Sample period T (s)')).toThrow('Enter Sample period T (s) as a finite number');
  });
  it('leaves range and step validation to callers and does not mutate the control', () => {
    const input = field('1e-2'); input.min = '1'; input.max = '2'; input.step = '1';
    expect(input.checkValidity()).toBe(false);
    expect(readNumericInput(input, 'Coordinate')).toBe(0.01);
    expect([input.value, input.min, input.max, input.step]).toEqual(['1e-2', '1', '2', '1']);
  });
});
