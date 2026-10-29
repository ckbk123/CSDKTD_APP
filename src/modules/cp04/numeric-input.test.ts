import { describe, expect, it } from 'vitest';
import { readNumericInput } from '../../shared/numeric-input';
function field(raw: string): HTMLInputElement { const input = document.createElement('input'); input.type = 'number'; input.value = raw; return input; }
describe('CP04 shared native-number integration', () => {
  it.each(['0', '0e-999'])('preserves intentional zero %s before the domain check', raw => { const input = field(raw); expect(readNumericInput(input, 'Cursor')).toBe(0); expect(input.value).toBe(raw); });
  it('preserves normal numeric exponents, unlike the visual-equation grammar', () => { expect(readNumericInput(field('1e-2'), 'Cursor')).toBe(0.01); });
  it('rejects nonzero underflow without rewriting the visible control', () => { const input = field('1e-9999'); expect(() => readNumericInput(input, 'Cursor')).toThrow('nonzero but too small to represent'); expect(input.value).toBe('1e-9999'); });
  it.each(['', '1e999'])('rejects empty/nonfinite native value %s', raw => { expect(() => readNumericInput(field(raw), 'Cursor')).toThrow('finite number'); });
});
