import { Work, add, constant, div, isZero, latex, mul, rational, same, sub, variable, type Gain, type Q } from './algebra';
import { parseGain } from './input';
import type { Analysis, Net } from './mason';
import type { DraftNet } from './fixtures';

export type Boundary = 'whole'|'split';
export type Feedback = 'negative'|'positive'|'open';
export type SourceDraft = Record<'g'|'T'|'tau'|'H'|'c0'|'c1',string> & { boundary:Boundary; feedback:Feedback };
export type Conversion = { input:SourceDraft; g:Gain; T:Gain; tau:Gain; H:Gain; controller:Gain; delay:Gain; whole:Gain; split:Gain; plant:Gain; m:number; graph:DraftNet };
export const sourceDefault=():SourceDraft=>({g:'5',T:'0.2',tau:'0.2',H:'0.1',c0:'10',c1:'-2',boundary:'whole',feedback:'negative'});
const asGain=(value:Q):Gain=>({n:[value],d:[{n:1n,d:1n}]});
const compare=(a:Q,b:Q)=>a.n*b.d-b.n*a.d;
function scalar(raw:string,name:string,min:Gain,max:Gain):Gain {
  const value=parseGain(raw,'scalar'),v=value.n[0];
  if(compare(v,min.n[0])<0n||compare(v,max.n[0])>0n)throw new Error(`${name} is outside its supported range.`);
  if((v.n<0n?-v.n:v.n)>1000000000n||v.d>1000000000n)throw new Error(`${name} needs a reduced numerator/denominator of at most 10⁹. Use a simpler exact value.`);
  return value;
}

/** Exact ZOH of the whole physical cascade, or of the explicitly split cascade.
 * All transform polynomials ascend in z; all histories/states are zero. */
export function convert(input:SourceDraft):Conversion {
  if(!['whole','split'].includes(input.boundary)||!['negative','positive','open'].includes(input.feedback))throw new Error('Choose a supported sampling boundary and feedback sign.');
  const w=new Work(),g=scalar(input.g,'Plant g',constant(1n,10n),constant(1000n)),T=scalar(input.T,'Sample period T',constant(1n,100n),constant(1n));
  const tau=scalar(input.tau,'Physical delay τ',constant(0n),constant(2n)),H=scalar(input.H,'Sensor H',constant(0n),constant(10n));
  const c0=scalar(input.c0,'Controller c₀',constant(-1000n),constant(1000n)),c1=scalar(input.c1,'Controller c₁',constant(-1000n),constant(1000n));
  const ratio=div(tau,T,w).n[0];
  if(ratio.d!==1n)throw new Error('This exact converter supports integer τ/T only. Fractional-sample transport delays require a different hold model; no rounding is used.');
  if(ratio.n>2n)throw new Error('Use a physical delay of 0, 1 or 2 sample periods.');
  const m=Number(ratio.n),z=variable(),one=constant(1n),den=mul(sub(z,one,w),sub(z,one,w),w),scale=mul(g,mul(T,T,w),w);
  const whole=div(mul(div(scale,constant(2n),w),add(z,one,w),w),den,w),split=div(scale,den,w);
  const controller=add(c0,div(c1,z,w),w),delay=m===0?one:div(one,m===1?z:mul(z,z,w),w);
  const plant=mul(delay,input.boundary==='whole'?whole:split,w),sign=input.feedback==='negative'?'-1':input.feedback==='positive'?'1':'0';
  const graph:DraftNet={label:'Converted sampled source model',note:`All nodes are discrete samples at T. ${input.boundary==='whole'?'One input ZOH; continuous integrators remain connected.':'An extra sampler and ZOH hold the intermediate integrator output.'} e=R${input.feedback==='negative'?'−':input.feedback==='positive'?'+':' + 0·'}B, B=H·Y.`,nodes:['R','E','U','D','Y','B'],source:'R',target:'Y',branches:[
    {id:'b1',from:'R',to:'E',value:'1'},
    {id:'b2',from:'E',to:'U',value:latex(controller)},
    {id:'b3',from:'U',to:'D',value:latex(delay)},
    {id:'b4',from:'D',to:'Y',value:latex(input.boundary==='whole'?whole:split)},
    {id:'b5',from:'Y',to:'B',value:latex(H)},
    {id:'b6',from:'B',to:'E',value:sign},
  ]};
  // Generated branch notation must remain editable through the same bounded reader.
  const expected=[one,controller,delay,input.boundary==='whole'?whole:split,H,constant(BigInt(sign))];
  graph.branches.forEach((edge,i)=>{if(!same(parseGain(edge.value),expected[i],w))throw new Error('The converted branch notation could not be preserved. Use simpler scalar values.');});
  return{input:{...input},g,T,tau,H,controller,delay,whole,split,plant,m,graph};
}

/** Direct causal feedthrough sums must be nonsingular for the sample table.
 * The separate symbolic transfer can exist even when this condition fails. */
export function causalUpdate(net:Net,a:Analysis):boolean {
  return a.delta.n.length===a.delta.d.length&&[...a.signals.values()].every(g=>g.n.length<=g.d.length)&&net.branches.every(e=>e.gain.n.length<=e.gain.d.length);
}
export function samples(g:Gain,count=8):{impulse:Gain[];step:Gain[]} {
  if(!Number.isInteger(count)||count<1||count>12)throw new Error('Use 1–12 exact samples.');
  if(g.n.length>g.d.length)throw new Error('This formal transfer is improper; an ordinary causal sample sequence is not available.');
  const w=new Work(),n=[...g.n].reverse(),d=[...g.d].reverse(),shift=g.d.length-g.n.length,impulse:Gain[]=[],step:Gain[]=[];
  for(let k=0;k<count;k++){
    let value=k>=shift&&k-shift<n.length?asGain(n[k-shift]):constant(0n);
    for(let j=1;j<d.length&&j<=k;j++)value=sub(value,mul(asGain(d[j]),impulse[k-j],w),w);
    value=div(value,asGain(d[0]),w);impulse.push(value);step.push(add(step.at(-1)??constant(0n),value,w));
  }
  return{impulse,step};
}
export function coefficientsFromIntegers(n:readonly bigint[],d:readonly bigint[]):Gain {
  const q=(v:bigint)=>({n:v,d:1n});return rational(n.map(q),d.map(q),new Work());
}
export const zeroTransfer=(g:Gain)=>isZero(g);
