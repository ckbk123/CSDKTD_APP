import { describe, expect, it } from 'vitest';
import { BASELINE, parseOde } from './math';

describe('CR02 shared TeX argument preflight at integration', () => {
  it.each([String.raw`\frac1\;2`, String.raw`\frac\,12`, '\\frac1\u20092', String.raw`\frac1{\left\;2}`, String.raw`\frac1{\left(\left[2\right\;\right)}`])('rejects an empty argument before token erasure: %s', coefficient => {
    expect(() => parseOde(`${coefficient}y''+3y'+2y=u`)).toThrow(/blank space cannot fill a box/);
  });
  it.each([String.raw`\frac1{\;2}`, String.raw`\frac{\,1}2`, String.raw`\left(\frac1{\;2}\right)`])('preserves a correctly boxed coefficient: %s', coefficient => {
    expect(parseOde(`${coefficient}y''+3y'+2y=u`)).toEqual({...BASELINE,m:.5});
  });
});
