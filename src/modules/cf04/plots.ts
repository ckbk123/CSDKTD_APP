import { at,phase,abs,type Analysis,type Channel } from './math';
import { num } from './algebra';
export const fmt=(value:number):string=>Number.isFinite(value)?((Math.abs(value)<1e-5&&value!==0)||Math.abs(value)>=1e7?value.toExponential(5):Number(value.toPrecision(8)).toString()):'undefined';
export interface PlotWindow {low:number;high:number;radius:number;cursor:number;channel:Channel}
interface Point {x:number;y:number}
const ns='http://www.w3.org/2000/svg';
const svgNode=(tag:string,attrs:Record<string,string>,text?:string):SVGElement=>{const n=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;return n;};
function frame(label:string):{wrap:HTMLElement;svg:SVGSVGElement;add:(tag:string,attrs:Record<string,string>,text?:string)=>SVGElement}{
  const wrap=document.createElement('div');wrap.className='cf04-plot-scroll';wrap.tabIndex=0;wrap.setAttribute('aria-label',label+', horizontally scrollable plot');
  const svg=svgNode('svg',{viewBox:'0 0 720 310',role:'img','aria-label':label}) as SVGSVGElement;wrap.append(svg);
  const add=(tag:string,attrs:Record<string,string>,text?:string)=>{const n=svgNode(tag,attrs,text);svg.append(n);return n;};return{wrap,svg,add};
}
function values(a:Analysis,channel:Channel,window:PlotWindow):{w:number;gain:number;angle:number;z:Point}[]{
  const out:{w:number;gain:number;angle:number;z:Point}[]=[];
  const extras=channel==='L'?[...a.gainCrossings,...a.phaseCrossings].map(c=>c.omega):channel==='T'&&a.performance?[...a.performance.stationary.map(c=>c.omega),...a.performance.bandwidths]:[];
  const frequencies=[...Array.from({length:241},(_,i)=>window.low*(window.high/window.low)**(i/240)),window.cursor,...extras].filter(w=>w>=window.low&&w<=window.high).sort((a,b)=>a-b);
  for(const w of new Set(frequencies)){try{const z=at(a.model,channel,w);out.push({w,gain:20*Math.log10(abs(z)),angle:phase(a.model,channel,w),z:{x:z.re,y:z.im}});}catch{/* Singular samples create a break in the curve below. */}}
  return out;
}
function clip(a:Point,b:Point,r:number):[Point,Point]|undefined{
  const dx=b.x-a.x,dy=b.y-a.y;let low=0,high=1;
  for(const[p,q]of [[-dx,a.x+r],[dx,r-a.x],[-dy,a.y+r],[dy,r-a.y]]){
    if(!p){if(q<0)return;continue;}const t=q/p;if(p<0)low=Math.max(low,t);else high=Math.min(high,t);if(low>high)return;
  }
  return[{x:a.x+low*dx,y:a.y+low*dy},{x:a.x+high*dx,y:a.y+high*dy}];
}
export function drawPlots(a:Analysis,held:Analysis|undefined,window:PlotWindow):HTMLElement{
  const pane=document.createElement('div'),{channel}=window,current=values(a,channel,window),previous=held?values(held,channel,window):undefined;
  const logLow=Math.log10(window.low),logSpan=Math.log10(window.high)-logLow,x=(w:number)=>64+632*(Math.log10(w)-logLow)/logSpan;
  const crossesPole=(analysis:Analysis,left:number,right:number):boolean=>channel==='T'&&analysis.state==='boundary'&&left<Math.sqrt(num(analysis.algebra.q)/num(analysis.algebra.characteristic[2]))&&right>=Math.sqrt(num(analysis.algebra.q)/num(analysis.algebra.characteristic[2]));
  const markers=channel==='L'?[...a.gainCrossings.map(c=>({w:c.omega,label:'unity'})),...a.phaseCrossings.map(c=>({w:c.omega,label:'−180°'}))]:channel==='T'&&a.performance?[...(a.performance.peakOmega?[{w:a.performance.peakOmega,label:'peak'}]:[]),...a.performance.bandwidthCrossings.map(c=>({w:c.omega,label:'−3dB '+c.direction}))]:[];
  for(const quantity of ['gain','angle'] as const){
    const label=`${channel} ${quantity==='gain'?'magnitude (dB)':'phase (degrees)'}`,chart=frame(label);chart.svg.dataset.bode='true';
    const data=[...current,...(previous??[])].map(v=>v[quantity]);let low=Math.min(quantity==='gain'?0:-180,...data),high=Math.max(quantity==='gain'?0:-180,...data);if(high-low<1){low-=1;high+=1;}const pad=(high-low)*.08;low-=pad;high+=pad;
    const y=(v:number)=>260-222*(v-low)/(high-low);
    for(let i=0;i<=4;i++){const w=10**(logLow+logSpan*i/4),v=low+(high-low)*i/4;chart.add('line',{x1:'64',x2:'696',y1:String(y(v)),y2:String(y(v)),class:'cf04-gridline'});chart.add('text',{x:'59',y:String(y(v)+4),'text-anchor':'end'},fmt(v));chart.add('text',{x:String(x(w)),y:'280','text-anchor':'middle'},fmt(w));}
    chart.add('text',{x:'18',y:'18'},label);chart.add('text',{x:'380',y:'302','text-anchor':'middle'},'Frequency ω (rad/s), logarithmic');
    const line=(series:typeof current,dashed:boolean)=>{let path='',lastW=0,lastAngle=0;for(const v of series){const gap=lastW&&(v.w/lastW>(window.high/window.low)**(1.5/240)||crossesPole(dashed?held!:a,lastW,v.w)||(quantity==='angle'&&Math.abs(v.angle-lastAngle)>180));path+=`${!lastW||gap?'M':'L'}${x(v.w)},${y(v[quantity])} `;lastW=v.w;lastAngle=v.angle;}chart.add('path',{d:path,class:`cf04-curve ${dashed?'cf04-held':''}`});};
    if(previous)line(previous,true);line(current,false);
    const reference=quantity==='gain'?(channel==='T'?-3.01029995664:0):-180;if(reference>=low&&reference<=high)chart.add('line',{x1:'64',x2:'696',y1:String(y(reference)),y2:String(y(reference)),class:'cf04-reference'});
    for(const marker of markers)if(marker.w>=window.low&&marker.w<=window.high){const z=at(a.model,channel,marker.w),value=quantity==='gain'?20*Math.log10(abs(z)):phase(a.model,channel,marker.w);chart.add('rect',{x:String(x(marker.w)-3),y:String(y(value)-3),width:'6',height:'6',class:'cf04-dot'});chart.add('text',{x:String(x(marker.w)+5),y:String(y(value)-8)},marker.label);}
    if(window.cursor>=window.low&&window.cursor<=window.high)try{const z=at(a.model,channel,window.cursor),value=quantity==='gain'?20*Math.log10(abs(z)):phase(a.model,channel,window.cursor);chart.add('line',{x1:String(x(window.cursor)),x2:String(x(window.cursor)),y1:'38',y2:'260',class:'cf04-reference'});chart.add('circle',{cx:String(x(window.cursor)),cy:String(y(value)),r:'5',class:'cf04-cursor'});}catch{/* Cursor feedback is shown separately. */}
    pane.append(chart.wrap);
  }
  const chart=frame(`${channel} Nyquist illustration`),r=window.radius,xx=(v:number)=>380+111*v/r,yy=(v:number)=>150-111*v/r;
  chart.add('line',{x1:'269',x2:'491',y1:'150',y2:'150',class:'cf04-gridline'});chart.add('line',{x1:'380',x2:'380',y1:'39',y2:'261',class:'cf04-gridline'});
  chart.add('text',{x:'18',y:'18'},`${channel} Nyquist: solid positive ω, dashed negative ω`);chart.add('text',{x:'610',y:'154'},'Re');chart.add('text',{x:'385',y:'35'},'Im');
  for(const v of [-r,-r/2,0,r/2,r]){chart.add('text',{x:String(xx(v)),y:'282','text-anchor':'middle'},fmt(v));chart.add('text',{x:'150',y:String(yy(v)+4),'text-anchor':'end'},fmt(v));}
  if(r>=1){chart.add('ellipse',{cx:'380',cy:'150',rx:String(111/r),ry:String(111/r),class:'cf04-reference'});if(channel==='L'){chart.add('path',{d:`M${xx(-1)-4},146 l8,8 M${xx(-1)-4},154 l8,-8`,class:'cf04-critical'});chart.add('text',{x:String(xx(-1)-10),y:'137'},'−1');}}
  const nyquist=(series:typeof current,mirror:boolean,dashed:boolean)=>{let path='';for(let i=1;i<series.length;i++){if(series[i].w/series[i-1].w>(window.high/window.low)**(1.5/240)||crossesPole(dashed&&!mirror?held!:a,series[i-1].w,series[i].w))continue;const first=series[i-1].z,last=series[i].z;if((Math.abs(first.x)>r||Math.abs(first.y)>r)&&(Math.abs(last.x)>r||Math.abs(last.y)>r))continue;const segment=clip({x:first.x,y:mirror?-first.y:first.y},{x:last.x,y:mirror?-last.y:last.y},r);if(segment)path+=`M${xx(segment[0].x)},${yy(segment[0].y)} L${xx(segment[1].x)},${yy(segment[1].y)} `;}chart.add('path',{d:path,class:`cf04-curve ${mirror?'cf04-mirror':dashed?'cf04-held':''}`});};
  nyquist(current,false,false);nyquist(current,true,true);
  if(previous)nyquist(previous,false,true);
  try{const z=at(a.model,channel,window.cursor);if(Math.abs(z.re)<=r&&Math.abs(z.im)<=r){chart.add('line',{x1:'380',y1:'150',x2:String(xx(z.re)),y2:String(yy(z.im)),class:'cf04-reference'});chart.add('circle',{cx:String(xx(z.re)),cy:String(yy(z.im)),r:'5',class:'cf04-cursor'});}}catch{/* Explicit singular feedback in the readout. */}
  pane.append(chart.wrap);return pane;
}
