import { describe, expect, it } from 'vitest';
import { equalTF, q, tf } from './algebra';
import { parseTransfer } from './parser';

describe('CR04 displayed rational transfer entry', () => {
  it('accepts factored rational blocks, sums, visible signs and polynomial fractions', () => {
    const expected = tf([q(3), q(1)], [q(2), q(3), q(1)]);
    expect(equalTF(parseTransfer(String.raw`G(s)=\frac{s+3}{(s+1)(s+2)}`), expected)).toBe(true);
    expect(equalTF(parseTransfer('2/(s+1)-1/(s+2)'), expected)).toBe(true);
    expect(equalTF(parseTransfer(String.raw`-\left(\frac{-s-3}{(s+1)(s+2)}\right)`), expected)).toBe(true);
  });
  it('retains compact one-token and nested fractions, including signed denominators', () => {
    for (const latex of [String.raw`\frac12`, String.raw`\frac{1}2`, String.raw`\frac1{2}`, String.raw`\frac1{\;2}`]) expect(equalTF(parseTransfer(latex), tf([q(1, 2)]))).toBe(true);
    expect(equalTF(parseTransfer(String.raw`\frac{\frac12}{\frac34}`), tf([q(2, 3)]))).toBe(true);
    expect(equalTF(parseTransfer(String.raw`\frac{s}{-2}`), tf([q(0), q(-1, 2)]))).toBe(true);
    expect(equalTF(parseTransfer(String.raw`\frac s2`), tf([q(0), q(1, 2)]))).toBe(true);
  });
  it('rejects raw spacing and parenthesized arguments before normalization', () => {
    for (const latex of [String.raw`\frac1\;2`, String.raw`\frac\,12`, String.raw`2^\;2`, '2^(2)', 's^(2)', String.raw`\frac(s+1)2`]) expect(() => parseTransfer(latex)).toThrow('box');
    expect(equalTF(parseTransfer(String.raw`2^{\;2}`), tf([q(4)]))).toBe(true);
    expect(equalTF(parseTransfer('s^{2}'), tf([q(0), q(0), q(1)]))).toBe(true);
  });
  it('rejects mixed numbers, numeric spacing fusion and invisible grouping', () => {
    for (const latex of [String.raw`2\frac12`, String.raw`-2\,\frac12`, String.raw`\frac{2\frac12}3`, String.raw`(-2\frac12)`]) expect(() => parseTransfer(latex)).toThrow('Mixed');
    for (const latex of [String.raw`1\;2`, String.raw`0.\,2`, String.raw`1\quad2`]) expect(() => parseTransfer(latex)).toThrow('separated');
    for (const latex of ['1{+2}', '{s+2}s']) expect(() => parseTransfer(latex)).toThrow('visible');
    expect(equalTF(parseTransfer(String.raw`2+\frac12`), tf([q(5, 2)]))).toBe(true);
    expect(equalTF(parseTransfer(String.raw`2\times\frac12`), tf([q(1)]))).toBe(true);
  });
  it('distinguishes whole powers and rejects unsupported expressions and bounds', () => {
    expect(() => parseTransfer('2^12')).toThrow('power box'); expect(() => parseTransfer('s^{0}2')).toThrow('power box');
    expect(equalTF(parseTransfer('2^{12}'), tf([q(4096)]))).toBe(true);
    expect(() => parseTransfer('s^{4}')).toThrow('degree at most three');
    expect(() => parseTransfer('1/(s-s)')).toThrow('zero'); expect(() => parseTransfer('0^0')).toThrow('unsupported');
    for (const latex of ['', '1e-2', 'sin(s)', 's^{-1}', 'j+1', 'z+1', '1+'.repeat(400)]) expect(() => parseTransfer(latex)).toThrow();
    expect(() => parseTransfer('1.000000001')).toThrow('eight'); expect(() => parseTransfer('1000001')).toThrow('magnitudes');
    expect(() => parseTransfer('('.repeat(18)+'s'+')'.repeat(18))).toThrow('sixteen');
    expect(equalTF(parseTransfer('1/(s^{6}+1)', 'answer'), tf([q(1)], [...Array.from({length:6},(_,i)=>q(i===0?1:0)),q(1)]))).toBe(true);
  });
});
