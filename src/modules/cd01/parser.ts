import { rejectSpacingArguments } from '../../shared/tex-arguments';

/** Small literal/matrix/quadratic grammar; never executes input as code. */
function clean(text: string): string {
  if (text.length > 600) throw new Error('Use at most 600 characters per equation.');
  rejectSpacingArguments(text);
  // TeX spacing is an atom when used as an unbraced argument. Removing it
  // first would turn an empty fraction/exponent argument into the next digit.
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

type Poly = number[]; // five ascending coefficients, degree at most four
const constant = (v: number): Poly => [v,0,0,0,0];
function multiply(a: Poly,b: Poly): Poly {
  const result=constant(0);
  for(let i=0;i<5;i++)for(let j=0;j<5;j++){
    const value=a[i]*b[j];
    if(a[i]!==0&&b[j]!==0&&value===0)throw new Error('Polynomial arithmetic underflows; rescale the coefficients.');
    if(i+j>4){if(value!==0)throw new Error('Polynomial degree exceeds four.');}
    else result[i+j]+=value;
  }
  if(result.some(v=>!Number.isFinite(v)))throw new Error('Polynomial arithmetic exceeds numeric range.');
  return result;
}
function polynomial(source:string):number[] {
  const text=clean(source).replace(/^[qD]\(s\)=/,'').replace(/\\(?:times|cdot)/g,'*'),tokens:(string|number)[]=[];
  let i=0;
  while(i<text.length){
    if(tokens.length>=160)throw new Error('Use at most160 polynomial tokens.');
    if(text.startsWith('\\frac',i)||text.startsWith('\\dfrac',i)){
      if(typeof tokens.at(-1)==='number'||tokens.at(-1)===')')throw new Error('Use explicit + or × before a fraction; mixed-number adjacency is unsupported.');
      const [value,end]=fraction(text,i,0);tokens.push(value);i=end;continue;
    }
    const numeric=/^(?:\d+(?:\.\d*)?|\.\d+)/.exec(text.slice(i));
    if(numeric){if(typeof tokens.at(-1)==='number')throw new Error('Separate numeric factors with ×.');tokens.push(parseScalar(numeric[0]));i+=numeric[0].length;continue;}
    if(text[i]==='^'){
      const braced=/^\^\{([0-4])\}/.exec(text.slice(i));
      if(braced){tokens.push('^',Number(braced[1]));i+=braced[0].length;continue;}
      if(!/[0-4]/.test(text[i+1]??'')||/[\d.]/.test(text[i+2]??''))throw new Error('Use an unambiguous power box with integer exponent0–4.');
      tokens.push('^',Number(text[i+1]));i+=2;continue;
    }
    if('s+-*/()'.includes(text[i])){tokens.push(text[i++]);continue;}
    throw new Error('Use s, real numeric fractions, visible parentheses and powers0–4. Hidden grouping, functions and e/E symbols are unsupported.');
  }
  let pos=0,nesting=0;const peek=()=>tokens[pos];
  function atom():Poly {
    if(++nesting>12)throw new Error('Polynomial nesting exceeds12.');
    const t=tokens[pos++];let result:Poly;
    if(t==='+'||t==='-')result=atom().map(v=>v*(t==='-'?-1:1));
    else if(typeof t==='number')result=constant(t);
    else if(t==='s')result=[0,1,0,0,0];
    else if(t==='('){result=sum();if(tokens[pos++]!==')')throw new Error('Close the visible polynomial parentheses.');}
    else throw new Error('Complete the polynomial expression.');
    if(peek()==='^'){pos++;const exponent=tokens[pos++] as number,base=result;if(exponent===0&&base.every(v=>v===0))throw new Error('0⁰ is unsupported; enter an evaluated nonzero coefficient.');result=constant(1);for(let k=0;k<exponent;k++)result=multiply(result,base);}
    nesting--;return result;
  }
  function product():Poly {
    let result=atom();
    while(pos<tokens.length){
      const t=peek();
      if(t==='*'||t==='/'){
        pos++;const other=atom();
        if(t==='*')result=multiply(result,other);
        else{
          if(other.slice(1).some(v=>v!==0)||other[0]===0)throw new Error('Divide a polynomial only by a nonzero numeric constant.');
          result=result.map(v=>{const q=v/other[0];if(!Number.isFinite(q)||(q===0&&v!==0))throw new Error('Polynomial division exceeds numeric range.');return q;});
        }
      }else if(t==='s'||t==='(')result=multiply(result,atom());else break;
    }
    return result;
  }
  function sum():Poly {
    let result=product();
    while(peek()==='+'||peek()==='-'){const sign=tokens[pos++]==='+'?1:-1,other=product();result=result.map((v,j)=>v+sign*other[j]);}
    return result;
  }
  const p=sum();
  if(pos!==tokens.length||p.some(v=>!Number.isFinite(v)||Math.abs(v)>1e8))throw new Error('Use a polynomial of degree≤4 with coefficient magnitudes≤10⁸.');
  while(p.length>1&&p.at(-1)===0)p.pop();return p.reverse();
}
export function parseTarget(source:string,degree:number):number[] {
  const p=polynomial(source);if(p.length!==degree+1||p[0]!==1)throw new Error(`Use a real monic target polynomial of degree${degree}.`);return p;
}
function ungroup(text:string):string {
  while(text[0]==='('&&text.at(-1)===')'){
    let depth=0,whole=true;
    for(let i=0;i<text.length;i++){if(text[i]==='(')depth++;if(text[i]===')')depth--;if(depth===0&&i<text.length-1){whole=false;break;}}
    if(!whole)break;text=text.slice(1,-1);
  }
  return text;
}
/** One evaluated constant divided by a quadratic; not a general rational CAS. */
export function parsePlant(source:string):{b:number;a1:number;a0:number} {
  let text=ungroup(clean(source).replace(/^G\(s\)=/,'')),sign=1;
  while(text[0]==='+'||text[0]==='-'){if(text[0]==='-')sign=-sign;text=ungroup(text.slice(1));}
  let numerator:string,denominator:string;
  if(text.startsWith('\\frac')||text.startsWith('\\dfrac')){
    const command=text.startsWith('\\dfrac')?6:5,[a,next]=argument(text,command),[b,end]=argument(text,next);
    if(end!==text.length)throw new Error('Enter one constant-over-quadratic plant fraction.');numerator=a;denominator=b;
  }else{
    let depth=0,split=-1;
    for(let i=0;i<text.length;i++){if(text[i]==='(')depth++;if(text[i]===')')depth--;if(text[i]==='/'&&depth===0){split=i;break;}}
    if(split<0)throw new Error('Use G(s)=b/(s²+a₁s+a₀), with one quadratic denominator.');
    numerator=text.slice(0,split);denominator=ungroup(text.slice(split+1));
  }
  const b=sign*parseScalar(numerator),p=polynomial(denominator);
  if(p.length!==3||p[0]===0)throw new Error('The plant denominator must have degree2; plant zeros and delays are outside this exercise.');
  const result={b:b/p[0],a1:p[1]/p[0],a0:p[2]/p[0]};
  if(!Object.values(result).every(Number.isFinite))throw new Error('Plant normalization exceeds numeric range.');
  return result;
}
