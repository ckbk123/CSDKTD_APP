import { add,sub,mul,div,neg,num,rat,zero,one,type Rational } from './algebra';
/** Ascending coefficients, degree at most three. Exact Sturm counts precede numerical markers. */
export type Polynomial=Rational[];
const trim=(p:Polynomial):Polynomial=>{while(p.length>1&&!p.at(-1)!.n)p.pop();return p;};
const isZero=(p:Polynomial)=>p.every(r=>!r.n);
const derivative=(p:Polynomial):Polynomial=>p.length<2?[zero]:p.slice(1).map((r,i)=>mul(r,rat(BigInt(i+1))));
const evaluate=(p:Polynomial,x:Rational):Rational=>p.reduceRight((v,c)=>add(mul(v,x),c),zero);
function divide(a:Polynomial,b:Polynomial):{q:Polynomial;r:Polynomial}{
  if(isZero(b))throw new Error('Zero polynomial divisor.');const r=[...a],q=Array.from({length:Math.max(1,a.length-b.length+1)},()=>zero);
  while(r.length>=b.length&&!isZero(r)){const k=r.length-b.length,f=div(r.at(-1)!,b.at(-1)!);q[k]=f;for(let i=0;i<b.length;i++)r[i+k]=sub(r[i+k],mul(f,b[i]));trim(r);}
  return{q:trim(q),r:trim(r)};
}
const positiveScale=(p:Polynomial):Polynomial=>{const lead=p.at(-1)!,m=lead.n<0n?neg(lead):lead;return p.map(r=>div(r,m));};
function squareFree(p:Polynomial):Polynomial{
  let a=p,b=derivative(p);while(!isZero(b)){const r=divide(a,b).r;a=b;b=r;}return trim(divide(p,a).q);
}
const sign=(r:Rational)=>r.n<0n?-1:r.n>0n?1:0;
export interface RootSet {count:number;values:number[]}
export function positiveRoots(coefficients:readonly Rational[]):RootSet{
  let p=trim([...coefficients]);if(p.length>4)throw new Error('Root isolation supports degree at most three.');
  if(isZero(p))throw new Error('The equation holds on a continuum; isolated markers are undefined.');
  // DC is handled by the caller, separately from strictly positive frequencies.
  while(p.length>1&&!p[0].n)p=p.slice(1);if(p.length===1)return{count:0,values:[]};
  const square=squareFree(p);p=square.map(r=>div(r,square.at(-1)!));const sequence=[p,positiveScale(derivative(p))];
  while(sequence.at(-1)!.length>1){const r=divide(sequence.at(-2)!,sequence.at(-1)!).r;if(isZero(r))break;sequence.push(positiveScale(r.map(neg)));}
  const variations=(x:Rational):number=>{const signs=sequence.map(poly=>sign(evaluate(poly,x))).filter(Boolean);let n=0;for(let i=1;i<signs.length;i++)if(signs[i]!==signs[i-1])n++;return n;};
  let ratio=zero;const lead=p.at(-1)!;for(const c of p.slice(0,-1)){const r=div(c.n<0n?neg(c):c,lead);if(sub(r,ratio).n>0n)ratio=r;}
  const bound=add(one,ratio),count=variations(zero)-variations(bound),values:number[]=[];
  const pending=[{lo:zero,hi:bound,count,depth:0}];let work=0;
  while(pending.length){const item=pending.pop()!;if(!item.count)continue;if(++work>1500||item.depth>220)throw new Error('Positive roots are too close for reliable bounded isolation. Rescale or separate the parameters.');
    let {lo,hi}=item;
    if(item.count>1){const mid=div(add(lo,hi),rat(2n)),left=variations(lo)-variations(mid);pending.push({lo:mid,hi,count:item.count-left,depth:item.depth+1},{lo,hi:mid,count:left,depth:item.depth+1});continue;}
    let converged=false;
    for(let step=0;step<220;step++){
      if(!evaluate(p,hi).n){lo=hi;converged=true;break;}
      const mid=div(add(lo,hi),rat(2n)),value=num(mid),width=num(sub(hi,lo));
      if(width<=1e-12*Math.max(Math.abs(value),1e-24)){converged=true;break;}
      if(variations(lo)-variations(mid))hi=mid;else lo=mid;
    }
    if(!converged)throw new Error('A positive root needs more precision than this bounded exercise supports.');
    const value=num(div(add(lo,hi),rat(2n)));if(!Number.isFinite(value)||value<=0)throw new Error('A positive root cannot be represented reliably.');values.push(value);
  }
  values.sort((a,b)=>a-b);
  if(values.some((v,i)=>i&&v-values[i-1]<=1e-10*Math.max(v,values[i-1])))throw new Error('Distinct positive roots are too close for separate numerical markers.');
  for(const x of values){let residual=0,scale=0;for(let i=coefficients.length-1;i>=0;i--){residual=residual*x+num(coefficients[i]);scale=scale*x+Math.abs(num(coefficients[i]));}if(Math.abs(residual)>1e-8*scale)throw new Error('A root residual exceeds the numerical tolerance.');}
  return{count,values};
}
