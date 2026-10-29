import { rejectSpacingArguments } from '../../shared/tex-arguments';

/** A deliberately numeric matrix grammar: signed decimals, numeric fractions
 * and enclosing groups. Cell arithmetic/powers/symbols are unsupported. */
export function scalar(source: string): number {
  if (!source.trim() || source.length > 140) throw new Error('Complete each numeric matrix entry within 140 characters.');
  rejectSpacingArguments(source);
  const input = source.replace(/\\(?:left|right)\b/g, '').replace(/\\(?:dfrac|tfrac)\b/g, '\\frac').replace(/\s/g, '').replace(/−/g, '-');
  if (/[eE]/.test(input)) throw new Error('Visual e/E denotes algebra. Use a decimal or numeric fraction in each matrix cell.');
  if (input.includes('^')) throw new Error('Matrix cells accept decimal numbers or numeric fractions; replace powers by their decimal values.');
  let at = 0;
  function argument(depth: number): string {
    if (depth > 16) throw new Error('Keep numeric fraction nesting within 16 levels.');
    if (input[at] === '{') {
      at++; const body = scan(true, depth + 1);
      if (input[at++] !== '}') throw new Error('Close each fraction box.');
      return body;
    }
    if (input.startsWith('\\frac', at)) return fraction(depth + 1);
    if (/[0-9]/.test(input[at] ?? '')) return input[at++];
    throw new Error('Complete fraction boxes; put a signed numerator inside its box.');
  }
  function fraction(depth: number): string { at += 5; const a = argument(depth), b = argument(depth); return `\\frac{${a}}{${b}}`; }
  function scan(untilBrace: boolean, depth: number): string {
    if (depth > 16) throw new Error('Keep numeric grouping within 16 levels.');
    let output = '';
    while (at < input.length && !(untilBrace && input[at] === '}')) {
      if (input.startsWith('\\frac', at)) output += fraction(depth + 1);
      else if (input[at] === '{') {
        at++; output += scan(true, depth + 1);
        if (input[at++] !== '}') throw new Error('Close each numeric formatting group.');
      } else output += input[at++];
    }
    return output;
  }
  let text = scan(false, 0);
  if (/[0-9.](?:\\[,!;: ])+[0-9.]/.test(text)) throw new Error('Use one decimal or numeric fraction per cell; separate digit terms are unsupported.');
  text = text.replace(/\\[,!;: ]/g, '');
  if (/[0-9.]\\frac/.test(text)) throw new Error('Mixed-number adjacency is unsupported. Replace the mixed number by its decimal value or one fraction.');
  let i = 0, depth = 0;
  function atom(): number {
    if (++depth > 16) throw new Error('Keep numeric expression nesting within 16 levels.');
    let sign = 1;
    while (text[i] === '+' || text[i] === '-') { if (text[i++] === '-') sign *= -1; }
    let value: number;
    if (text.startsWith('\\frac', i)) {
      i += 5; const numerator = atom(), denominator = atom();
      if (denominator === 0) throw new Error('A numeric fraction denominator cannot be zero.');
      value = numerator / denominator;
      if (numerator !== 0 && value === 0) throw new Error('This nonzero fraction is too small to represent; rescale it.');
    } else if (text[i] === '(' || text[i] === '{') {
      const close = text[i++] === '(' ? ')' : '}'; value = atom();
      if (text[i++] !== close) throw new Error('Use one decimal or numeric fraction per cell, with closed grouping.');
    } else {
      const match = /^(?:\d+(?:\.\d*)?|\.\d+)/.exec(text.slice(i));
      if (!match) throw new Error('Use signed decimal numbers or numeric fractions in matrix cells; symbols and cell arithmetic are unsupported.');
      if (match[0].replace('.', '').length > 24) throw new Error('Keep each decimal mantissa within 24 digits.');
      value = Number(match[0]); i += match[0].length;
    }
    if (!Number.isFinite(value) || Math.abs(value) > 1e100 || value !== 0 && Math.abs(value) < 1e-100) throw new Error('The numeric fraction exceeds the supported intermediate range; rescale it.');
    depth--; return sign * value;
  }
  const result = atom();
  if (i !== text.length) throw new Error('Use one decimal or numeric fraction per cell; cell arithmetic and juxtaposed factors are unsupported.');
  if (Math.abs(result) > 100 || result !== 0 && Math.abs(result) < 1e-12) throw new Error('Each matrix entry must be zero or have magnitude 10⁻¹²…100.');
  return result;
}
export function parseMatrix(latex: string, rows: number, columns: number, name: 'A' | 'B' | 'C'): number[][] {
  if (!latex.trim() || latex.length > 600) throw new Error('Enter the numeric matrix within 600 characters.');
  rejectSpacingArguments(latex);
  let text = latex.trim().replace(/\\(?:left|right)\b/g, '').trim();
  const prefix = /^([ABC])\s*=/.exec(text);
  if (prefix) { if (prefix[1] !== name) throw new Error(`This field is matrix ${name}; remove the other matrix name.`); text = text.slice(prefix[0].length).trim(); }
  if (text.startsWith('[') || text.startsWith('(')) {
    if (!text.endsWith(text[0] === '[' ? ']' : ')')) throw new Error('Close the matrix brackets.');
    text = text.slice(1, -1).trim();
  }
  const match = /^\\begin\{(bmatrix|pmatrix|matrix)\}([\s\S]*)\\end\{\1\}$/.exec(text);
  if (!match) throw new Error(`Use the visual ${rows}×${columns} matrix template for ${name}.`);
  const cells = match[2].split(/\\\\/).map(row => row.split('&'));
  if (cells.length !== rows || cells.some(row => row.length !== columns)) throw new Error(`Matrix ${name} needs exactly ${rows} row(s) and ${columns} column(s).`);
  return cells.map((row, r) => row.map((cell, c) => {
    try { return scalar(cell); }
    catch (error) { throw new Error(`${name}, row ${r + 1}, column ${c + 1}: ${(error as Error).message}`); }
  }));
}
