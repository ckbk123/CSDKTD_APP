import { describe, expect, it } from 'vitest';
import { parseMatrix, scalar } from './input';
describe('DD06 numeric visual matrix grammar', () => {
  it.each([['0', 0], ['-.25', -0.25], ['{1}{2}', 12], ['-{2}{3}', -23], ['\\frac12', 0.5], ['-\\frac12', -0.5], ['\\frac{-1}2', -0.5], ['-(\\frac1{2})', -0.5], ['\\frac{\\frac12}{2}', 0.25], ['\\frac1{\\frac12}', 2], ['\\frac{0}{2}', 0]])('reads the displayed numeric value%s', (source, expected) => expect(scalar(source)).toBe(expected));
  it('retains true fraction boxes while flattening invisible numeric formatting', () => {
    expect(scalar('\\frac{{1}{2}}{{2}{4}}')).toBe(0.5);
    expect(() => scalar('1{+2}')).toThrow('one decimal');
    expect(() => scalar('\\frac1{1{+2}}')).toThrow('one decimal');
    expect(() => scalar('\\frac123')).toThrow('juxtaposed');
  });
  it.each(['2\\frac12', '-2\\frac12', '2{\\frac12}', '\\frac1{2{\\frac12}}'])('rejects mixed adjacency%s', source => expect(() => scalar(source)).toThrow('Mixed-number'));
  it.each(['1e-2', '1E2', '10^{-2}', 'z', '1+2', '2(\\frac12)', '\\sqrt{2}', '1\\,2', '\\frac1\\,2', '\\frac{1}{0}', '\\frac{1}{}', '0.0000000000001', '101', '1'.repeat(25), '{'.repeat(18)+'1'+'}'.repeat(18)])('rejects unsupported/ambiguous/excessive numeric entry%s', source => expect(() => scalar(source)).toThrow());
  it('reads A/B/C templates, signed fractions and ordinary matrix fences', () => {
    expect(parseMatrix('A=\\begin{bmatrix}0&1\\\\-2&-3\\end{bmatrix}', 2, 2, 'A')).toEqual([[0, 1], [-2, -3]]);
    expect(parseMatrix('B=\\begin{pmatrix}0\\\\\\frac12\\end{pmatrix}', 2, 1, 'B')).toEqual([[0], [0.5]]);
    expect(parseMatrix('C=\\left[\\begin{matrix}1&0\\end{matrix}\\right]', 1, 2, 'C')).toEqual([[1, 0]]);
  });
  it('reports concrete cell/dimension/model-label errors', () => {
    expect(() => parseMatrix('A=\\begin{bmatrix}0&1\\end{bmatrix}', 2, 2, 'A')).toThrow('exactly 2');
    expect(() => parseMatrix('B=\\begin{bmatrix}0&1\\\\2&3\\end{bmatrix}', 2, 2, 'A')).toThrow('field is matrix A');
    expect(() => parseMatrix('A=\\begin{bmatrix}0&1\\\\2&z\\end{bmatrix}', 2, 2, 'A')).toThrow('row 2, column 2');
    expect(() => parseMatrix('[0,1;-2,-3]', 2, 2, 'A')).toThrow('visual');
    expect(() => parseMatrix('', 2, 2, 'A')).toThrow('numeric matrix');
  });
});
