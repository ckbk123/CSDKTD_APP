import { density, panel, type Metric, type Run, type Sample } from './math';
import { format as f } from './input';
const ns = 'http://www.w3.org/2000/svg';
export const unit: Record<Metric, string> = {IAE:'E·s',ISE:'E²·s',ITAE:'E·s²',ITSE:'E²·s²',Effort:'U²·s'};
export const densityUnit: Record<Metric,string> = {IAE:'E',ISE:'E²',ITAE:'E·s',ITSE:'E²·s',Effort:'U²'};
function canvas(height: number, description: string) {
  const svg = document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 820 ${height}`); svg.setAttribute('role','img'); svg.setAttribute('aria-label',description);
  const add = (tag: string, attrs: Record<string,string|number>, text?: string) => {
    const el=document.createElementNS(ns,tag);Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,String(v)));
    if(text!==undefined)el.textContent=text;svg.append(el);return el;
  };
  return {svg,add};
}
const shown = (samples: Sample[]) => samples.filter((_,i)=>i%Math.max(1,Math.floor(samples.length/1000))===0||i===samples.length-1);
export function responsePlot(A: Run,B: Run,time: number): SVGSVGElement {
  const {svg,add}=canvas(325,'Numerical error and control trajectories for A and B. Time in seconds, left scale error in E, right scale control in U. Solid/dashed error lines; dotted/dash-dot control lines. Numeric inspection is below.');
  const data=[...A.samples,...B.samples], es=data.map(s=>s.e), us=data.map(s=>s.u);
  const er=[Math.min(0,...es),Math.max(0,...es)], ur=[Math.min(0,...us),Math.max(0,...us)];
  if(er[1]===er[0])er[1]++;
  if(ur[1]===ur[0])ur[1]++;
  const X=(t:number)=>65+690*t/A.horizon;
  const Y=(v:number,r:number[])=>255-205*(v-r[0])/(r[1]-r[0]);
  for(let i=0;i<=4;i++){
    const y=255-205*i/4, t=A.horizon*i/4;
    add('line',{x1:65,x2:755,y1:y,y2:y,class:'cf-grid'});
    add('text',{x:58,y:y+4,'text-anchor':'end'},f(er[0]+(er[1]-er[0])*i/4));
    add('text',{x:762,y:y+4},f(ur[0]+(ur[1]-ur[0])*i/4));
    add('text',{x:X(t),y:278,'text-anchor':'middle'},f(t));
  }
  for(const [run,name] of [[A,'A'],[B,'B']] as const)for(const key of ['e','u'] as const){
    const path=shown(run.samples).map((s,i)=>`${i?'L':'M'}${X(s.t).toFixed(2)},${Y(s[key],key==='e'?er:ur).toFixed(2)}`).join(' ');
    add('path',{d:path,class:`cf-line cf-${key} cf-${name}`});
  }
  add('line',{x1:X(time),x2:X(time),y1:45,y2:255,class:'cf-cursor'});
  add('text',{x:65,y:18},'e(t) [E]'); add('text',{x:755,y:18,'text-anchor':'end'},'u(t) [U]');
  add('text',{x:410,y:301,'text-anchor':'middle'},'Time t (s) · error: A solid / B dashed · control: A dotted / B dash-dot');
  return svg;
}
export function costPlot(run: Run,time: number,metric: Metric,name: string): SVGSVGElement {
  const selected=panel(run,time,metric),{svg,add}=canvas(270,`${metric} integrand for run ${name}. Horizontal time in seconds; vertical density in ${densityUnit[metric]}. Shading illustrates accumulation through the selected Simpson panel; it is a linear sample illustration, not exact quadrature area.`);
  const max=Math.max(1e-12,...run.samples.map(s=>density(s,metric))),X=(t:number)=>65+690*t/run.horizon,Y=(v:number)=>205-165*v/max;
  for(let i=0;i<=4;i++){
    const y=205-165*i/4;add('line',{x1:65,x2:755,y1:y,y2:y,class:'cf-grid'});
    add('text',{x:58,y:y+4,'text-anchor':'end'},f(max*i/4));
    add('text',{x:X(run.horizon*i/4),y:228,'text-anchor':'middle'},f(run.horizon*i/4));
  }
  const stop=selected.samples[2].t, visible=shown(run.samples);
  const accumulated=[...visible.filter(s=>s.t<stop),selected.samples[2]];
  const shaded=`M${X(0)},205 `+accumulated.map(s=>`L${X(s.t).toFixed(2)},${Y(density(s,metric)).toFixed(2)}`).join(' ')+` L${X(stop)},205 Z`;
  add('path',{d:shaded,class:'cf-area'});
  add('rect',{x:X(selected.samples[0].t),y:40,width:Math.max(1,X(stop)-X(selected.samples[0].t)),height:165,class:'cf-panel'});
  add('path',{d:visible.map((s,i)=>`${i?'L':'M'}${X(s.t).toFixed(2)},${Y(density(s,metric)).toFixed(2)}`).join(' '),class:'cf-line cf-e cf-A'});
  add('text',{x:65,y:18},`Run ${name}: ${metric} density [${densityUnit[metric]}]`);
  add('text',{x:410,y:252,'text-anchor':'middle'},'Time t (s) · shaded cumulative illustration / outlined incremental panel');
  return svg;
}
