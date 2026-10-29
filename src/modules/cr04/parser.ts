import { ONE, addTF, degree, divTF, mulTF, negTF, q, subTF, tf, zeroTF, type TF } from './algebra';
import { rejectSpacingArguments } from '../../shared/tex-arguments';
type Token = Readonly<{ kind: 'number' | 's' | 'power' | '+' | '-' | '*' | '/' | '(' | ')'; value?: string }>;

/** The editor checks notation; this reader separately checks the supported displayed meaning. */
function tokensOf(latex: string): readonly Token[] {
  if (!latex.trim() || latex.length > 600) throw new Error('Enter a transfer using at most 600 characters.');
  rejectSpacingArguments(latex);
  function rawArgument(start: number, fraction: boolean): number {
    let at = start; while (at < latex.length && /\s/.test(latex[at])) at++;
    if (latex[at] === '{') {
      let depth = 1;
      for (let i = at + 1; i < latex.length; i++) { if (latex[i] === '{') depth++; if (latex[i] === '}' && !--depth) return i + 1; }
      throw new Error('Complete and close every fraction or power box.');
    }
    if (/[0-9]/.test(latex[at] ?? '') || fraction && latex[at] === 's') return at + 1;
    throw new Error('Complete the fraction or power box; spacing or an unbraced parenthesis cannot serve as its argument.');
  }
  for (const match of latex.matchAll(/\\(?:dfrac|frac)|\^/g)) {
    const fraction = match[0] !== '^', end = rawArgument(match.index + match[0].length, fraction);
    if (fraction) rawArgument(end, true);
  }
  if (/[0-9.](?:(?:\\[,!; ]|\\(?:qquad|quad)(?![A-Za-z]))\s*)+[0-9.]/.test(latex)) throw new Error('Use an explicit × between separated numbers; spacing cannot join numeric tokens.');
  const source = latex.replace(/\\(?:left|right)\b/g, '').replace(/\\(?:cdot|times)/g, '*').replace(/\\div/g, '/')
    .replace(/\\(?:qquad|quad)(?![A-Za-z])/g, '').replace(/\\[,!; ]/g, '').replace(/\s/g, '').replace(/^[A-Z][A-Za-z0-9]{0,11}(?:\(s\))?=/, '');
  let at = 0;
  function argument(depth: number): readonly Token[] {
    if (source[at] === '{') { at++; return read(true, depth + 1); }
    const token = source[at++];
    if (token && /[0-9]/.test(token)) return [{ kind: 'number', value: token }];
    if (token === 's') return [{ kind: 's' }];
    throw new Error('Complete both fraction boxes; keep a sign inside its box or outside the fraction.');
  }
  function read(stopAtBrace = false, depth = 0): readonly Token[] {
    if (depth > 16) throw new Error('Use at most sixteen nested fraction/group levels.');
    const out: Token[] = [];
    while (at < source.length) {
      const char = source[at], rest = source.slice(at);
      if (char === '}') { if (!stopAtBrace) throw new Error('Use visible parentheses for grouping.'); at++; return out; }
      if (char === '{') throw new Error('Use visible parentheses; braces belong only to fraction and power boxes.');
      const fraction = /^\\(?:dfrac|frac)/.exec(rest);
      if (fraction) {
        if (out[out.length - 1]?.kind === 'number') throw new Error('Mixed numbers are unsupported. Insert + or × between a whole number and fraction.');
        at += fraction[0].length; const numerator = argument(depth), denominator = argument(depth);
        out.push({ kind: '(' }, { kind: '(' }, ...numerator, { kind: ')' }, { kind: '/' }, { kind: '(' }, ...denominator, { kind: ')' }, { kind: ')' }); continue;
      }
      if (char === '^') {
        const power = /^\^(?:\{(\+?\d+)\}|(\d))/.exec(rest);
        if (!power || Number(power[1] ?? power[2]) > 12) throw new Error('Use the power box for an integer from 0 through 12. Negative powers are unsupported; use a fraction.');
        at += power[0].length;
        if (/[0-9.]/.test(source[at] ?? '')) throw new Error('Use the complete power box, or insert × before a following number.');
        out.push({ kind: 'power', value: power[1] ?? power[2] }); continue;
      }
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(rest);
      if (number) { out.push({ kind: 'number', value: number[0] }); at += number[0].length; continue; }
      if (char === 's') { out.push({ kind: 's' }); at++; continue; }
      if (['+', '-', '*', '/', '(', ')'].includes(char)) { out.push({ kind: char as Token['kind'] }); at++; continue; }
      throw new Error('Use real numbers, s, fractions, visible parentheses and bounded powers. Other variables, functions and visual e notation are unsupported.');
    }
    if (stopAtBrace) throw new Error('Complete and close both fraction boxes.');
    return out;
  }
  const tokens = read(); if (!tokens.length || tokens.length > 256) throw new Error('Use at most 256 symbols, including fraction parts.'); return tokens;
}

export function parseTransfer(latex: string, purpose: 'block' | 'answer' = 'block'): TF {
  const tokens = tokensOf(latex), answer = purpose === 'answer'; let at = 0, depth = 0;
  function atom(): TF {
    if (++depth > 16) throw new Error('Use at most sixteen nested fraction/group levels.');
    const token = tokens[at++]; let value: TF;
    if (token?.kind === '(') { value = sum(); if (tokens[at++]?.kind !== ')') throw new Error('Close every parenthesis and complete each term.'); }
    else if (token?.kind === 'number') {
      const text = token.value!, [whole, decimals = ''] = text.split('.');
      if (text.replace('.', '').length > (answer ? 60 : 12) || decimals.length > (answer ? 40 : 8)) throw new Error(answer ? 'Answer literals allow sixty digits and forty decimal places.' : 'Block literals allow twelve digits and eight decimal places.');
      value = tf([q(BigInt((whole || '0') + decimals), 10n ** BigInt(decimals.length))]);
    } else if (token?.kind === 's') value = tf([q(0), q(1)]);
    else throw new Error('Complete the transfer with a number, s or visible parenthesized term.');
    depth--;
    if (tokens[at]?.kind === 'power') {
      const power = Number(tokens[at++].value); if (!power && zeroTF(value)) throw new Error('0 to the power 0 is unsupported.');
      const base = value; value = ONE; for (let i = 0; i < power; i++) value = mulTF(value, base);
    }
    return value;
  }
  function signed(): TF {
    if (tokens[at]?.kind === '+' || tokens[at]?.kind === '-') { const negative = tokens[at++].kind === '-', value = signed(); return negative ? negTF(value) : value; }
    return atom();
  }
  function product(): TF {
    let value = signed();
    while (at < tokens.length) {
      const next = tokens[at].kind;
      if (next === '/') { at++; value = divTF(value, signed()); }
      else if (next === '*' || next === '(' || next === 'number' || next === 's') { if (next === '*') at++; value = mulTF(value, signed()); }
      else break;
    }
    return value;
  }
  function sum(): TF {
    let value = product();
    while (tokens[at]?.kind === '+' || tokens[at]?.kind === '-') { const subtract = tokens[at++].kind === '-'; value = subtract ? subTF(value, product()) : addTF(value, product()); }
    return value;
  }
  const value = sum(); if (at !== tokens.length) throw new Error('Check operators, powers and visible parentheses.');
  if (!answer) {
    if (degree(value.n) > 3 || degree(value.d) > 3) throw new Error('An entered block supports reduced numerator/denominator degree at most three.');
    if ([...value.n, ...value.d].some(c => (c.n < 0n ? -c.n : c.n) > 1000000000000n || c.d > 1000000000000n || (c.n < 0n ? -c.n : c.n) > 1000000n * c.d)) throw new Error('Reduced block coefficient parts must be ≤10¹² and magnitudes ≤10⁶.');
  }
  return value;
}
