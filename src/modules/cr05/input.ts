import { Work, add, constant, div, isZero, mul, negate, variable, type Gain } from './algebra';
import { rejectSpacingArguments } from '../../shared/tex-arguments';

/** A small TeX-aware expression reader. Argument boundaries are consumed before
 * whitespace macros/braces can be erased; formatting braces never imply a group. */
export function parseGain(raw: string): Gain {
  if (!raw.trim() || raw.length > 256) throw new Error('Enter a gain with at most 256 characters.');
  rejectSpacingArguments(raw);
  let i = 0, depth = 0, atoms = 0;
  const w = new Work(30000);
  const fail = (message = 'Use numbers, s, visible parentheses, fractions, × and powers 0–2.') => { throw new Error(message); };
  const space = () => { while (/\s/.test(raw[i] ?? '') && i < raw.length) i++; };
  const at = (s: string) => raw.startsWith(s, i);
  function command(): string { const m = /^\\([A-Za-z]+|.)/.exec(raw.slice(i)); if (!m) return ''; i += m[0].length; return m[1]; }
  function argument(): Gain {
    space();
    if (raw[i] === '{') { i++; const a = expression(); space(); if (raw[i++] !== '}') fail('Complete both fraction boxes.'); return a; }
    // One unbraced TeX token, including the single digit in \frac12.
    if (/\d/.test(raw[i] ?? '')) return constant(BigInt(raw[i++]));
    if (raw[i] === 's') { i++; return variable(); }
    if (at('\\frac') || at('\\dfrac') || at('\\tfrac')) return primary();
    return fail('Complete each fraction box; put signed or multi-character arguments inside the visible fraction boxes.');
  }
  function primary(): Gain {
    space(); if (++atoms > 96 || ++depth > 12) fail('Expression size limit reached. Use a simpler gain.');
    let value: Gain;
    if (raw[i] === '(' || at('\\left(')) {
      i += raw[i] === '(' ? 1 : 6; value = expression(); space();
      if (at('\\right)')) i += 7; else if (raw[i] === ')') i++; else fail('Close the visible parentheses.');
    } else if (raw[i] === 's') { i++; value = variable(); }
    else if (raw[i] === '\\') {
      const name = command(); if (!['frac', 'dfrac', 'tfrac'].includes(name)) return fail('Unsupported symbol. Use s and ordinary numbers; enter fractions with the fraction button.');
      const top = argument(), bottom = argument(); value = div(top, bottom, w);
    } else {
      const m = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(raw.slice(i)); if (!m) return fail();
      i += m[0].length;
      const parts = m[0].split('.'), digits = parts.join('');
      if (digits.length > 9 || (parts[1]?.length ?? 0) > 6 || Number(m[0]) > 1000) return fail('Numbers may have at most 9 digits, 6 decimal places and magnitude 1000.');
      value = constant(BigInt(digits), 10n ** BigInt(parts[1]?.length ?? 0));
    }
    depth--; space();
    if (raw[i] === '^') {
      i++; space(); let power: string;
      if (raw[i] === '{') { i++; const end = raw.indexOf('}', i); if (end < 0) return fail('Complete the power box.'); power = raw.slice(i, end).trim(); i = end + 1; }
      else { power = raw[i++] ?? ''; if (/[\d.]/.test(raw[i] ?? '') || !/^[012]$/.test(power)) return fail('Use the power button and put one exponent 0, 1 or 2 inside its box.'); }
      if (!/^[012]$/.test(power)) return fail('Only powers 0, 1 and 2 are supported.');
      if (power === '0' && isZero(value)) return fail('Zero to the zeroth power is undefined here.');
      value = power === '0' ? constant(1n) : power === '2' ? mul(value, value, w) : value;
    }
    return value;
  }
  function signed(): Gain { space(); if (raw[i] === '+' || raw[i] === '-') { const minus = raw[i++] === '-'; const a = signed(); return minus ? negate(a) : a; } return primary(); }
  function product(): Gain {
    let a = signed();
    while (true) {
      space();
      let explicit = false;
      if (raw[i] === '*') { i++; explicit = true; }
      else if (at('\\times') || at('\\cdot')) { command(); explicit = true; }
      else if (raw[i] === '/') { i++; a = div(a, signed(), w); continue; }
      else if (at('\\,') || at('\\;') || at('\\!') || at('\\quad') || at('\\qquad')) { command(); continue; }
      else if (!(/[\d.s(]/.test(raw[i] ?? '') || at('\\left(') || at('\\frac') || at('\\dfrac') || at('\\tfrac'))) break;
      if (!explicit && (at('\\frac') || at('\\dfrac') || at('\\tfrac'))) return fail('Put an explicit + or × before a fraction; mixed-number adjacency is unsupported.');
      if (!explicit && /[\d.]/.test(raw[i] ?? '')) return fail('Put an explicit × before an adjacent number; separated digits must not silently become a product.');
      a = mul(a, signed(), w);
    }
    return a;
  }
  function expression(): Gain {
    let a = product(); space();
    while (raw[i] === '+' || raw[i] === '-') { const minus = raw[i++] === '-'; const b = product(); a = add(a, minus ? negate(b) : b, w); space(); }
    return a;
  }
  const result = expression(); space(); if (i !== raw.length) fail('Unsupported or incomplete notation. Use visible parentheses; standalone braces and e-symbol numbers are unsupported.');
  if (result.n.length > 3 || result.d.length > 3 || result.n.length > result.d.length) fail('Each branch must be a proper rational gain of degree at most 2 (constants and zero are allowed).');
  return result;
}
