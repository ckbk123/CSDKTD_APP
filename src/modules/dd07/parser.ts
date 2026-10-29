/** Small literal/matrix/quadratic grammar; never executes input as code. */
function clean(text: string): string {
  if (text.length > 600) throw new Error('Use at most 600 characters per equation.');
  // Spacing is a TeX atom in an unbraced argument, not a digit separator.
  // Check its scope before normalization can consume the following digit.
  const argumentEnd = (from: number): number => {
    let start = from; while (/\s/.test(text[start] ?? '') && start < text.length) start++;
    if (text[start] === '\\' && /[,!;: ]/.test(text[start + 1] ?? '')) throw new Error('Complete the fraction or power box; an explicit spacing command cannot supply an unbraced argument.');
    if (text[start] !== '{') return start + 1;
    let depth = 1, end = start + 1;
    while (end < text.length && depth) { if (text[end] === '{') depth++; if (text[end] === '}') depth--; end++; }
    return end;
  };
  for (const match of text.matchAll(/\\(?:dfrac|frac)/g)) argumentEnd(argumentEnd(match.index! + match[0].length));
  for (const match of text.matchAll(/\^/g)) argumentEnd(match.index! + 1);
  // A row separator followed by whitespace is two backslashes, not a TeX
  // backslash-space command starting at its second backslash.
  return text.replace(/\\(?:left|right)/g, '').replace(/(?<!\\)\\[,!;: ]/g, '').replace(/\s/g, '');
}
function argument(text: string, start: number): [string, number] {
  if (text[start] !== '{') {
    if (!/\d/.test(text[start] ?? '')) throw new Error('Complete both fraction boxes. Group signed or multi-digit arguments.');
    return [text[start], start + 1];
  }
  let depth = 1, end = start + 1;
  while (end < text.length && depth) { if (text[end] === '{') depth++; if (text[end] === '}') depth--; end++; }
  if (depth) throw new Error('Close each fraction argument.');
  return [text.slice(start + 1, end - 1), end];
}
function fraction(text: string, start: number, depth: number): [number, number] {
  const command = text.startsWith('\\dfrac', start) ? 6 : 5;
  const [a, next] = argument(text, start + command), [b, end] = argument(text, next);
  const denominator = scalarInner(b, depth + 1);
  if (denominator === 0) throw new Error('A fraction denominator cannot be zero.');
  const numerator = scalarInner(a, depth + 1), result = numerator / denominator;
  if (!Number.isFinite(result) || (result === 0 && numerator !== 0)) throw new Error('Fraction is outside representable numeric range.');
  return [result, end];
}
function scalarInner(text: string, depth: number): number {
  if (depth > 8 || !text) throw new Error('Enter a short number or a numeric fraction.');
  if (text[0] === '+' || text[0] === '-') return (text[0] === '-' ? -1 : 1) * scalarInner(text.slice(1), depth + 1);
  if ((text[0] === '(' && text.endsWith(')')) || (text[0] === '{' && text.endsWith('}'))) return scalarInner(text.slice(1, -1), depth + 1);
  if (text.startsWith('\\frac') || text.startsWith('\\dfrac')) {
    const [value, end] = fraction(text, 0, depth);
    if (end !== text.length) throw new Error('Enter one evaluated number or numeric fraction; scalar arithmetic and adjacent numeric parts are unsupported here.');
    return value;
  }
  if (!/^(?:\d{1,8}(?:\.\d{0,12})?|\.\d{1,12})$/.test(text)) throw new Error('Use a decimal or a signed numeric fraction. Use visible parentheses, not hidden grouping or mixed-number adjacency. Symbols and scientific e notation are unsupported.');
  const value = Number(text);
  if (!Number.isFinite(value) || value > 1e8) throw new Error('Numeric literal is too large.');
  return value;
}
export function parseScalar(source: string): number { return scalarInner(clean(source), 0); }

export function parseMatrix(source: string, rows: number, columns: number, name: string): number[] {
  let text = clean(source);
  if (text.startsWith(`${name}=`)) text = text.slice(name.length + 1);
  const match = /^\\begin\{(bmatrix|pmatrix|matrix)\}([\s\S]*)\\end\{\1\}$/.exec(text);
  if (!match) throw new Error(`${name} needs an editable ${rows} by ${columns} matrix.`);
  const data = match[2].split('\\\\').map(row => row.split('&'));
  if (data.length !== rows || data.some(row => row.length !== columns)) throw new Error(`${name} must have ${rows} row(s) and ${columns} column(s).`);
  const values = data.flat().map(parseScalar);
  if (values.some(v => Math.abs(v) > 1000)) throw new Error(`${name} entries must have magnitude at most 1,000.`);
  return values;
}

type Poly = [number, number, number]; // ascending powers, internal only
const multiply = (a: Poly, b: Poly): Poly => {
  if (a[2] * b[1] || a[1] * b[2] || a[2] * b[2]) throw new Error('Only quadratic target polynomials are supported.');
  return [a[0] * b[0], a[0] * b[1] + a[1] * b[0], a[0] * b[2] + a[1] * b[1] + a[2] * b[0]];
};
export function parseTarget(source: string): [number, number] {
  let text = clean(source).replace(/^[qD]\(z\)=/, '').replace(/\\(?:cdot|times)/g, '*');
  const tokens: (string | number)[] = [];
  let i = 0;
  while (i < text.length) {
    if (tokens.length > 120) throw new Error('Target expression is too long.');
    if (text.startsWith('\\frac', i) || text.startsWith('\\dfrac', i)) {
      const previous = tokens.at(-1);
      if (typeof previous === 'number' || previous === ')') throw new Error('Use explicit + or × before a fraction; mixed-number adjacency is unsupported.');
      const [value, end] = fraction(text, i, 0); tokens.push(value); i = end; continue;
    }
    const numeric = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(text.slice(i));
    if (numeric) { if (typeof tokens.at(-1) === 'number') throw new Error('Separate numeric factors with ×.'); tokens.push(parseScalar(numeric[0])); i += numeric[0].length; continue; }
    if (text.startsWith('^{2}', i)) { tokens.push('^', 2); i += 4; continue; }
    if (text[i] === '^') {
      // TeX takes one unbraced token: ^02 is not ^{2}, nor is ^2.0.
      if (text[i + 1] !== '2' || /[\d.]/.test(text[i + 2] ?? '')) throw new Error('Use the square button or an unambiguous square exponent.');
      tokens.push('^', 2); i += 2; continue;
    }
    if ('z+-*/()'.includes(text[i])) { tokens.push(text[i++]); continue; }
    throw new Error('Use z, real numbers, numeric fractions, visible parentheses, +, −, × and squares. Hidden braces, functions and e/E symbols are unsupported.');
  }
  let pos = 0, nesting = 0;
  const peek = () => tokens[pos];
  function atom(): Poly {
    if (++nesting > 12) throw new Error('Target expression nesting exceeds 12.');
    const t = tokens[pos++]; let result: Poly;
    if (t === '-' || t === '+') result = atom().map(n => n * (t === '-' ? -1 : 1)) as Poly;
    else if (typeof t === 'number') result = [t, 0, 0];
    else if (t === 'z') result = [0, 1, 0];
    else if (t === '(') { result = sum(); if (tokens[pos++] !== ')') throw new Error('Close the target parentheses.'); }
    else throw new Error('Complete the desired target polynomial.');
    if (peek() === '^') { pos++; if (tokens[pos++] !== 2) throw new Error('Only the square power is supported.'); result = multiply(result, result); }
    nesting--; return result;
  }
  function product(): Poly {
    let result = atom();
    while (pos < tokens.length) {
      const t = peek();
      if (t === '*' || t === '/') {
        pos++; const other = atom();
        if (t === '/') {
          if (other[1] || other[2] || other[0] === 0) throw new Error('Divide only by a nonzero numeric constant.');
          result = result.map(n => n / other[0]) as Poly;
        } else result = multiply(result, other);
      } else if (t === 'z' || t === '(') result = multiply(result, atom());
      else break;
    }
    return result;
  }
  function sum(): Poly {
    let result = product();
    while (peek() === '+' || peek() === '-') { const sign = tokens[pos++] === '+' ? 1 : -1, other = product(); result = result.map((n, j) => n + sign * other[j]) as Poly; }
    return result;
  }
  const p = sum();
  if (pos !== tokens.length || p[2] !== 1 || !p.every(Number.isFinite)) throw new Error('Use a real monic quadratic q(z)=z²+d₁z+d₀.');
  if (p.some(n => Math.abs(n) > 10000)) throw new Error('Target coefficient magnitudes must be at most 10,000.');
  return [p[1], p[0]];
}
