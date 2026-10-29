const fractionCommand = /^\\(?:dfrac|tfrac|frac)$/;
const styleCommand = /^\\(?:mathrm|mathit|mathbf|mathsf|mathtt|mathnormal|mathcal|mathfrak|mathbb|text|operatorname|boldsymbol)$/;
const spacingCommand = /^\\(?:[,;!:> ]|quad|qquad|enspace|enskip|thinspace|medspace|thickspace|negthinspace|negmedspace|negthickspace|space|hspace|hskip|kern|mkern|mskip)$/;
const possibleSpacing = /\\(?:[,;!:> ]|(?:quad|qquad|enspace|enskip|thinspace|medspace|thickspace|negthinspace|negmedspace|negthickspace|space|hspace|hskip|kern|mkern|mskip)(?![A-Za-z]))/;
// MathLive ignores these literal separators. Other JavaScript \s characters
// (for example U+2009) remain blank-looking argument tokens in its MathML.
const ignoredWhitespace = /[\t-\r \u00A0\u2028\u2029]/;
const blankSymbol = /^[\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]$/;
const possibleBlankSymbol = /[\u1680\u2000-\u200A\u202F\u205F\u3000\uFEFF]/;
// A finite set of standard delimiter tokens accepted by pinned MathLive.
// Neither another sizing command nor a number/expression is a delimiter.
const delimiterTokens = new Set([
  '(', ')', '[', ']', '.', '?', '|', '<', '>', '\\{', '\\}', '\\|',
  ...['Lbag', 'Rbag', 'llbracket', 'rrbracket', 'lbrace', 'rbrace', 'lparen', 'rparen',
    'langle', 'rangle', 'lfloor', 'rfloor', 'lceil', 'rceil', 'lvert', 'rvert', 'lVert', 'rVert',
    'lbrack', 'rbrack', 'ulcorner', 'urcorner', 'llcorner', 'lrcorner', 'lgroup', 'rgroup',
    'lmoustache', 'rmoustache', 'vert', 'Vert', 'surd', 'uparrow', 'downarrow', 'Uparrow',
    'Downarrow', 'updownarrow', 'Updownarrow', 'mid', 'mvert', 'mVert'].map(name => '\\' + name),
]);
const incompleteBox = 'Complete the fraction and power boxes with numbers or expressions. A blank space cannot fill a box.';

/** Preserve TeX argument scope before a private grammar removes spacing.
 * Ordinary literal separators are ignored; an explicit spacing command or
 * significant blank symbol cannot stand in for a fraction or script value.
 * This is a bounded lexical preflight, not an expression parser or validator. */
export function rejectSpacingArguments(source: string): void {
  const hasFence = /\\(?:left|right)(?![A-Za-z])/.test(source);
  if (!hasFence && ((!possibleSpacing.test(source) && !possibleBlankSymbol.test(source)) || !/(?:\\(?:dfrac|tfrac|frac)(?![A-Za-z])|[_^])/.test(source))) return;
  if (source.length > 4096) throw new Error('Use a shorter equation to check its TeX arguments.');
  let cursor = 0, depth = 0;
  function token(): string {
    while (cursor < source.length && ignoredWhitespace.test(source[cursor])) cursor++;
    if (cursor === source.length) return '';
    const start = cursor++, character = source[start];
    if (character === '\\') {
      if (/[A-Za-z]/.test(source[cursor] ?? '')) while (cursor < source.length && /[A-Za-z]/.test(source[cursor])) cursor++;
      else if (cursor < source.length) cursor++;
    }
    return source.slice(start, cursor);
  }
  function group(): void {
    if (++depth > 64) throw new Error('Use fewer nested TeX argument groups.');
    scan('brace'); depth--;
  }
  function requireValue(next: string): void {
    if (spacingCommand.test(next) || blankSymbol.test(next)) throw new Error(incompleteBox);
  }
  function delimiter(): void {
    // Delimiter-sizing commands are removed by some callers. Check their
    // actual delimiter token at every depth before that evidence disappears.
    if (!delimiterTokens.has(token())) throw new Error(incompleteBox);
  }
  function fence(): void {
    if (++depth > 64) throw new Error('Use fewer nested TeX argument groups.');
    delimiter(); scan('fence'); depth--;
  }
  function argument(): void {
    if (++depth > 64) throw new Error('Use fewer nested TeX argument groups.');
    const next = token();
    requireValue(next);
    if (next === '{') group();
    // A balanced \left…\right fence, including nested fences, is one TeX
    // argument. Its opening delimiter alone is not the next fraction argument.
    else if (next === '\\left') fence();
    else if (next === '\\right') delimiter();
    else if (fractionCommand.test(next)) { argument(); argument(); }
    else if (styleCommand.test(next)) argument();
    depth--;
  }
  function scan(close?: 'brace' | 'fence'): void {
    while (cursor < source.length) {
      const beforeToken = cursor;
      const next = token();
      if (next === '}') {
        if (close === 'brace') return;
        // An incomplete fence cannot swallow its enclosing brace. The private
        // grammar remains responsible for unrelated malformed grouping.
        if (close === 'fence') { cursor = beforeToken; return; }
      }
      if (next === '{') group();
      else if (next === '\\left') fence();
      else if (next === '\\right') { delimiter(); if (close === 'fence') return; }
      else if (fractionCommand.test(next)) { argument(); argument(); }
      else if (next === '^' || next === '_') argument();
    }
  }
  scan();
}
