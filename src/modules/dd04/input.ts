const fail = (message: string): never => { throw new Error(message); };

/** Native numeric controls have a separate grammar from visual mathematics. */
export function parseNumericLiteral(raw: string): number {
  const source = raw.trim();
  if (source.length > 160 || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(source)) fail('Enter a finite numeric value.');
  const value = Number(source);
  if (!Number.isFinite(value)) fail('Enter a finite numeric value.');
  if (value === 0 && /[1-9]/.test(source.split(/[eE]/)[0])) fail('A nonzero number is too small to represent.');
  return value || 0;
}

/** Finite real arithmetic only; accepts both grouped and compact visual fractions. */
export function parseScalar(raw: string): number {
  if (!raw.trim()) fail('Complete each numeric sample.');
  if (raw.length > 160) fail('Keep each sample within 160 characters.');
  if (/[\d.]\s+[\d.]/.test(raw)) fail('Separate samples with commas, or use an arithmetic operator.');
  let source = raw.replace(/\\(?:left|right)/g, '').replace(/\\(?:cdot|times)/g, '*').replace(/\\div/g, '/')
    .replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/\s/g, '');
  if (/[eE]/.test(source)) fail('The visual field treats e and E as symbols. Write decimal samples here; numeric controller fields also accept scientific notation.');
  if (source.includes('^')) fail('Powers are not supported for error samples. Write decimal values, for example 0.01.');
  let cursor = 0;
  const fraction = (depth: number): string => { cursor += 5; return `((${argument(depth + 1)})/(${argument(depth + 1)}))`; };
  const argument = (depth: number): string => {
    if (depth > 8) fail('Use at most 8 levels of grouping.');
    if (source[cursor] === '{') { cursor++; return group(depth, true); }
    if (source.startsWith('\\frac', cursor)) return fraction(depth);
    const token = source[cursor++];
    if (!token || !/[0-9]/.test(token)) fail('Complete both parts of each fraction.');
    return token;
  };
  const group = (depth: number, closing: boolean): string => {
    if (depth > 8) fail('Use at most 8 levels of grouping.');
    let output = '';
    while (cursor < source.length && source[cursor] !== '}') {
      if (source.startsWith('\\frac', cursor)) {
        if (/[0-9.]$/.test(output)) fail('Write an explicit + or × before an adjacent fraction.');
        output += fraction(depth);
      }
      else if (source[cursor] === '{') fail('Use visible parentheses to group this expression.');
      else output += source[cursor++];
    }
    if (closing) { if (source[cursor++] !== '}') fail('Close each fraction/group.'); }
    else if (source[cursor] === '}') fail('Check the sample grouping.');
    return output;
  };
  source = group(0, false);
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[+*/()-]/g) ?? [];
  if (!tokens.length || tokens.join('') !== source || tokens.length > 64) fail('Use real numbers, fractions and + − × ÷ only (at most 64 tokens per sample).');
  let at = 0;
  const finite = (value: number) => {
    if (!Number.isFinite(value)) fail('Each sample must be finite; check division and number sizes.');
    return value;
  };
  const atom = (depth: number): number => {
    if (depth > 8) fail('Use at most 8 levels of grouping.');
    const token = tokens[at++];
    if (token === '+' || token === '-') return (token === '-' ? -1 : 1) * atom(depth + 1);
    if (token === '(') { const value = sum(depth + 1); if (tokens[at++] !== ')') fail('Close each parenthesis.'); return value; }
    if (!token || !/^[\d.]/.test(token)) fail('Complete each numeric sample.');
    const value = finite(Number(token));
    if (value === 0 && /[1-9]/.test(token)) fail('A nonzero number is too small to represent.');
    return value;
  };
  const product = (depth: number): number => {
    let value = atom(depth);
    while (tokens[at] === '*' || tokens[at] === '/') {
      const op = tokens[at++], right = atom(depth);
      if (op === '/' && right === 0) fail('A fraction cannot have a zero denominator.');
      const next = finite(op === '*' ? value * right : value / right);
      if (value !== 0 && right !== 0 && next === 0) fail('A nonzero calculation is too small to represent.');
      value = next;
    }
    return value;
  };
  const sum = (depth: number): number => {
    let value = product(depth);
    while (tokens[at] === '+' || tokens[at] === '-') { const sign = tokens[at++] === '-' ? -1 : 1; value = finite(value + sign * product(depth)); }
    return value;
  };
  const value = sum(0);
  if (at !== tokens.length) fail('Check sample grouping and arithmetic.');
  return value || 0;
}

export function parseErrors(latex: string): number[] {
  if (latex.length > 2048) fail('Keep the error list within 2048 characters.');
  let source = latex.replace(/\\(?:left|right)/g, '').trim();
  if (source.startsWith('[') && source.endsWith(']')) source = source.slice(1, -1);
  if (!source.trim()) fail('Enter 1 to 40 error samples, separated by commas.');
  const pieces = source.split(',');
  if (pieces.length > 40) fail('Enter at most 40 error samples.');
  return pieces.map((piece, index) => {
    const value = parseScalar(piece);
    if (Math.abs(value) > 10000) fail(`Error e[${index + 1}] must have magnitude at most 10000.`);
    return value;
  });
}
