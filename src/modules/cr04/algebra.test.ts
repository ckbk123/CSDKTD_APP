import { describe, expect, it } from 'vitest';
import { ONE, addTF, divTF, equalTF, evaluateTF, latexTF, mulTF, q, subTF, textQ, tf } from './algebra';

describe('CR04 bounded exact scalar transfer algebra', () => {
  it('reduces independently expanded products without approximate cancellation', () => {
    const value = tf([q(6), q(5), q(1)], [q(12), q(7), q(1)]); // (s+2)(s+3)/(s+3)(s+4)
    expect(equalTF(value, tf([q(2), q(1)], [q(4), q(1)]))).toBe(true);
    const near = tf([q(200000001, 100000000), q(1)], [q(2), q(1)]);
    expect(equalTF(near, ONE)).toBe(false);
    expect(textQ(evaluateTF(near, q(0)))).toBe('200000001/200000000');
  });
  it('preserves rational arithmetic and exact signed feedback identities', () => {
    const g = tf([q(2)], [q(3), q(1)]), h = tf([q(1, 2)]);
    const closed = divTF(g, addTF(ONE, mulTF(g, h)));
    expect(equalTF(closed, tf([q(2)], [q(4), q(1)]))).toBe(true);
    expect(textQ(evaluateTF(closed, q(2)))).toBe('1/3');
    expect(equalTF(divTF(g, subTF(ONE, mulTF(g, h))), tf([q(2)], [q(2), q(1)]))).toBe(true);
    expect(latexTF(tf([q(-1, 2), q(0), q(1)]))).toBe(String.raw`s^{2}-\frac{1}{2}`);
  });
  it('reports zero division, coefficient and degree work limits', () => {
    expect(() => q(NaN)).toThrow('integers'); expect(() => q(1, 0)).toThrow('zero');
    expect(() => divTF(ONE, tf([q(0)]))).toThrow('zero block');
    expect(() => q(1n << 4097n)).toThrow('4096');
    expect(() => tf([...Array.from({ length: 13 }, () => q(0)), q(1)])).toThrow('degree 12');
  });
});
