import { U, Z, addP, degree, divQ, fromNumber, mulP, negQ, q, scaleP, trim, type Poly, type Q } from './algebra';
import { rejectSpacingArguments } from '../../shared/tex-arguments';
type Token = { kind: 'number' | 'variable' | 'power' | '+' | '-' | '*' | '/' | '(' | ')'; value?: string };

/** Read TeX argument boundaries before algebraic expansion; never erase generic braces. */
function tokensOf(latex: string, answer: boolean): Token[] {
  if (!latex.trim() || latex.length > 600) throw new Error('Enter an expression using at most 600 characters.');
  rejectSpacingArguments(latex);
  function rawArgument(start: number, fraction: boolean) {
    let at = start; while (at < latex.length && /\s/.test(latex[at])) at++;
    if (latex[at] === '{') {
      let depth = 1;
      for (let i = at + 1; i < latex.length; i++) { if (latex[i] === '{') depth++; if (latex[i] === '}' && !--depth) return i + 1; }
      throw new Error('Complete and close the fraction or power box.');
    }
    if (/[0-9]/.test(latex[at] ?? '') || (fraction && ['s', 'K'].includes(latex[at]))) return at + 1;
    throw new Error('Complete the fraction or power box; a spacing symbol cannot serve as its argument.');
  }
  for (const match of latex.matchAll(/\\(?:dfrac|frac)|\^/g)) {
    const fraction = match[0] !== '^', end = rawArgument(match.index + match[0].length, fraction);
    if (fraction) rawArgument(end, true);
  }
  if (/[0-9.](?:(?:\\[,!; ]|\\(?:qquad|quad)(?![A-Za-z]))\s*)+[0-9.]/.test(latex)) throw new Error('Use an explicit × between separated numbers; spacing must not join two numeric tokens.');
  const source = latex.replace(/\\(?:left|right)\b/g, '').replace(/\\(?:cdot|times)/g, '*').replace(/\\div/g, '/')
    .replace(/\\(?:qquad|quad)(?![A-Za-z])/g, '').replace(/\\[,!; ]/g, '').replace(/\s/g, '').replace(answer ? /$^/ : /^P\(s\)=/, '');
  let at = 0;
  function argument(depth: number): Token[] {
    if (source[at] === '{') { at++; return read(true, depth + 1); }
    const token = source[at++];
    if (token && /[0-9]/.test(token)) return [{ kind: 'number', value: token }];
    if (token === 's' || token === 'K') return [{ kind: 'variable', value: token }];
    throw new Error('Complete each fraction box; keep a sign inside its box or outside the fraction.');
  }
  function read(stopAtBrace = false, depth = 0): Token[] {
    if (depth > 16) throw new Error('Use at most sixteen nested fraction/group levels.');
    const out: Token[] = [];
    while (at < source.length) {
      const char = source[at], rest = source.slice(at);
      if (char === '}') { if (!stopAtBrace) throw new Error('Use visible parentheses for grouping.'); at++; return out; }
      if (char === '{') throw new Error('Use visible parentheses for grouping; braces belong only to fraction or power boxes.');
      const fraction = /^\\(?:dfrac|frac)/.exec(rest);
      if (fraction) {
        if (out[out.length - 1]?.kind === 'number') throw new Error('Mixed numbers are unsupported. Insert + or × between a whole number and fraction.');
        at += fraction[0].length;
        const numerator = argument(depth), denominator = argument(depth);
        out.push({ kind: '(' }, { kind: '(' }, ...numerator, { kind: ')' }, { kind: '/' }, { kind: '(' }, ...denominator, { kind: ')' }, { kind: ')' });
        continue;
      }
      if (char === '^') {
        const power = /^\^(?:\{(\+?\d+)\}|(\d))/.exec(rest);
        if (!power || Number(power[1] ?? power[2]) > 12) throw new Error('Use the power box for a whole exponent from 0 through 12; negative powers are unsupported.');
        at += power[0].length;
        if (/[0-9.]/.test(source[at] ?? '')) throw new Error('Use the power box for the complete exponent, or insert × before a following number.');
        out.push({ kind: 'power', value: String(Number(power[1] ?? power[2])) }); continue;
      }
      const number = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(rest);
      if (number) { out.push({ kind: 'number', value: number[0] }); at += number[0].length; continue; }
      if (char === 's' || char === 'K') { out.push({ kind: 'variable', value: char }); at++; continue; }
      if (['+', '-', '*', '/', '(', ')'].includes(char)) { out.push({ kind: char as Token['kind'] }); at++; continue; }
      throw new Error('Use real numbers, s, K, fractions, products, visible parentheses and bounded powers. Visual e notation and other functions/symbols are unsupported.');
    }
    if (stopAtBrace) throw new Error('Complete and close both fraction boxes.');
    return out;
  }
  const out = read(); if (!out.length || out.length > 256) throw new Error('Use at most 256 symbols, including fraction parts.'); return out;
}
function parse(latex: string, gain: number | null): Poly {
  const answer = gain === null, tokens = tokensOf(latex, answer); let at = 0, depth = 0;
  if (gain !== null && (!Number.isFinite(gain) || Math.abs(gain) > 1000)) throw new Error('Choose finite K in [−1000,1000].');
  function atom(): Poly {
    if (++depth > 16) throw new Error('Use at most sixteen nested fraction/group levels.');
    const token = tokens[at++]; let value: Poly;
    if (token?.kind === '(') { value = sum(); if (tokens[at++]?.kind !== ')') throw new Error('Close every parenthesis and complete each term.'); }
    else if (token?.kind === 'number') {
      const text = token.value!, [whole, decimals = ''] = text.split('.');
      if (text.replace('.', '').length > (answer ? 60 : 12) || decimals.length > (answer ? 40 : 8)) throw new Error(answer ? 'Answer literals allow at most 60 digits and 40 decimal places.' : 'Input literals allow at most 12 digits and 8 decimal places.');
      value = [q(BigInt((whole || '0') + decimals), 10n ** BigInt(decimals.length))];
    } else if (token?.kind === 'variable' && !answer) value = token.value === 's' ? [Z, U] : [fromNumber(gain!)];
    else throw new Error(answer ? 'Enter an exact numeric answer; variables are unsupported.' : 'Complete the polynomial with a number, s, K or visible parenthesized term.');
    depth--;
    if (tokens[at]?.kind === 'power') {
      const power = Number(tokens[at++].value);
      if (!power && value.every(c => !c.n)) throw new Error('0 to the power 0 is unsupported.');
      const base = value; value = [U];
      for (let i = 0; i < power; i++) { value = mulP(value, base); if (degree(value) > 6) throw new Error('The characteristic polynomial supports degree at most six.'); }
    }
    return value;
  }
  function signed(): Poly {
    if (tokens[at]?.kind === '+' || tokens[at]?.kind === '-') { const negative = tokens[at++].kind === '-', result = signed(); return negative ? result.map(negQ) : result; }
    return atom();
  }
  function product(): Poly {
    let value = signed();
    while (at < tokens.length) {
      const next = tokens[at].kind;
      if (next === '/') {
        at++; const denominator = trim(signed());
        if (denominator.length > 1 || !denominator[0].n) throw new Error('Divide only by a nonzero constant; enter a characteristic polynomial, not a transfer function.');
        value = scaleP(value, divQ(U, denominator[0]));
      } else if (next === '*' || next === '(' || next === 'number' || next === 'variable') {
        if (next === '*') at++; value = mulP(value, signed());
        if (degree(value) > 6) throw new Error('The characteristic polynomial supports degree at most six.');
      } else break;
    }
    return value;
  }
  function sum(): Poly { let value = product(); while (tokens[at]?.kind === '+' || tokens[at]?.kind === '-') { const negative = tokens[at++].kind === '-'; value = addP(value, product(), negative); } return value; }
  const value = trim(sum()); if (at !== tokens.length) throw new Error('Check operators, exponents and visible parentheses.'); return value;
}
export function parseCharacteristic(latex: string, gain: number): Poly {
  const value = parse(latex, gain); if (degree(value) < 1 || degree(value) > 6) throw new Error('Use a nonzero characteristic polynomial of degree 1..6.'); return value;
}
export function parseAnswer(latex: string): Q { const value = parse(latex, null); if (value.length !== 1) throw new Error('Enter an exact numeric answer.'); return value[0]; }
