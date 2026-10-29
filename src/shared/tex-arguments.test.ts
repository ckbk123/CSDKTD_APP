import { describe, expect, it } from 'vitest';
import { convertLatexToMathMl } from 'mathlive/ssr';
import { rejectSpacingArguments } from './tex-arguments';

describe('spacing tokens retain their TeX argument scope', () => {
  it.each([
    String.raw`\frac1\;2`, String.raw`\frac\,12`, String.raw`\dfrac1\!2`, String.raw`\tfrac\:12`,
    String.raw`\frac1\quad2`, String.raw`\frac\qquad12`, String.raw`\frac1\ 2`,
    String.raw`2^\;2`, String.raw`2_\,2`, String.raw`2^ \! 2`,
    String.raw`\frac{1+\frac1\;2}{3}`, String.raw`\frac\frac12\;3`,
    String.raw`\frac\mathrm{12}\;3`, String.raw`\frac\mathbf\mathrm1\,2`,
    String.raw`2^\mathrm\;2`, String.raw`\frac1{2^\;2}`,
    String.raw`\begin{bmatrix}\frac1\;2&0\\0&1\end{bmatrix}`,
    String.raw`\frac1\;`, String.raw`2^\,`, String.raw`\frac{1}{\frac1\;2}`,
    String.raw`\frac1\left\;2`, String.raw`\frac1\right\;2`,
    String.raw`2^\left\;2`, String.raw`2^\right\;2`,
    '\\frac1\\left\u20092', '\\frac1\\right\u20092', '2^\\left\u20092', '2^\\right\u20092',
  ])('rejects explicit spacing as an unbraced argument in %s', source => {
    expect(() => rejectSpacingArguments(source)).toThrow('Complete the fraction and power boxes with numbers or expressions. A blank space cannot fill a box.');
  });
  it.each([
    '0.125', '-1e-2', String.raw`\frac12`, String.raw`\frac 1 2`,
    String.raw`\frac1{\;2}`, String.raw`\frac{\,1}{2}`, String.raw`\frac{\!1}{\quad2}`,
    String.raw`2^{\;2}`, String.raw`2_{\,2}`, String.raw`\frac 1{ \; 2 }`,
    String.raw`\frac{\frac1{\;2}}{3}`, String.raw`\frac\frac12{\;3}`,
    String.raw`\frac\mathrm{12}{\;3}`, String.raw`\frac\mathrm1{\,2}`,
    String.raw`2^\mathrm{\;2}`, String.raw`\frac{1}{2}^{\;2}`,
    String.raw`\;\frac12\,`, String.raw`2^{2}\,\frac12`,
    String.raw`\begin{bmatrix}\frac1{\;2}&0\\0&1\end{bmatrix}`,
    String.raw`2^\left(2\right)`, String.raw`2^\left(2\right)\;`, String.raw`2^\left(\;2\right)`,
    String.raw`\frac{\left(\;1\right)}{2}`, String.raw`2^{\left(\;2\right)}`,
  ])('preserves scoped spacing, styles, nested fractions and literal whitespace in %s', source => {
    expect(() => rejectSpacingArguments(source)).not.toThrow();
  });
  it('checks tokens rather than command-name prefixes or matrix row separators', () => {
    expect(() => rejectSpacingArguments(String.raw`\frac1{2}\;\quadruple`)).not.toThrow();
    expect(() => rejectSpacingArguments(String.raw`\begin{matrix}1\\;2^2\end{matrix}`)).not.toThrow();
  });
  it('leaves unrelated malformed notation to the private grammar without looping', () => {
    for (const source of [String.raw`\frac`, String.raw`\frac{1}{`, String.raw`2^{`, String.raw`\frac1{\;}`, String.raw`2^{\;}`]) {
      expect(() => rejectSpacingArguments(source)).not.toThrow();
    }
  });
  it('bounds scanning work beyond every caller’s existing expression limits', () => {
    expect(() => rejectSpacingArguments(' '.repeat(4096) + String.raw`\frac1{\;2}`)).toThrow(/shorter equation/);
    expect(() => rejectSpacingArguments('{'.repeat(65) + String.raw`\frac1{\;2}` + '}'.repeat(65))).toThrow(/nested/);
  });
  it('matches the pinned renderer’s empty arguments and their properly braced controls', () => {
    expect(convertLatexToMathMl(String.raw`\frac1\;2`)).toMatch(/<mfrac><mn>1<\/mn><mspace[^>]*\/><\/mfrac><mn>2<\/mn>/);
    expect(convertLatexToMathMl(String.raw`\frac\,12`)).toMatch(/<mfrac><mspace[^>]*\/><mn>1<\/mn><\/mfrac><mn>2<\/mn>/);
    expect(convertLatexToMathMl(String.raw`2^\;2`)).toMatch(/<msup><mn>2<\/mn><mspace[^>]*\/><\/msup><mn>2<\/mn>/);
    expect(convertLatexToMathMl(String.raw`\frac1{\;2}`)).toMatch(/<mfrac><mn>1<\/mn><mrow><mspace[^>]*\/><mn>2<\/mn><\/mrow><\/mfrac>/);
    expect(convertLatexToMathMl(String.raw`2^{\;2}`)).toMatch(/<msup><mn>2<\/mn><mrow><mspace[^>]*\/><mn>2<\/mn><\/mrow><\/msup>/);
    expect(convertLatexToMathMl(String.raw`\frac1\left\;2`)).toBe('<mrow><mfrac><mn>1</mn><merror></merror></mfrac><mn>2</mn></mrow>');
    expect(convertLatexToMathMl(String.raw`2^\left\;2`)).toBe('<mrow><msup><mn>2</mn><merror></merror></msup><mn>2</mn></mrow>');
    expect(convertLatexToMathMl(String.raw`2^\left(2\right)`)).toBe('<msup><mn>2</mn><mrow><mo>(</mo><mn>2</mn><mo>)</mo></mrow></msup>');
  });
  it.each([9, 10, 11, 12, 13, 32, 0xA0, 0x2028, 0x2029])('retains literal whitespace U+%s ignored by the pinned renderer', code => {
    const source = '\\frac1' + String.fromCodePoint(code) + '2';
    expect(convertLatexToMathMl(source)).toBe('<mfrac><mn>1</mn><mn>2</mn></mfrac>');
    expect(() => rejectSpacingArguments(source)).not.toThrow();
  });
  it.each([0x1680, 0x2000, 0x2001, 0x2002, 0x2003, 0x2004, 0x2005, 0x2006, 0x2007, 0x2008, 0x2009, 0x200A, 0x202F, 0x205F, 0x3000, 0xFEFF])('preserves the blank argument token U+%s before whitespace removal', code => {
    const blank = String.fromCodePoint(code), source = '\\frac1' + blank + '2';
    expect(convertLatexToMathMl(source)).toBe(`<mrow><mfrac><mn>1</mn><mi>${blank}</mi></mfrac><mn>2</mn></mrow>`);
    expect(() => rejectSpacingArguments(source)).toThrow(/blank space cannot fill a box/);
    expect(() => rejectSpacingArguments('2^' + blank + '2')).toThrow(/blank space cannot fill a box/);
    const bracedFraction = '\\frac1{' + blank + '2}', bracedPower = '2^{' + blank + '2}';
    expect(convertLatexToMathMl(bracedFraction)).toBe(`<mfrac><mn>1</mn><mrow><mi>${blank}</mi><mn>2</mn></mrow></mfrac>`);
    expect(convertLatexToMathMl(bracedPower)).toBe(`<msup><mn>2</mn><mrow><mi>${blank}</mi><mn>2</mn></mrow></msup>`);
    expect(() => rejectSpacingArguments(bracedFraction)).not.toThrow();
    expect(() => rejectSpacingArguments(bracedPower)).not.toThrow();
  });
});

describe('balanced delimiter argument scope', () => {
  it.each([
    String.raw`\frac{1}{\left\;2}`, String.raw`\frac{\left\,1}{2}`, '\\frac1{\\left\u20092}',
    String.raw`\frac1{\mathrm{\left\;2}}`, String.raw`\frac\mathbf{\mathrm{\left\,1}}2`,
    String.raw`\frac1{\left(2\right\;}`, '\\frac1{\\left(2\\right\u2009}',
    String.raw`\frac1{\left(\left[2\right\;\right)}`,
    String.raw`\frac1{\right\,2}`, String.raw`2^{\left\;2}`, '2_{\\mathrm{\\left\u20092}}',
    String.raw`\frac\left(1\right)\;2`, String.raw`\frac\left(\left[1\right]\right)\;2`,
    String.raw`\frac\left(\frac12\right)\;3`, String.raw`\frac\mathbf\left(1\right)\;2`,
    String.raw`\frac\mathrm{\left(1\right)}\;2`, String.raw`\frac1{\frac\left(1\right)\,2}`,
    String.raw`\left\;2`, String.raw`\mathrm{\left\;2}`,
    String.raw`\frac1{\left\left\,2}`, String.raw`\frac1{\left\right\;2}`, String.raw`\frac1{\right\left\;2}`,
    '\\frac1{\\left\\left\u20092}', String.raw`\frac1{\right\right\;2}`,
    String.raw`\frac1{\left2\;}`, String.raw`\frac1{\left\frac12\;}`,
    String.raw`\frac1{\left(2\right\left\;}`, String.raw`\frac1{\left(2\right2\;}`,
    String.raw`\left2`, String.raw`2^\left2`,
  ])('rejects blank delimiters and later empty arguments in %s', source => {
    expect(() => rejectSpacingArguments(source)).toThrow(/blank space cannot fill a box/);
  });
  it.each([
    String.raw`\frac1{\left(\;2\right)}`, String.raw`\frac{\left(\,1\right)}{2}`,
    String.raw`\frac\left(1\right){\;2}`, String.raw`\frac\left(\frac12\right){\;3}`,
    String.raw`\frac\left(\left[1\right]\right){\;2}`, String.raw`\frac\mathbf\left(1\right){\;2}`,
    String.raw`\;\frac\left(1\right) 2`, String.raw`\frac1\left(\;2\right)`,
    String.raw`2^\left(2\right)`, String.raw`2^\left(\;2\right)`, String.raw`2_\left[\,2\right]`,
    String.raw`2^\left(2\right)\frac1{\;2}`, String.raw`2^\left(2\right]\;`,
    String.raw`\frac1{\mathrm{\left(\;2\right)}}`,
    String.raw`\frac1{\left(\left[\left\{\;2\right\}\right]\right)}`,
  ])('preserves complete fenced arguments and correctly scoped spacing in %s', source => {
    expect(() => rejectSpacingArguments(source)).not.toThrow();
  });
  it('confirms the pinned renderer keeps the whole numerator fence before reading the denominator', () => {
    const invalid = convertLatexToMathMl(String.raw`\frac\left(1\right)\;2`);
    expect(invalid).toMatch(/<mfrac><mrow><mo>\(<\/mo><mn>1<\/mn><mo>\)<\/mo><\/mrow><mspace[^>]*\/><\/mfrac><mn>2<\/mn>/);
    expect(convertLatexToMathMl(String.raw`\frac1{\left(\;2\right)}`)).toMatch(/<mfrac><mn>1<\/mn><mrow><mo>\(<\/mo><mrow><mspace[^>]*\/><mn>2<\/mn><\/mrow><mo>\)<\/mo><\/mrow><\/mfrac>/);
  });
  it.each([
    '(', ')', '[', ']', '.', '?', '|', '<', '>', String.raw`\{`, String.raw`\}`, String.raw`\|`,
    ...['Lbag', 'Rbag', 'llbracket', 'rrbracket', 'lbrace', 'rbrace', 'lparen', 'rparen',
      'langle', 'rangle', 'lfloor', 'rfloor', 'lceil', 'rceil', 'lvert', 'rvert', 'lVert', 'rVert',
      'lbrack', 'rbrack', 'ulcorner', 'urcorner', 'llcorner', 'lrcorner', 'lgroup', 'rgroup',
      'lmoustache', 'rmoustache', 'vert', 'Vert', 'surd', 'uparrow', 'downarrow', 'Uparrow',
      'Downarrow', 'updownarrow', 'Updownarrow', 'mid', 'mvert', 'mVert'].map(name => '\\' + name),
  ])('preserves the independently renderer-checked delimiter token %s', delimiter => {
    const source = String.raw`\frac1{\left${delimiter}\;2\right.}`;
    expect(convertLatexToMathMl(source)).not.toContain('<merror>');
    expect(() => rejectSpacingArguments(source)).not.toThrow();
  });
});
