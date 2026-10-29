const fail = (text: string): never => { throw new Error(text); };

/** Bounded constant expressions, preserving TeX one-token fraction arguments.
 * No variables, scientific e/E literals, functions or executable evaluation. */
export function parseConstant(latex: string): number {
  if (!latex.trim() || latex.length > 160) fail('Use a nonempty constant expression of at most 160 characters per entry.');
  if (/\d\s+\d/.test(latex)) fail('Use a multiplication sign between separate numbers.');
  let s = latex.replace(/\\left|\\right/g, '').replace(/\\(?:times|cdot)/g, '*')
    .replace(/\\[,;! ]/g, '').replace(/−/g, '-').replace(/\s/g, '');
  s = s.replace(/\\(?:mathrm|mathit|mathbf|mathsf|mathtt|text)\{([+-]?(?:\d+(?:\.\d*)?|\.\d+))\}/g, '{$1}')
    .replace(/\\(?:mathrm|mathit|mathbf|mathsf|mathtt)([0-9])/g, '{$1}');
  let at = 0, depth = 0;
  const command = (): string | undefined => /^(?:\\frac|\\dfrac|\\tfrac)/.exec(s.slice(at))?.[0];
  function arg(): string {
    if (++depth > 12) fail('Use at most 12 nested groups per entry.');
    let out: string;
    if (s[at] === '{') { at++; out = sequence(true); if (s[at++] !== '}') fail('Complete each fraction/group.'); }
    else if (command()) out = fraction();
    else { if (at >= s.length || s[at] === '}') fail('Complete each fraction.'); out = s[at++]; }
    depth--; return out;
  }
  function fraction(): string { at += command()!.length; const n = arg(), d = arg(); return '((' + n + ')/(' + d + '))'; }
  function sequence(stop: boolean): string {
    let out = '';
    while (at < s.length && !(stop && s[at] === '}')) {
      if (command()) out += fraction();
      else if (s[at] === '{') out += '(' + arg() + ')';
      else if (s[at] === '}') fail('Remove the unmatched closing brace.');
      else out += s[at++];
    }
    return out;
  }
  const plain = sequence(false), tokens = plain.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/]/g) ?? [];
  if (!tokens.length || tokens.join('') !== plain) fail('Use decimal constants, fractions, sums and products. Letters, functions and powers are unsupported in entries.');
  let p = 0; depth = 0;
  function bounded(x: number): number {
    if (!Number.isFinite(x) || Math.abs(x) > 1e8) fail('Keep intermediate entry values finite and within 10⁸.');
    return x;
  }
  function atom(): number {
    if (++depth > 12) fail('Use at most 12 nested groups per entry.');
    const t = tokens[p++]; let x: number;
    if (t === '(') { x = sum(); if (tokens[p++] !== ')') fail('Close every parenthesis.'); }
    else if (t && /^(?:\d|\.)/.test(t)) {
      x = Number(t);
      if (x === 0 && /[1-9]/.test(t)) fail('A nonzero decimal is too small to represent. Rescale the entry.');
    } else return fail('Complete each entry with a constant or fraction.');
    depth--; return bounded(x);
  }
  function unary(): number { if (tokens[p] === '+' || tokens[p] === '-') { const sign = tokens[p++] === '-' ? -1 : 1; return sign * atom(); } return atom(); }
  function term(): number {
    let x = unary();
    while (tokens[p] === '*' || tokens[p] === '/') {
      const op = tokens[p++], y = unary();
      if (op === '/' && y === 0) fail('An entry denominator cannot be zero.');
      const next = bounded(op === '*' ? x * y : x / y);
      if (next === 0 && x !== 0 && y !== 0) fail('A nonzero entry calculation is too small to represent. Rescale it.');
      x = next;
    }
    return x;
  }
  function sum(): number { let x = term(); while (tokens[p] === '+' || tokens[p] === '-') { const sign = tokens[p++] === '+' ? 1 : -1; x = bounded(x + sign * term()); } return x; }
  const value = sum();
  if (p !== tokens.length) fail('Check the entry operators and parentheses.');
  if (Math.abs(value) > 1e4) fail('Matrix entries must have magnitude at most 10⁴.');
  return value;
}

/** Row-major visual matrix, not a programming-language array grammar. */
export function parseMatrix(latex: string, rows: number, cols: number, name: string): number[][] {
  if (![1, 2].includes(rows) || ![1, 2].includes(cols)) fail('Only matrix dimensions 1–2 are supported.');
  if (latex.length > 1200) fail(name + ' is too long; use at most 1,200 characters.');
  let source = latex.trim().replace(new RegExp('^' + name + '\\s*='), '').trim();
  source = source.replace(/\\left\s*[\[(]|\\right\s*[\])]/g, '');
  const matrix = /^\\begin\{(bmatrix|pmatrix|matrix)\}([\s\S]*)\\end\{\1\}$/.exec(source);
  let entries: string[][];
  if (matrix) entries = matrix[2].split(/\\\\/).map(row => row.split('&'));
  else if (rows === 1 && cols === 1) entries = [[source]];
  else return fail('Enter ' + name + ' in the provided ' + rows + '×' + cols + ' matrix template, or use the numeric entry controls.');
  if (entries.length !== rows || entries.some(row => row.length !== cols)) fail(name + ' must have ' + rows + ' rows and ' + cols + ' columns.');
  return entries.map(row => row.map(parseConstant));
}

/** Preserve all native numeric digits when filling a visual template. */
export function constantText(value: number): string {
  if (!Number.isFinite(value) || Math.abs(value) > 1e4) fail('Matrix entries must be finite with magnitude at most 10⁴.');
  const negative = value < 0, [mantissa, exponent] = Math.abs(value).toString().split('e');
  if (exponent === undefined) return String(value);
  const digits = mantissa.replace('.', ''), position = (mantissa.indexOf('.') < 0 ? mantissa.length : mantissa.indexOf('.')) + Number(exponent);
  const plain = position <= 0 ? '0.' + '0'.repeat(-position) + digits : position >= digits.length ? digits + '0'.repeat(position - digits.length) : digits.slice(0, position) + '.' + digits.slice(position);
  const out = (negative ? '-' : '') + plain;
  if (out.length > 160) fail('This matrix entry requires more than 160 decimal characters. Rescale the coordinates.');
  return out;
}
export const matrixInput = (a: number[][]): string => '\\begin{bmatrix}' + a.map(row => row.map(constantText).join('&')).join('\\\\') + '\\end{bmatrix}';
