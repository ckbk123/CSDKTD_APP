import { mapPole, type Pole } from './math';
import { fmt } from './plots';

const NS='http://www.w3.org/2000/svg';
const node=(tag:string,attrs:Record<string,string|number>,text?:string)=>{const e=document.createElementNS(NS,tag);for(const [k,v]of Object.entries(attrs))e.setAttribute(k,String(v));if(text!==undefined)e.textContent=text;return e;};
export interface PlaneWindow {s:number;z:number}
export const coordinates=(p:Pole,extent:number)=>({x:200+p.real/extent*135,y:165-p.imag/extent*135});
export const worldPoint=(x:number,y:number,extent:number):Pole=>({real:(x-200)/135*extent,imag:(165-y)/135*extent});
const cross=(p:Pole,extent:number,cls:string)=>{const {x,y}=coordinates(p,extent);return node('path',{d:`M${x-5},${y-5}l10,10m-10,0l10,-10`,class:cls});};

export function explorationPlanes(pole:Pole,T:number,T0:number,inverse:Pole,window:PlaneWindow):HTMLElement {
  const row=document.createElement('div');row.className='dp-planes';
  const target=mapPole(pole,T),reference=mapPole(pole,T0);
  for(const domain of ['s','z'] as const){
    const extent=window[domain],figure=document.createElement('figure'),heading=document.createElement('h4');heading.textContent=domain==='s'?'Continuous pole':'Mapped pole';
    const svg=node('svg',{viewBox:'0 0 400 360','aria-label':domain==='s'?'Continuous pole and conjugate; drag a cross':'Discrete poles, unit circle and reference mapping',role:'img','data-plane':domain});
    svg.append(node('title',{},domain==='s'?'Continuous pole and selected inverse branch':'Target mapping and reference at Tref'));
    svg.append(node('path',{d:'M65,165H335M200,30V300',class:'dp-axis'}));
    for(const sign of [-1,1])svg.append(node('text',{x:200+sign*135,y:322,'text-anchor':'middle'},fmt(sign*extent,3)),node('text',{x:57,y:165-sign*135+4,'text-anchor':'end'},fmt(sign*extent,3)));
    svg.append(node('text',{x:207,y:184},'0'));
    const inside=(p:Pole)=>Math.abs(p.real)<=extent&&Math.abs(p.imag)<=extent;
    if(domain==='s'){
      const inv=coordinates(inverse,extent);
      if(inside(inverse))svg.append(node('path',{d:`M${inv.x},${inv.y-9}l9,9l-9,9l-9,-9Z`,class:'dp-inverse'}));
      for(const sign of pole.imag===0?[1]:[1,-1]){
        const p={real:pole.real,imag:pole.imag*sign};if(!inside(p))continue;
        const {x,y}=coordinates(p,extent),handle=node('g',{'data-pole-handle':sign,role:'button',tabindex:0,'aria-label':`${sign===1?'Pole':'Conjugate'}: ${fmt(p.real)} ${p.imag<0?'minus':'plus'} ${fmt(Math.abs(p.imag))}j; arrow keys move the pole`});
        handle.append(node('circle',{cx:x,cy:y,r:24,fill:'transparent','data-hit':''}),cross(p,extent,'dp-cross'));svg.append(handle);
      }
    }else{
      svg.append(node('circle',{cx:200,cy:165,r:135/extent,class:'dp-circle'}));
      if(reference.radius<=extent*1.4)svg.append(node('circle',{cx:200,cy:165,r:reference.radius*135/extent,class:'dp-reference'}));
      for(const sign of target.imag===0?[1]:[1,-1])if(inside({real:target.real,imag:sign*target.imag}))svg.append(cross({real:target.real,imag:sign*target.imag},extent,'dp-cross'));
      if(inside(target)){const point=coordinates(target,extent);svg.append(node('path',{d:`M200,165L${point.x},${point.y}`,class:'dp-radius'}));}
      if(inside(reference)){const point=coordinates(reference,extent);svg.append(node('circle',{cx:point.x,cy:point.y,r:7,class:'dp-reference'}));}
      const arc=Array.from({length:25},(_,i)=>{const a=target.angle*i/24;return `${i?'L':'M'}${200+28*Math.cos(a)},${165-28*Math.sin(a)}`;}).join('');svg.append(node('path',{d:arc,class:'dp-radius'}));
    }
    const axis=document.createElement('p');axis.className='dp-help dp-axis-caption';axis.textContent=domain==='s'?'Horizontal σ (s⁻¹) · vertical ω (rad/s)':'Horizontal Re z · vertical Im z';
    const caption=document.createElement('figcaption');caption.textContent=domain==='s'?'Crosses move together; diamond is the inverse branch. Equal axis scales stay fixed until Fit plots.':'Crosses: target T. Dashed ring/point: reference T. Solid circle: |z| = 1. Equal axis scales stay fixed until Fit plots.';
    figure.append(heading,svg,axis,caption);row.append(figure);
  }
  return row;
}

/** Change presentation sizes only; world coordinates and model values remain untouched. */
export function sizePlots(root:HTMLElement):void {
  for(const svg of root.querySelectorAll<SVGSVGElement>('figure > svg')){
    const width=svg.getBoundingClientRect().width;if(!width)continue;
    for(const text of svg.querySelectorAll<SVGTextElement>('text'))text.style.fontSize=`${12*400/width}px`;
    for(const hit of svg.querySelectorAll<SVGCircleElement>('[data-hit]'))hit.setAttribute('r',String(22*400/width));
  }
}
