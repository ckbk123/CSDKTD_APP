import { add, decimal, isZero, multiply, neg, one, over, trim, validatePolynomial, zero, type Poly } from './exact';

// A spacing command is an actual TeX argument atom. Keep it until fraction and
// power boxes have been identified; erasing it can move an outside digit inside.
const presentation = /^(?:\\[,;! :]|\\(?:quad|qquad|enspace|thinspace|medspace|thickspace|negthinspace|negmedspace|negthickspace|displaystyle|textstyle)(?![A-Za-z]))/;
const isPresentation = (token?: string) => !!token && presentation.exec(token)?.[0] === token;

/** Module-owned visual grammar. TeX argument boundaries retain their displayed meaning. */
function fractions(source: string, depth = 0): string {
  if (depth > 24) throw new Error('Use fewer nested groups.');
  let i = 0, result = '';
  function arg(): string {
    while (i < source.length && /\s/.test(source[i])) i++;
    if (source[i] === '{') {
      const start = ++i; let level = 1;
      while (i < source.length && level) { if (source[i] === '{') level++; if (source[i] === '}') level--; if (level) i++; }
      if (level) throw new Error('Complete both fraction boxes.'); return fractions(source.slice(start, i++), depth + 1);
    }
    if (source.startsWith('\\frac', i)) { i += 5; return fraction(); }
    if (/^[\ds]$/.test(source[i] ?? '')) return source[i++];
    throw new Error('Use the fraction button; visible parentheses must be inside its boxes.');
  }
  function fraction() { const a = arg(), b = arg(); return `\\frac{${a}}{${b}}`; }
  while (i < source.length) { if (source.startsWith('\\frac', i)) { i += 5; result += fraction(); } else result += source[i++]; }
  return result;
}
export function parsePolynomial(latex: string, allowZero = false): Poly {
  if (!latex.trim()) throw new Error('Enter a polynomial.');
  if (latex.length > 600) throw new Error('Use at most 600 characters.');
  const source = fractions(latex.replace(/\\(?:dfrac|tfrac)/g, '\\frac')
    .replace(/\\(?:times|cdot)/g, '*').replace(/−/g, '-'))
    .replace(/\\(?:left|right)\b/g, '').replace(/^\s*(?:\\(?:displaystyle|textstyle)\s*)*[PND]\s*\(\s*s\s*\)\s*=\s*/, '');
  const tokens: string[] = []; let pos = 0;
  while (pos < source.length) {
    if (/\s/.test(source[pos])) { pos++; continue; }
    const spacing = presentation.exec(source.slice(pos));
    if (spacing) { tokens.push(spacing[0]); pos += spacing[0].length; continue; }
    if (/[eE]/.test(source[pos])) throw new Error('The visual editor displays e/E as a letter. Use a decimal or an explicit power of ten.');
    const m = /^(?:\\frac|(?:\d+(?:\.\d*)?|\.\d+)|[s+\-*/^(){}])/.exec(source.slice(pos));
    if (!m) throw new Error('Use rational numbers, s, sums, products and integer powers.'); tokens.push(m[0]); pos += m[0].length;
  }
  if (tokens.length > 240) throw new Error('Use fewer than 240 terms/symbols.');
  let cursor = 0, depth = 0; const peek = () => tokens[cursor], take = () => tokens[cursor++];
  const skipPresentation = () => { while (isPresentation(peek())) take(); };
  const divideConstant = (a: Poly, b: Poly): Poly => { b = trim(b); if (b.length !== 1) throw new Error('Enter each numerator/denominator as a polynomial; divide only by a number inside this field.'); return a.map(c => over(c, b[0])); };
  function group(): Poly { const open = take(), p = sum(); if (take() !== (open === '{' ? '}' : ')')) throw new Error('Close each group.'); return p; }
  function atom(): Poly {
    skipPresentation();
    if (++depth > 24) throw new Error('Use fewer nested groups.'); let p: Poly; const t = peek();
    if (t === '(') p = group();
    else if (t === '{') {
      const start = cursor; p = group(); const inside = tokens.slice(start + 1, cursor - 1);
      if (inside.length !== 1 || !(/^[\d.]/.test(inside[0]) || inside[0] === 's')) throw new Error('Use visible parentheses around grouped terms; braces alone do not display grouping.');
    } else if (t === '\\frac') {
      take(); if (peek() !== '{') throw new Error('Complete the fraction.'); const a = group(); if (peek() !== '{') throw new Error('Complete the fraction.'); p = divideConstant(a, group());
    } else if (t === 's') { take(); p = [zero, one]; }
    else if (t && /^[\d.]/.test(t)) { take(); p = [decimal(t)]; }
    else throw new Error('Complete each term with a number or s.');
    if (peek() === '^') {
      take(); const braced = peek() === '{'; if (braced) take();
      if (braced) skipPresentation();
      if (!braced && !/^\d$/.test(peek() ?? '')) throw new Error('Use the power button to keep a multi-digit or signed exponent inside its power box.');
      const sign = peek() === '-' ? (take(), -1) : peek() === '+' ? (take(), 1) : 1;
      if (braced) skipPresentation();
      const token = take(), power = sign * Number(token);
      if (!/^\d+$/.test(token ?? '') || Math.abs(power) > 14) throw new Error('Use integer powers from −14 to 14; the resulting polynomial degree is at most four.');
      if (braced) { skipPresentation(); if (take() !== '}') throw new Error('Complete the power box with one integer exponent.'); }
      if (!power && isZero(p)) throw new Error('Zero to the power zero is undefined.');
      if (power < 0) { if (p.length !== 1) throw new Error('Negative powers of s are not polynomials.'); p = [over(one, p[0])]; }
      const base = p; p = [one]; for (let i = 0; i < Math.abs(power); i++) p = multiply(p, base);
    }
    depth--; return p;
  }
  function unary(): Poly { skipPresentation(); if (peek() === '+' || peek() === '-') { const sign = take(), p = unary(); return sign === '-' ? p.map(neg) : p; } return atom(); }
  function product(): Poly {
    const numericFactor = (a: number, b: number) => tokens.slice(a, b).every(t => isPresentation(t) || /^[\d.]/.test(t) || ['+', '-', '^', '{', '}'].includes(t));
    let start = cursor, p = unary(), previousNumeric = numericFactor(start, cursor);
    while (true) {
      skipPresentation();
      if (!(peek() === '*' || peek() === '/' || (peek() && (/^[\d.s({]/.test(peek()) || peek() === '\\frac')))) break;
      const explicit = peek() === '*' || peek() === '/';
      if (!explicit && previousNumeric && (peek() === '\\frac' || peek() === '{' || /^[\d.]/.test(peek()))) throw new Error('Mixed numbers need explicit +; put × between a number and a fraction for multiplication.');
      const op = explicit ? take() : '*'; start = cursor; const q = unary(); previousNumeric = numericFactor(start, cursor);
      p = op === '/' ? divideConstant(p, q) : multiply(p, q);
    }
    return p;
  }
  function sum(): Poly { let p = product(); while (peek() === '+' || peek() === '-') { const op = take(), q = product(); p = add(p, op === '-' ? q.map(neg) : q); } return p; }
  const result = sum(); if (cursor !== tokens.length) throw new Error('Check grouping and remove unsupported notation.');
  return validatePolynomial(result, allowZero);
}
