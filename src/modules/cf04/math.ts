import { add,sub,mul,div,neg,num,rat,equal,zero,one,parseRational,type Rational } from './algebra';
import { positiveRoots,signAt,type Polynomial } from './roots';

export interface Model {g:Rational;a:Rational;K:Rational;z:Rational;p:Rational}
export interface Complex {re:number;im:number}
export type Channel='G'|'L'|'T';
export const abs=(c:Complex):number=>Math.hypot(c.re,c.im);
const times=(a:Complex,b:Complex):Complex=>({re:a.re*b.re-a.im*b.im,im:a.re*b.im+a.im*b.re});
const sq=(a:Rational)=>mul(a,a);
export function readModel(values:readonly string[]):Model{
  if(values.length!==5)throw new Error('Enter g, a, K, τz and τp.');
  const [g,a,K,z,p]=values.map(s=>parseRational(s));
  for(const value of [g,a,K,z,p])if(value.n<0n||(value.n&&value.n*1000n<value.d))throw new Error('Each value must be 0 or 0.001–100.');
  if(!g.n||!a.n||!K.n)throw new Error('Plant g, decay a and controller K must be positive.');
  if(!p.n&&z.n)throw new Error('This exercise supports proper compensation. Give τp a positive value when τz is positive.');
  return{g,a,K,z,p};
}
export function effective(m:Model):{z:Rational;p:Rational;cancelled:boolean}{
  const cancelled=!!m.p.n&&equal(m.z,m.p);return{z:cancelled?zero:m.z,p:cancelled?zero:m.p,cancelled};
}
export function phase(m:Model,channel:Channel,omega:number):number{
  if(!Number.isFinite(omega)||omega<0||omega>1e6||(omega>0&&omega<1e-12))throw new Error('Choose DC or a frequency from10⁻¹² to10⁶ rad/s.');
  if(channel==='T'){const t=at(m,'T',omega);return Math.atan2(t.im,t.re)*180/Math.PI;}
  if(!omega)throw new Error(`${channel} has a pole at DC; its finite phase value is undefined there.`);
  const {z,p}=effective(m);return(-Math.PI/2-Math.atan(omega/num(m.a))+(channel==='L'?Math.atan(num(z)*omega)-Math.atan(num(p)*omega):0))*180/Math.PI;
}
export function at(m:Model,channel:Channel,omega:number):Complex{
  if(!Number.isFinite(omega)||omega<0||omega>1e6||(omega>0&&omega<1e-12))throw new Error('Choose DC or a frequency from 10⁻¹² to10⁶ rad/s.');
  if(!omega){if(channel==='T')return{re:1,im:0};throw new Error(`${channel} has a pole at DC; no finite point is plotted.`);}
  const g=num(m.g),a=num(m.a),K=num(m.K),{z,p}=effective(m),w2=omega*omega;
  const G={re:-g/(w2+a*a),im:-g*a/(omega*(w2+a*a))};if(channel==='G')return G;
  const zz=num(z),pp=num(p),d=1+pp*pp*w2,C={re:K*(1+zz*pp*w2)/d,im:K*(zz-pp)*omega/d},L=times(C,G);if(channel==='L')return L;
  const dr=1+L.re,di=L.im,scale=Math.max(Math.abs(dr),Math.abs(di));
  if(scale<=1e-12*Math.max(1,abs(L)))throw new Error('The closed-loop frequency point is singular or too close to a pole for reliable magnitude.');
  const x=dr/scale,y=di/scale,den=x*x+y*y;return{re:((L.re/scale)*x+(L.im/scale)*y)/den,im:((L.im/scale)*x-(L.re/scale)*y)/den};
}
export interface Algebra {
  q:Rational;z:Rational;p:Rational;characteristic:Polynomial;routh:Rational;
  gainEquation:Polynomial;phaseCoefficient:Rational;spectrum:Polynomial;resonanceEquation:Polynomial;bandwidthEquation:Polynomial;
}
export function equations(m:Model):Algebra{
  const {z,p}=effective(m),q=mul(m.g,m.K),a=m.a,A=add(one,mul(a,p)),B=add(a,mul(q,z));
  // D(x)=|P(j√x)|². Numerator magnitude squared is q²(1+τz²x).
  const d0=sq(q),d1=sub(sq(B),mul(rat(2n),mul(q,A))),d2=sub(sq(A),mul(rat(2n),mul(p,B))),d3=sq(p),z2=sq(z);
  return{q,z,p,characteristic:[q,B,A,p],routh:sub(mul(A,B),mul(p,q)),
    gainEquation:[neg(sq(q)),sub(sq(a),mul(sq(q),z2)),add(one,mul(sq(a),sq(p))),sq(p)],
    phaseCoefficient:sub(p,mul(z,A)),spectrum:[d0,d1,d2,d3],
    resonanceEquation:[sub(mul(z2,d0),d1),neg(mul(rat(2n),d2)),neg(add(mul(rat(3n),d3),mul(z2,d2))),neg(mul(rat(2n),mul(z2,d3)))],
    bandwidthEquation:[neg(d0),sub(d1,mul(rat(2n),mul(d0,z2))),d2,d3]};
}
export interface Crossing {omega:number;gain:number;phase:number;pm?:number;gm?:number;db?:number}
export interface BandwidthCrossing {omega:number;direction:'down'|'up'|'touch'}
export function bandwidthCrossings(polynomial:Polynomial):BandwidthCrossing[]{
  const roots=positiveRoots(polynomial);
  return roots.brackets.map((r,i)=>{
    const left=i?div(add(roots.brackets[i-1].hi,r.lo),rat(2n)):zero;
    const right=i<roots.count-1?div(add(r.hi,roots.brackets[i+1].lo),rat(2n)):add(r.hi,one);
    const before=signAt(polynomial,left),after=signAt(polynomial,right);
    if(!before||!after)throw new Error('Bandwidth crossing direction needs greater precision.');
    return{omega:Math.sqrt(roots.values[i]),direction:before<0&&after>0?'down':before>0&&after<0?'up':'touch'};
  });
}
export interface Performance {peak:number;peakOmega:number;stationary:{omega:number;gain:number}[];bandwidths:number[];bandwidthCrossings:BandwidthCrossing[];bandwidth:number}
export interface Analysis {model:Model;algebra:Algebra;state:'stable'|'unstable'|'boundary';kv:Rational;gainCrossings:Crossing[];phaseCrossings:Crossing[];performance?:Performance;performanceIssue?:string}
export function analyze(m:Model):Analysis{
  // Validate the pure API, too; exact input bounds do not rely on UI drafts.
  readModel([m.g,m.a,m.K,m.z,m.p].map(r=>`${r.n}/${r.d}`));
  const algebra=equations(m),state=algebra.routh.n>0n?'stable':algebra.routh.n<0n?'unstable':'boundary';
  const gainRoots=positiveRoots(algebra.gainEquation);
  if(gainRoots.count!==1)throw new Error('The bounded positive-parameter family must have one unity crossing; isolation failed.');
  const gainCrossings=gainRoots.values.map(x=>{const omega=Math.sqrt(x),gain=abs(at(m,'L',omega)),angle=phase(m,'L',omega);if(Math.abs(gain-1)>1e-7)throw new Error('Unity-gain residual exceeds10⁻⁷.');return{omega,gain,phase:angle,pm:180+angle};});
  const phaseCrossings:Crossing[]=[];
  if(algebra.phaseCoefficient.n>0n){const omega=Math.sqrt(num(div(m.a,algebra.phaseCoefficient))),L=at(m,'L',omega),gain=abs(L);
    if(L.re>=0||Math.abs(L.im)>1e-7*Math.max(1,gain))throw new Error('Negative-real crossing residual exceeds tolerance.');
    phaseCrossings.push({omega,gain,phase:phase(m,'L',omega),gm:1/gain,db:-20*Math.log10(gain)});
  }
  const result:Analysis={model:m,algebra,state,kv:div(algebra.q,m.a),gainCrossings,phaseCrossings};
  if(state!=='stable'){result.performanceIssue='Closed-loop resonance and bandwidth are undefined as stable performance specifications: the closed loop is '+state+'. The formal T(jω) curve is not a settled sinusoidal response.';return result;}
  try{
    const stationary=positiveRoots(algebra.resonanceEquation).values.map(x=>{const omega=Math.sqrt(x);return{omega,gain:abs(at(m,'T',omega))};});
    const candidates=[{omega:0,gain:1},...stationary],peak=candidates.reduce((a,b)=>b.gain>a.gain?b:a);
    const crossings=bandwidthCrossings(algebra.bandwidthEquation),bandwidths=crossings.map(c=>c.omega),exit=crossings.find(c=>c.direction==='down');
    if(!exit)throw new Error('No positive downward −3dB crossing was isolated.');
    for(const omega of bandwidths)if(Math.abs(abs(at(m,'T',omega))-Math.SQRT1_2)>1e-7)throw new Error('The bandwidth residual exceeds tolerance.');
    result.performance={peak:peak.gain,peakOmega:peak.omega,stationary,bandwidths,bandwidthCrossings:crossings,bandwidth:exit.omega};
  }catch(e){result.performanceIssue=(e as Error).message+' Margins and the exact stability test remain available; performance markers are not assigned.';}
  return result;
}
