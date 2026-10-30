import { numericRoots, type Root } from './roots';
export interface Complex { readonly re: number; readonly im: number }
export interface Plant { readonly g: number; readonly a: number; readonly T: number; readonly r: number; readonly h: number; readonly by: number; readonly bv: number; readonly b1: number; readonly b0: number }
export type Controller = { readonly kind: 'constant'; readonly K: number } | { readonly kind: 'corners'; readonly K: number; readonly zero: number; readonly pole: number };
export interface Model { readonly plant: Plant; readonly c: Controller; readonly n: readonly number[]; readonly d: readonly number[]; readonly closed: readonly number[]; readonly poles: readonly Root[]; readonly stability: 'stable' | 'unstable' | 'unresolved'; readonly outside: number | null; readonly physicalKv: number; readonly sampleKv: number }
export interface Target { readonly z: Complex; readonly sigma: number; readonly omega: number; readonly theta: number; readonly radius: number }
export function bounded(v: number, min: number, max: number, label: string): number { if (!Number.isFinite(v) || v < min || v > max) throw new Error(`Use ${label} from ${min} to ${max}.`); return v; }
export const magnitude = (z: Complex) => Math.hypot(z.re, z.im);
export const add = (a: readonly number[], b: readonly number[]) => Array.from({ length: Math.max(a.length, b.length) }, (_, i) => (a[i] ?? 0) + (b[i] ?? 0));
export function multiply(a: readonly number[], b: readonly number[]): number[] { const r = Array.from({ length: a.length + b.length - 1 }, () => 0); a.forEach((x, i) => b.forEach((y, j) => { r[i + j] += x * y; })); return r; }
export function evaluate(p: readonly number[], z: Complex): Complex { let v = { re: 0, im: 0 }; for (let i = p.length - 1; i >= 0; i--) v = { re: v.re * z.re - v.im * z.im + p[i], im: v.re * z.im + v.im * z.re }; return v; }
function quotient(a: Complex, b: Complex): Complex { const s = Math.max(Math.abs(b.re), Math.abs(b.im)); if (!s) throw new Error('The evaluation point is an open-loop pole.'); const x = b.re / s, y = b.im / s, q = x*x + y*y; return { re: (a.re/s*x + a.im/s*y)/q, im: (a.im/s*x-a.re/s*y)/q }; }

/** Exact ZOH formula for ydot=v, vdot=-a v+g u, numerically evaluated.
 * Arrays ascend in z; u[k] is held on [kT,(k+1)T), with no extra delay. */
export function zoh(g: number, a: number, T: number): Plant {
  bounded(g, .1, 1000, 'plant numerator g'); bounded(a, .2, 20, 'plant pole parameter a'); bounded(T, .01, .5, 'sample period T (s)');
  const r = Math.exp(-a*T), h = -Math.expm1(-a*T)/a, by = g/a*(T-h), bv = g*a**-1*(-Math.expm1(-a*T));
  const b0 = g/a*(h-r*T);
  if (!(by > 0 && b0 > 0) || ![by,b0,bv].every(Number.isFinite)) throw new Error('The exact hold coefficients are unresolved at this scale.');
  return { g,a,T,r,h,by,bv,b1:by,b0 };
}
export function mapTarget(zeta: number, wn: number, T: number): Target {
  bounded(zeta,.05,.95,'damping ratio ζ'); bounded(wn,.1,30,'natural frequency ωn (rad/s)'); bounded(T,.01,.5,'sample period T (s)');
  const sigma=zeta*wn, omega=wn*Math.sqrt(1-zeta*zeta), theta=omega*T, radius=Math.exp(-sigma*T);
  if (theta >= Math.PI) throw new Error('The requested oscillatory target aliases at this sample period: ωd T must be below π. Reduce T or change the target.');
  const z={re:radius*Math.cos(theta),im:radius*Math.sin(theta)};
  if (z.im < 1e-5) throw new Error('The mapped conjugate pair is too close to the real axis to resolve in this bounded design. Choose a better-separated target.');
  return {z,sigma,omega,theta,radius};
}

/** Independent coefficient count: map the unit disk to the LHP by
 * z=(1+s)/(1-s), then count RHP roots with guarded quadratic/cubic Routh.
 * A zero/uncertain row is unresolved, not a fabricated boundary count. */
export function outsideCount(p: readonly number[]): number | null {
  if (![3,4].includes(p.length) || p.at(-1) !== 1 || p.some(v=>!Number.isFinite(v))) throw new Error('Use a finite monic quadratic/cubic feedback polynomial.');
  let first: number[];
  const scale=Math.max(1,...p.map(Math.abs)), padding=1e-12*scale;
  if (p.length===3) { const [b,a]=p; first=[1-a+b,2-2*b,1+a+b]; }
  else {
    const [c,b,a]=p, q0=1+a+b+c, q1=3+a-b-3*c, q2=3-a-b+3*c, q3=1-a+b-c;
    const det=q2*q1-q3*q0;
    if (Math.abs(q2)<=padding || Math.abs(det)<=1e-12*Math.max(1,Math.abs(q2*q1),Math.abs(q3*q0))) return null;
    first=[q3,q2,det/q2,q0];
  }
  if (first.some(v=>!Number.isFinite(v)||Math.abs(v)<=padding)) return null;
  return first.slice(1).reduce((sum,v,i)=>sum+Number(Math.sign(v)!==Math.sign(first[i])),0);
}
export function characteristic(plant: Plant, c: Controller, K=c.K): { n: number[]; d: number[]; closed: number[] } {
  const numerator=[plant.b0*K,plant.b1*K], denominator=[plant.r,-1-plant.r,1];
  const n=c.kind==='constant'?numerator:multiply(numerator,[-c.zero,1]);
  const d=c.kind==='constant'?denominator:multiply(denominator,[-c.pole,1]);
  return {n,d,closed:add(n,d)};
}
export function model(plant: Plant,c: Controller): Model {
  bounded(c.K,1e-6,1e4,'positive controller gain K');
  if(c.kind==='corners') { bounded(c.zero,-.9999,.9999,'controller zero'); bounded(c.pole,-.99,.999999,'controller pole'); if(1-c.pole<1e-6-1e-14) throw new Error('Keep the controller pole at least 10⁻⁶ away from +1.'); }
  const polynomials=characteristic(plant,c), poles=numericRoots(polynomials.closed), count=outsideCount(polynomials.closed);
  const radius=(z:Complex)=>magnitude(z), near=poles.some(z=>Math.abs(radius(z)-1)<=1e-8), outside=poles.filter(z=>radius(z)>1+1e-8).length;
  if(count!==null && !near && count!==outside) throw new Error('Unit-circle roots and the independent coefficient count disagree at this scale. No stability verdict is available.');
  const stability=count===null||near?'unresolved':outside?'unstable':'stable';
  const dc=c.kind==='constant'?c.K:c.K*(1-c.zero)/(1-c.pole), physicalKv=plant.g/plant.a*dc;
  return {plant,c,...polynomials,poles,stability,outside:stability==='unresolved'?null:outside,physicalKv,sampleKv:plant.T*physicalKv};
}
export interface AngleVector { readonly name: string; readonly kind: 'zero'|'pole'; readonly at: Complex; readonly degrees: number }
export function openPoints(m: Model): { poles: Complex[]; zeros: Complex[] } { return { poles:[{re:1,im:0},{re:m.plant.r,im:0},...(m.c.kind==='corners'?[{re:m.c.pole,im:0}]:[])], zeros:[{re:-m.plant.b0/m.plant.b1,im:0},...(m.c.kind==='corners'?[{re:m.c.zero,im:0}]:[])] }; }
export function targetCheck(m: Model,target: Target) {
  const value=quotient(evaluate(m.n,target.z),evaluate(m.d,target.z)), phase=Math.atan2(value.im,value.re), delta=phase-Math.PI;
  const points=openPoints(m), vectors: AngleVector[]=[...points.zeros.map((at,i)=>({name:`Zero ${i+1}`,kind:'zero' as const,at,degrees:Math.atan2(target.z.im-at.im,target.z.re-at.re)*180/Math.PI})),...points.poles.map((at,i)=>({name:`Pole ${i+1}`,kind:'pole' as const,at,degrees:Math.atan2(target.z.im-at.im,target.z.re-at.re)*180/Math.PI}))];
  const residual=magnitude(evaluate(m.closed,target.z)), scale=m.closed.reduce((sum,v,i)=>sum+Math.abs(v)*target.radius**i,0);
  return {value,vectors,phaseResidual:Math.atan2(Math.sin(delta),Math.cos(delta))*180/Math.PI,magnitudeResidual:magnitude(value)-1,requiredGain:m.c.K/magnitude(value),polynomialResidual:residual/(scale||1)};
}
export interface Lead { readonly m: Model; readonly target: Target; readonly check: ReturnType<typeof targetCheck>; readonly other: number; readonly cancellation: boolean }
export function lead(plant: Plant,target: Target,pole?: number): Lead {
  const {r,b1,b0}=plant, {re:x,im:y}=target.z, q=target.radius**2; let K:number, zero:number, p:number;
  if(pole===undefined) { zero=r; K=((1-x)**2+y*y)/(b1+b0); p=q-K*b0; }
  else {
    p=bounded(pole,-.99,.99,'manual lead pole'); const B0=1+r+p-2*x, A=q+2*x*B0-r-(1+r)*p, B=q*B0-r*p, a0=b0+2*x*b1, det=a0*b0+q*b1*b1;
    if(det<=1e-12*Math.max(b0*b0,b1*b1)) throw new Error('The target is too close to the plant zero for a resolved lead construction.');
    K=(A*b0+b1*B)/det; const v=(a0*B-q*b1*A)/det; zero=v/K;
  }
  if(!Number.isFinite(K)||K<=0) throw new Error('This target/pole choice needs a nonpositive or unresolved gain. Choose another lead pole or target.');
  if(!(zero>p+1e-6)) throw new Error('This construction is not a lead: the real controller pole must lie to the left of its zero. Change the target or manual pole.');
  const m=model(plant,{kind:'corners',K,zero,pole:p}), check=targetCheck(m,target), other=1+r+p-2*x-K*b1;
  const distance=(z:Complex,w:Complex)=>Math.hypot(z.re-w.re,z.im-w.im);
  if(Math.abs(check.phaseResidual)>1e-6||Math.abs(check.magnitudeResidual)>1e-8||check.polynomialResidual>1e-8||!m.poles.some(z=>distance(z,target.z)<1e-7)||!m.poles.some(z=>distance(z,{re:target.z.re,im:-target.z.im})<1e-7)||!m.poles.some(z=>distance(z,{re:other,im:0})<1e-7*Math.max(1,Math.abs(other)))) throw new Error('The target pair/gain/complete-root residuals did not resolve. Change the target or pole.');
  return {m,target,check,other,cancellation:pole===undefined};
}
export type Convention='physical'|'sample';
export interface Lag { readonly m: Model; readonly convention: Convention; readonly goal: number; readonly beta: number; readonly achieved: number; readonly residual: number; readonly error: number|null; readonly needed: boolean }
export function lag(plant: Plant,K: number,zero:number,goal:number,convention:Convention): Lag {
  bounded(K,1e-6,1e4,'positive lag gain K'); bounded(zero,0,.9999,'lag zero'); bounded(goal,1e-4,1e4,'minimum velocity constant');
  if(convention!=='physical'&&convention!=='sample') throw new Error('Choose a defined physical or per-sample ramp convention.');
  const base=K*plant.g/plant.a*(convention==='sample'?plant.T:1), ratio=goal/base, beta=ratio<=1+1e-10?1:ratio;
  if(beta>1000) throw new Error('Required lag boost exceeds 1000. Increase K, lower the goal or revise the plant before placing a resolvable pole.');
  const c:Controller=beta===1?{kind:'constant',K}:{kind:'corners',K,zero,pole:1-(1-zero)/beta}, m=model(plant,c), achieved=convention==='physical'?m.physicalKv:m.sampleKv;
  const residual=(achieved-goal)/Math.max(goal,1e-12);
  if(residual < -1e-8) throw new Error('The velocity-constant goal did not resolve at this pole precision.');
  return {m,convention,goal,beta,achieved,residual,error:m.stability==='stable'?1/achieved:null,needed:beta>1};
}
export interface Locus { readonly branches: readonly (readonly (Complex|null)[])[]; readonly gains: readonly number[]; readonly max: number; readonly gaps: number }
export function rootLocus(m: Model,requested:number): Locus {
  bounded(requested,.001,1e4,'locus gain upper bound'); const max=Math.min(1e4,Math.max(requested,1.2*m.c.K));
  const gains=[...new Set([0,m.c.K,max,...Array.from({length:241},(_,i)=>max*(i/240)**2)])].sort((a,b)=>a-b), degree=m.closed.length-1;
  const branches:(Complex|null)[][]=Array.from({length:degree},()=>[]); let previous:Complex[]=openPoints(m).poles, gaps=0;
  const permutations=degree===2?[[0,1],[1,0]]:[[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
  for(const K of gains) {
    try {
      const current=K===0?openPoints(m).poles:numericRoots(characteristic(m.plant,m.c,K).closed);
      const order=permutations.reduce((best,p)=>{const cost=p.reduce((sum,j,i)=>sum+Math.hypot(current[j].re-previous[i].re,current[j].im-previous[i].im),0);return cost<best.cost?{cost,p}:best;},{cost:Infinity,p:permutations[0]}).p;
      previous=order.map(i=>current[i]); previous.forEach((z,i)=>branches[i].push(z));
    } catch { gaps++; branches.forEach(branch=>branch.push(null)); }
  }
  return {branches,gains,max,gaps};
}
