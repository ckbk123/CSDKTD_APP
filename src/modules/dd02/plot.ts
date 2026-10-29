export interface XY { readonly x: number; readonly y: number }
export interface Series { readonly points: readonly (XY|null)[]; readonly color: string; readonly dashed?: boolean; readonly thin?: boolean }
export interface Mark extends XY { readonly shape: 'pole'|'zero'|'closed'|'target'; readonly color?: string; readonly label?: string }
export interface Window { readonly x: number; readonly y: number; readonly half: number }
const ns='http://www.w3.org/2000/svg';
function node<K extends keyof SVGElementTagNameMap>(tag:K,attrs:Record<string,string|number>,text?:string){const e=document.createElementNS(ns,tag);for(const[k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;}
export function clip(a:XY,b:XY,xmin:number,xmax:number,ymin:number,ymax:number):[XY,XY]|null{let lo=0,hi=1;const dx=b.x-a.x,dy=b.y-a.y;for(const[p,q]of[[-dx,a.x-xmin],[dx,xmax-a.x],[-dy,a.y-ymin],[dy,ymax-a.y]]){if(!p){if(q<0)return null;continue;}const t=q/p;if(p<0)lo=Math.max(lo,t);else hi=Math.min(hi,t);if(lo>hi)return null;}return[{x:a.x+lo*dx,y:a.y+lo*dy},{x:a.x+hi*dx,y:a.y+hi*dy}];}
/** Add a finely sampled actual unit-circle arc for narrow +1 windows. */
export function unitCircle(window?:Window):XY[]{const close=window&&window.half<.5,span=close?Math.asin(Math.min(1,window.half*1.5)):Math.PI;return Array.from({length:close?161:721},(_,i)=>{const theta=-span+2*span*i/(close?160:720);return{x:Math.cos(theta),y:Math.sin(theta)};});}
function tick(v:number,span:number):string{if(Math.abs(v)<1e-14)return'0';if(Math.abs(v)<1e-3&&Math.abs(v)>0)return v.toExponential(1);if(span<.1&&Math.abs(v)<2)return v.toFixed(Math.min(9,Math.max(3,Math.ceil(-Math.log10(span))+2)));return Number(v.toPrecision(4)).toString();}
export function plot(title:string,series:readonly Series[],marks:readonly Mark[],window?:Window):HTMLElement{
  const figure=document.createElement('figure'),caption=document.createElement('figcaption');caption.textContent=title;figure.append(caption);
  const svg=node('svg',{viewBox:'0 0 640 500',role:'img','aria-label':title});figure.append(svg);
  const circle=unitCircle(window),all=[...series.flatMap(s=>s.points).filter((v):v is XY=>v!==null),...marks,...circle];
  let xmin=Math.min(...all.map(p=>p.x)),xmax=Math.max(...all.map(p=>p.x)),ymin=Math.min(...all.map(p=>p.y)),ymax=Math.max(...all.map(p=>p.y));
  if(window){xmin=window.x-window.half;xmax=window.x+window.half;ymin=window.y-window.half;ymax=window.y+window.half;}
  else{const dx=.09*Math.max(1,xmax-xmin),dy=.09*Math.max(1,ymax-ymin);xmin-=dx;xmax+=dx;ymin-=dy;ymax+=dy;}
  const left=115,top=40,width=503,height=390,cx=(xmin+xmax)/2,cy=(ymin+ymax)/2,scale=Math.max((xmax-xmin)/width,(ymax-ymin)/height);xmin=cx-width*scale/2;xmax=cx+width*scale/2;ymin=cy-height*scale/2;ymax=cy+height*scale/2;
  const x=(v:number)=>left+(v-xmin)/(xmax-xmin)*width,y=(v:number)=>top+height-(v-ymin)/(ymax-ymin)*height;
  const offset=window?.x===1&&xmax-xmin<.01;
  svg.append(node('rect',{x:left,y:top,width,height,fill:'#fff',stroke:'#d7e0ec'}));
  for(let i=0;i<=4;i++){const vx=xmin+(xmax-xmin)*i/4,vy=ymin+(ymax-ymin)*i/4;svg.append(node('line',{x1:x(vx),x2:x(vx),y1:top,y2:top+height,stroke:'#e5ebf2'}),node('line',{x1:left,x2:left+width,y1:y(vy),y2:y(vy),stroke:'#e5ebf2'}),node('text',{x:left-7,y:y(vy)+7,'text-anchor':'end'},tick(vy,ymax-ymin)));if(!offset||i%2===0)svg.append(node('text',{x:x(vx),y:top+height+30,'text-anchor':i===0?'start':i===4?'end':'middle'},tick(offset?vx-1:vx,xmax-xmin)));}
  if(xmin<0&&xmax>0)svg.append(node('line',{x1:x(0),x2:x(0),y1:top,y2:top+height,stroke:'#9ba9bb'}));if(ymin<0&&ymax>0)svg.append(node('line',{x1:left,x2:left+width,y1:y(0),y2:y(0),stroke:'#9ba9bb'}));
  svg.append(node('text',{x:left+35,y:22},'Im(z), dimensionless'),node('text',{x:618,y:485,'text-anchor':'end'},offset?'Re(z)−1, dimensionless':'Re(z), dimensionless'));
  for(const s of[{points:circle,color:'#8996a7',dashed:true},...series]){let d='';for(let i=1;i<s.points.length;i++){const a=s.points[i-1],b=s.points[i];if(!a||!b)continue;const c=clip(a,b,xmin,xmax,ymin,ymax);if(c)d+=`M${x(c[0].x).toFixed(3)},${y(c[0].y).toFixed(3)}L${x(c[1].x).toFixed(3)},${y(c[1].y).toFixed(3)}`;}svg.append(node('path',{d,fill:'none',stroke:s.color,'stroke-width':('thin'in s&&s.thin)?1.4:2.4,'stroke-dasharray':s.dashed?'7 5':'none'}));}
  for(const m of marks)if(m.x>=xmin&&m.x<=xmax&&m.y>=ymin&&m.y<=ymax){const px=x(m.x),py=y(m.y),color=m.color??'#3c4c67';
    if(m.shape==='pole')svg.append(node('path',{d:`M${px-5},${py-5}L${px+5},${py+5}M${px+5},${py-5}L${px-5},${py+5}`,stroke:color,'stroke-width':2.4}));
    else if(m.shape==='target')svg.append(node('path',{d:`M${px},${py-7}L${px+7},${py}L${px},${py+7}L${px-7},${py}Z`,fill:'none',stroke:color,'stroke-width':2.2}));
    else svg.append(node('circle',{cx:px,cy:py,r:m.shape==='zero'?6:4,fill:m.shape==='zero'?'none':color,stroke:color,'stroke-width':2}));
    if(m.label)svg.append(node('text',{x:px+(px>500?-9:9),y:py-12,'text-anchor':px>500?'end':'start'},m.label));
  }
  return figure;
}
