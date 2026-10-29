export type Complex = readonly [number, number];
const cmul = ([a,b]:Complex,[c,d]:Complex):Complex => [a*c-b*d,a*d+b*c];
export function finite(values:readonly number[],bound:number,label:string):void {
  if(!values.every(v=>Number.isFinite(v)&&Math.abs(v)<=bound))throw new Error(`${label} must be finite with magnitude≤${bound}.`);
}
function quadratic(b:number,c:number):Complex[] {
  const d=b*b-4*c;
  if(d<0)return[[-b/2,Math.sqrt(-d)/2],[-b/2,-Math.sqrt(-d)/2]];
  const q=-.5*(b+(b>=0?1:-1)*Math.sqrt(d));
  if(q!==0&&c!==0&&c/q===0)throw new Error('A mode underflows; rescale the model.');
  return q===0?[[0,0],[0,0]]:[[q,0],[c/q,0]];
}
function cubic(b:number,c:number,d:number):Complex[] {
  const p=c-b*b/3,q=2*b**3/27-b*c/3+d,delta=(q/2)**2+(p/3)**3;
  if(delta>=0){
    const u=Math.cbrt(-q/2+Math.sqrt(delta)),v=Math.abs(u)>1e-15?-p/(3*u):Math.cbrt(-q/2-Math.sqrt(delta)),sum=u+v,im=Math.sqrt(3)/2*(u-v);
    return[[sum-b/3,0],[-sum/2-b/3,im],[-sum/2-b/3,-im]];
  }
  if(p>=0)throw new Error('Cubic mode calculation lost accuracy. Rescale the model.');
  const angle=Math.acos(Math.max(-1,Math.min(1,-q/(2*Math.sqrt(-((p/3)**3))))))/3;
  return[0,1,2].map(k=>[2*Math.sqrt(-p/3)*Math.cos(angle-2*Math.PI*k/3)-b/3,0]);
}
function csqrt([a,b]:Complex):Complex {
  if(a===0&&b===0)return[0,0];
  const magnitude=Math.hypot(a,b);
  if(a>=0){const re=Math.sqrt((magnitude+a)/2);return[re,b/(2*re)];}
  const im=(b<0?-1:1)*Math.sqrt((magnitude-a)/2);return[Math.abs(b)/(2*Math.abs(im)),im];
}
function quartic(a:number,b:number,c:number,d:number):Complex[] {
  // y=s+a/4. Factor the depressed quartic into two real quadratics.
  const p=b-3*a*a/8,q=a**3/8-a*b/2+c,r=-3*a**4/256+a*a*b/16-a*c/4+d;
  let values:Complex[];
  if(q===0){
    const squares=quadratic(p,r);values=squares.flatMap(w=>{const root=csqrt(w);return[root,[-root[0],-root[1]] as Complex];});
  }else{
    const resolvent=cubic(2*p,p*p-4*r,-q*q).filter(([re,im])=>re>0&&Math.abs(im)<=1e-9*Math.max(1,Math.abs(re)));
    if(!resolvent.length)throw new Error('Quartic factorization lost a positive resolvent root. Rescale the model or targets.');
    const z=Math.max(...resolvent.map(v=>v[0])),alpha=Math.sqrt(z),beta=(p+z-q/alpha)/2,gamma=(p+z+q/alpha)/2;
    values=[...quadratic(alpha,beta),...quadratic(-alpha,gamma)];
  }
  return values.map(([re,im])=>[re-a/4,im]);
}
/** All roots of a real monic polynomial, degree1–4; normalized residual AND Vieta checks. */
export function roots(coefficients:readonly number[]):Complex[] {
  if(coefficients.length<2||coefficients.length>5||coefficients[0]!==1)throw new Error('Use a real monic polynomial of degree1–4.');
  finite(coefficients,1e12,'Polynomial coefficients');
  const degree=coefficients.length-1,scale=Math.max(1,...coefficients.slice(1).map((v,i)=>Math.abs(v)**(1/(i+1))));
  const normalized=coefficients.map((v,i)=>v/scale**i);
  let result:Complex[];
  if(degree===1)result=[[-normalized[1],0]];
  else if(degree===2)result=quadratic(normalized[1],normalized[2]);
  else if(degree===3)result=cubic(normalized[1],normalized[2],normalized[3]);
  else result=quartic(normalized[1],normalized[2],normalized[3],normalized[4]);
  for(const root of result){
    let value:Complex=[1,0];for(const coefficient of normalized.slice(1)){const next=cmul(value,root);value=[next[0]+coefficient,next[1]];}
    const magnitude=Math.hypot(...root),normalizer=normalized.reduce((s,v,i)=>s+Math.abs(v)*magnitude**(degree-i),0);
    if(!value.every(Number.isFinite)||Math.hypot(...value)>1e-9*normalizer)throw new Error('Root residual lost accuracy; rescale the model or targets.');
  }
  let reconstructed:Complex[]=[[1,0]];
  for(const root of result){
    const next:Complex[]=Array.from({length:reconstructed.length+1},()=>[0,0]);
    reconstructed.forEach((v,i)=>{next[i]=[next[i][0]+v[0],next[i][1]+v[1]];const product=cmul(v,root);next[i+1]=[next[i+1][0]-product[0],next[i+1][1]-product[1]];});reconstructed=next;
  }
  if(reconstructed.some(([re,im],i)=>Math.hypot(re-normalized[i],im)>1e-8*Math.max(1,Math.abs(normalized[i]))))throw new Error('Complete root/multiplicity verification lost accuracy.');
  return result.map(([re,im])=>[re*scale,im*scale]);
}
export function multiply(a:readonly number[],b:readonly number[],n:number):number[] {
  const result=Array(n*n).fill(0) as number[];
  for(let i=0;i<n;i++)for(let k=0;k<n;k++)for(let j=0;j<n;j++)result[i*n+j]+=a[i*n+k]*b[k*n+j];
  if(result.some(v=>!Number.isFinite(v)))throw new Error('Matrix multiplication overflow; reduce the scale or horizon.');return result;
}
const norm=(m:readonly number[],n:number)=>Math.max(...Array.from({length:n},(_,i)=>m.slice(i*n,(i+1)*n).reduce((s,v)=>s+Math.abs(v),0)));
export function exponential(m:readonly number[],n:number):number[] {
  if(n<1||n>5||m.length!==n*n)throw new Error('Use a matrix of order1–5.');
  const size=norm(m,n),scaling=size>.5?Math.ceil(Math.log2(size/.5)):0;
  if(!Number.isFinite(size)||scaling>30)throw new Error('Transition exceeds30 scaling steps; reduce the scale or horizon.');
  const reduced=m.map(v=>v/2**scaling),identity:number[]=Array.from({length:n*n},(_,i)=>Math.floor(i/n)===i%n?1:0);
  let result=[...identity],term=[...identity],converged=false;
  for(let k=1;k<=24;k++){
    term=multiply(term,reduced,n).map(v=>v/k);result=result.map((v,i)=>v+term[i]);
    if(norm(term,n)<=1e-16){converged=true;break;}
  }
  if(!converged)throw new Error('Matrix exponential did not converge within24 terms.');
  for(let k=0;k<scaling;k++)result=multiply(result,result,n);return result;
}
/** Faddeev–LeVerrier characteristic coefficients of the actual closed-state matrix. */
export function characteristic(matrix:readonly number[],n:number):number[] {
  const identity:number[]=Array.from({length:n*n},(_,i)=>Math.floor(i/n)===i%n?1:0);
  let B=[...identity];const coefficients=[1];
  for(let k=1;k<=n;k++){
    const product=multiply(matrix,B,n),coefficient=-Array.from({length:n},(_,i)=>product[i*n+i]).reduce((a,b)=>a+b,0)/k;
    coefficients.push(coefficient);B=product.map((v,i)=>v+coefficient*identity[i]);
  }
  return coefficients;
}
