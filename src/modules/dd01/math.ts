import { add, sub, mul, div, neg, num, equal, rat, parseRational, type Rational } from './algebra';

export type Method = 'forward' | 'backward' | 'tustin';
export interface Controller { b1: Rational; b0: Rational; a1: Rational; a0: Rational }
export interface Settings { method: Method; T: number; prewarp?: number; plantK: number; plantA: number }
export interface Discrete {
  original: Controller; settings: Settings; n1: number; n0: number; d1: number; d0: number;
  exact?: readonly [Rational, Rational, Rational, Rational];
  primitive?: readonly bigint[]; staticGain?: number; alpha: number; beta0: number; beta1: number;
  // Half-angle sums/differences are calculated before coefficient cancellation.
  half: readonly [number, number, number, number]; kappa?: number;
}
export interface Complex { re: number; im: number }
export const magnitude = (z: Complex): number => Math.hypot(z.re, z.im);
export function divideComplex(a: Complex, b: Complex): Complex {
  const scale = Math.max(Math.abs(b.re), Math.abs(b.im));
  if (!scale) throw new Error('Frequency lies at an open-loop pole.');
  const x = b.re / scale, y = b.im / scale, d = x*x + y*y;
  return { re: ((a.re / scale)*x + (a.im / scale)*y)/d, im: ((a.im / scale)*x - (a.re / scale)*y)/d };
}
const times = (a: Complex, b: Complex): Complex => ({re: a.re*b.re-a.im*b.im, im: a.re*b.im+a.im*b.re});
export function readController(values: readonly string[]): Controller {
  if (values.length !== 4) throw new Error('Enter b₁, b₀, a₁, a₀ in descending powers of s.');
  const [b1,b0,a1,a0] = values.map(s=>parseRational(s));
  for (const value of [b1,b0,a1,a0]) if (value.n < 0n || (value.n && value.n*1000n < value.d)) throw new Error('Coefficients must be 0 or between 0.001 and 100.');
  if (!a1.n && !a0.n) throw new Error('The controller denominator cannot be zero.');
  if (!b1.n && !b0.n) throw new Error('Use a nonzero controller numerator.');
  if (!a1.n && b1.n) throw new Error('Ideal differentiation is improper here. Retain a positive a₁ derivative-filter coefficient.');
  return {b1,b0,a1,a0};
}
function periodRational(value: number): Rational {
  if (!Number.isFinite(value) || value < .001 || value > 2) throw new Error('Sample period T must be 0.001–2 seconds.');
  const text = value.toFixed(9);
  if (Number(text) !== value) throw new Error('Use at most 9 decimal places for T.');
  return parseRational(text);
}
function primitive(values: readonly Rational[]): bigint[] {
  const gcd = (a: bigint,b: bigint): bigint => { a=a<0n?-a:a;b=b<0n?-b:b;while(b){const r=a%b;a=b;b=r;}return a; };
  const common = values.reduce((d,r)=>d/gcd(d,r.d)*r.d,1n), ints = values.map(r=>r.n*(common/r.d));
  const g=ints.reduce(gcd,0n), sign=ints[2]<0n?-1n:1n; return ints.map(n=>sign*n/g);
}
export function discretize(c: Controller, settings: Settings): Discrete {
  // Public pure API repeats mathematical validation, independently of UI drafts.
  readController([c.b1,c.b0,c.a1,c.a0].map(r=>`${r.n}/${r.d}`));
  const t=periodRational(settings.T), two=rat(2n);
  if (!['forward','backward','tustin'].includes(settings.method)) throw new Error('Choose a supported mapping.');
  for(const [label,value] of [['Plant gain',settings.plantK],['Plant decay',settings.plantA]] as const)
    if(!Number.isFinite(value)||value<.001||value>100)throw new Error(`${label} must be 0.001–100.`);
  const {b1,b0,a1,a0}=c;
  let exact: readonly [Rational,Rational,Rational,Rational] | undefined;
  let coefficients: readonly number[], half: readonly [number,number,number,number], kappa: number|undefined;
  const proportional=equal(mul(b1,a0),mul(b0,a1));
  const gain=proportional ? num(a1.n?div(b1,a1):div(b0,a0)) : undefined;
  if (settings.prewarp !== undefined) {
    const w=settings.prewarp;
    if(settings.method!=='tustin')throw new Error('Prewarping applies to Tustin only.');
    if(!Number.isFinite(w)||w<.001||w>1000||w*settings.T>=Math.PI-1e-4)throw new Error('Prewarp frequency must be 0.001–1000 rad/s and ωₚT < π − 0.0001.');
    kappa=w/Math.tan(w*settings.T/2);
    coefficients=[num(b1)*kappa+num(b0),num(b0)-num(b1)*kappa,num(a1)*kappa+num(a0),num(a0)-num(a1)*kappa];
    half=[2*num(b0),2*num(b1)*kappa,2*num(a0),2*num(a1)*kappa];
  } else {
    if(settings.method==='forward')exact=[b1,sub(mul(b0,t),b1),a1,sub(mul(a0,t),a1)];
    else if(settings.method==='backward')exact=[add(b1,mul(b0,t)),neg(b1),add(a1,mul(a0,t)),neg(a1)];
    else { const k=div(two,t); kappa=num(k);exact=[add(mul(b1,k),b0),sub(b0,mul(b1,k)),add(mul(a1,k),a0),sub(a0,mul(a1,k))]; }
    coefficients=exact.map(num);
    half=[num(add(exact[0],exact[1])),num(sub(exact[0],exact[1])),num(add(exact[2],exact[3])),num(sub(exact[2],exact[3]))];
  }
  let [n1,n0,d1,d0]=coefficients;
  if(gain!==undefined){n1=gain;n0=0;d1=1;d0=0;half=[gain,gain,1,1];}
  if(!d1)throw new Error('This substitution is noncausal: the present output coefficient is zero. Choose another mapping.');
  const alpha=d0===0?0:-d0/d1,beta0=n1/d1,beta1=n0/d1;
  if(![alpha,beta0,beta1,...half].every(Number.isFinite)||Math.max(Math.abs(alpha),Math.abs(beta0),Math.abs(beta1))>1e6)
    throw new Error('Normalized recurrence coefficients exceed 10⁶. Rescale the controller or change T/prewarp.');
  return {original:c,settings:{...settings},n1,n0,d1,d0,exact,primitive:exact?primitive(exact):undefined,staticGain:gain,alpha,beta0,beta1,half,kappa};
}
export function zoh(m: Discrete): {ad:number;bd:number;minus:number;plus:number} {
  const {plantA:a,plantK:k,T}=m.settings, minus=-Math.expm1(-a*T), ad=Math.exp(-a*T);
  return {ad,bd:k/a*minus,minus,plus:1+ad};
}
export function quadraticRoots(a:number,b:number,c:number): Complex[] {
  if(!a){if(!b)throw new Error('Degenerate root equation.');return[{re:-c/b,im:0}];}
  const scale=Math.max(Math.abs(a),Math.abs(b),Math.abs(c));a/=scale;b/=scale;c/=scale;
  const disc=b*b-4*a*c;
  if(disc<0){const im=Math.sqrt(-disc)/(2*Math.abs(a));return[{re:-b/(2*a),im},{re:-b/(2*a),im:-im}];}
  if(!disc)return[{re:-b/(2*a),im:0},{re:-b/(2*a),im:0}];
  const q=-.5*(b+(b>=0?1:-1)*Math.sqrt(disc));return[{re:q/a,im:0},{re:c/q,im:0}];
}
export function closedPoles(m: Discrete): Complex[] {
  const {ad,bd}=zoh(m);
  return m.staticGain!==undefined ? [{re:ad-bd*m.staticGain,im:0}]
    : quadraticRoots(m.d1,m.d0-ad*m.d1+bd*m.n1,-ad*m.d0+bd*m.n0);
}
export function stability(m: Discrete): 'stable'|'unstable'|'boundary' {
  const radius=Math.max(...closedPoles(m).map(magnitude));
  return radius<1-1e-10?'stable':radius>1+1e-10?'unstable':'boundary';
}
export interface Sample {k:number;t:number;y:number;e:number;u:number;oldU:number;oldE:number}
export interface Trace {samples:Sample[];held:{t:number;y:number}[];stopped?:string}
export function simulate(m: Discrete, count: number): Trace {
  if(!Number.isInteger(count)||count<20||count>500)throw new Error('Choose 20–500 sample intervals.');
  const {ad,bd}=zoh(m),{T,plantA:a,plantK:k}=m.settings;
  let x=0,oldU=0,oldE=0;const samples:Sample[]=[],held:{t:number;y:number}[]=[];
  for(let i=0;i<=count;i++){
    const e=1-x,u=m.alpha*oldU+m.beta0*e+m.beta1*oldE;
    if(![x,e,u].every(Number.isFinite)||Math.max(Math.abs(x),Math.abs(u))>1e12){
      const last=samples.at(-1);
      return{samples,held:last?held.filter(point=>point.t<=last.t):[],stopped:`Stopped before sample ${i}: output/control magnitude exceeded 10¹². No later response is inferred.`};
    }
    samples.push({k:i,t:i*T,y:x,e,u,oldU,oldE});
    if(i<count)for(let j=0;j<8;j++){const tau=T*j/8,minus=-Math.expm1(-a*tau);held.push({t:i*T+tau,y:Math.exp(-a*tau)*x+k/a*minus*u});}
    oldU=u;oldE=e;x=ad*x+bd*u;
  }
  held.push({t:count*T,y:samples[samples.length-1].y});return{samples,held};
}
/** Exact constant-coefficient analog closed-loop step, evaluated numerically. */
export function analogStep(m: Discrete,t:number): number {
  const c=m.original,k=m.settings.plantK,a=m.settings.plantA;
  if(!Number.isFinite(t)||t<0||t>1000)throw new Error('Analog time must be 0–1000 s.');
  if(m.staticGain!==undefined){const g=m.staticGain;return k*g/(a+k*g)*(-Math.expm1(-(a+k*g)*t));}
  const a1=num(c.a1),A=(a*a1+num(c.a0)+k*num(c.b1))/a1,B=(a*num(c.a0)+k*num(c.b0))/a1;
  const v=k*num(c.b1)/a1, f=k*num(c.b0)/a1;
  // Taylor ODE recurrence avoids subtraction of close residues at early times.
  if(t*Math.max(1,A,Math.sqrt(B))<.05){let sum=0,prev=0,current=v,term=t;sum=current*term;for(let n=0;n<22;n++){const next=(n===0?f:0)-A*current-B*prev;term*=t/(n+2);sum+=next*term;prev=current;current=next;}return sum;}
  if(!B){return v/A*(-Math.expm1(-A*t));}
  const final=f/B, disc=A*A-4*B,center=-A/2;
  if(disc===0)return final+(-final+(v+center*final)*t)*Math.exp(center*t);
  if(disc<0){const w=Math.sqrt(-disc)/2;return final+Math.exp(center*t)*(-final*Math.cos(w*t)+(v+center*final)/w*Math.sin(w*t));}
  const roots=quadraticRoots(1,A,B),p=roots[0].re,q=roots[1].re;
  const r=(v+final*q)/(p-q);return final+r*Math.exp(p*t)+(-final-r)*Math.exp(q*t);
}

/** Actual loop evaluation through t=tan(ωT/2); no frequency sweep is used to find crossings. */
export function loopAt(m:Discrete,theta:number): Complex {
  if(!Number.isFinite(theta)||theta<0||theta>Math.PI)throw new Error('Frequency must lie between DC and Nyquist.');
  const [A,B,C,D]=m.half,{bd,minus:F,plus:G}=zoh(m);
  if(theta===0)return divideComplex({re:bd*A,im:0},{re:C*F,im:0});
  if(theta===Math.PI)return divideComplex({re:-bd*B,im:0},{re:D*G,im:0});
  const t=Math.tan(theta/2);
  // Divide factors separately to avoid overflowing a polynomial in t² near Nyquist.
  const control=divideComplex({re:A,im:B*t},{re:C,im:D*t});
  return times(control,divideComplex({re:bd,im:-bd*t},{re:F,im:G*t}));
}
function phaseAt(m:Discrete,theta:number):number {
  const [A,B,C,D]=m.half,{minus:F,plus:G}=zoh(m),t=Math.tan(theta/2);
  return (Math.atan2(B*t,A)-Math.atan2(D*t,C)-Math.atan(t)-Math.atan2(G*t,F))*180/Math.PI;
}
export interface Crossing {omega:number;theta:number;gain:number;phase:number;margin:number;db?:number;endpoint?:boolean}
export interface Margins {gainCrossings:Crossing[];phaseCrossings:Crossing[];notes:string[];qualified:boolean}
export function margins(m:Discrete): Margins {
  const [A,B,C,D]=m.half,{bd,minus:F,plus:G}=zoh(m),notes:string[]=[],gainCrossings:Crossing[]=[],phaseCrossings:Crossing[]=[];
  let qualified=true;
  const q=[bd*bd*A*A-C*C*F*F,bd*bd*(A*A+B*B)-(C*C*G*G+D*D*F*F),bd*bd*B*B-D*D*G*G];
  const qScales=[bd*bd*A*A+C*C*F*F,bd*bd*(A*A+B*B)+C*C*G*G+D*D*F*F,bd*bd*B*B+D*D*G*G];
  if(q.some((value,i)=>qScales[i]>0&&Math.abs(value)<1e-12*qScales[i])){
    qualified=false;notes.push('Nearly cancelling gain-equation coefficients can change an endpoint or tangency. Crossing completeness is not established at this precision.');
  }
  const candidates:number[]=[];
  if(q.every(x=>x===0)){qualified=false;notes.push('Unity-gain continuum: an isolated phase margin is undefined.');}
  else if(!q[2]){if(q[1])candidates.push(-q[0]/q[1]);}
  else{
    const roots=quadraticRoots(q[2],q[1],q[0]);for(const r of roots)if(r.im===0)candidates.push(r.re);
    const scale=Math.max(...q.map(Math.abs)),disc=(q[1]/scale)**2-4*(q[2]/scale)*(q[0]/scale);
    if(Math.abs(disc)<1e-13){qualified=false;notes.push('A repeated or nearly tangent gain crossing needs extra precision; the table is numerically qualified.');}
  }
  for(const u of candidates){if(!Number.isFinite(u)||u<0)continue;const theta=2*Math.atan(Math.sqrt(u));
    if(theta===0||theta>=Math.PI||gainCrossings.some(x=>Math.abs(x.theta-theta)<1e-12))continue;
    try{const gain=magnitude(loopAt(m,theta)),phase=phaseAt(m,theta);if(Math.abs(gain-1)>1e-7){qualified=false;notes.push('A gain-crossing residual exceeded 10⁻⁷.');continue;}
      const raw=180+phase,margin=((raw+180)%360+360)%360-180;
      gainCrossings.push({theta,omega:theta/m.settings.T,gain,phase,margin:margin===-180?180:margin});
    }catch{qualified=false;notes.push('A candidate gain crossing coincides with a pole.');}
  }
  const h=C*G+D*F,c0=(B-A)*C*F-A*h,c1=-(B-A)*D*G-B*h;
  const hScale=Math.abs(C*G)+Math.abs(D*F),cScales=[Math.abs((B-A)*C*F)+Math.abs(A)*hScale,Math.abs((B-A)*D*G)+Math.abs(B)*hScale];
  if([c0,c1].some((value,i)=>cScales[i]>0&&Math.abs(value)<1e-12*cScales[i])){
    qualified=false;notes.push('Nearly cancelling phase-equation coefficients qualify the phase-crossing count.');
  }
  const phaseCandidates:number[]=[];
  if(!c0&&!c1){qualified=false;notes.push('The loop is real on a frequency continuum; an isolated gain margin is undefined.');}
  else if(c1){const u=-c0/c1;if(u>0&&Number.isFinite(u))phaseCandidates.push(2*Math.atan(Math.sqrt(u)));}
  for(const theta of phaseCandidates){try{const z=loopAt(m,theta),gain=magnitude(z);
    if(z.re<0&&Math.abs(z.im)<=1e-7*Math.max(1,gain))phaseCrossings.push({theta,omega:theta/m.settings.T,gain,phase:phaseAt(m,theta),margin:1/gain,db:-20*Math.log10(gain)});
    else if(Math.abs(z.im)>1e-7*Math.max(1,gain)){qualified=false;notes.push('A phase-crossing residual exceeded tolerance.');}
  }catch{qualified=false;notes.push('A phase candidate coincides with a pole.');}}
  for(const theta of [0,Math.PI])try{
    const z=loopAt(m,theta),gain=magnitude(z);
    if(z.re<0)phaseCrossings.push({theta,omega:theta/m.settings.T,gain,phase:theta===0?0:phaseAt(m,theta-Number.EPSILON),margin:1/gain,db:-20*Math.log10(gain),endpoint:true});
    if(Math.abs(gain-1)<1e-12){qualified=false;notes.push(`${theta===0?'DC':'Nyquist'} lies at unity gain; endpoint phase margin is not reported as an interior crossing.`);}
  }catch{notes.push(`${theta===0?'DC':'Nyquist'} is an open-loop pole; that endpoint is undefined.`);}
  gainCrossings.sort((a,b)=>a.theta-b.theta);phaseCrossings.sort((a,b)=>a.theta-b.theta);
  return{gainCrossings,phaseCrossings,notes,qualified};
}
