import { afterEach, describe, expect, it, vi } from 'vitest';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
import { mount } from './view';

// Caller state only. Actual MathLive input, fonts and keyboard require browser QA.
vi.mock('../../shared/equations/input',()=>({
  createEquationDisplay:(latex:string,label:string)=>{const element=document.createElement('div');element.textContent=latex;element.setAttribute('aria-label',label);return element;},
  createEquationInput:(options:EquationInputOptions)=>{
    const element=document.createElement('div'),field=document.createElement('textarea');field.value=options.value;field.setAttribute('aria-label',options.label);element.append(field);
    const getValue=():EquationDraft=>({latex:field.value,empty:!field.value.trim(),hasPlaceholders:false,syntaxIssues:[]});
    field.addEventListener('input',()=>options.onChange?.(getValue()),{signal:options.signal});
    const destroy=()=>element.remove();options.signal.addEventListener('abort',destroy,{once:true});
    return{element,getValue,setValue:(value:string)=>{field.value=value;},focus:()=>field.focus(),destroy};
  },
}));
afterEach(()=>document.body.replaceChildren());
function visit(){
  const container=document.createElement('div');container.dataset.module='CR02';document.body.append(container);const controller=new AbortController();const cleanup=mount({container,signal:controller.signal});
  const click=(name:string)=>{const b=[...container.querySelectorAll('button')].find(b=>b.textContent===name)!;b.click();return b;};
  const field=(label:string)=>container.querySelector<HTMLInputElement>(`[aria-label="${label}"]`)!;
  const change=(label:string,value:string)=>{const input=field(label);input.value=value;input.dispatchEvent(new Event('input'));};
  return{container,click,field,change,close:()=>{controller.abort();cleanup?.();}};
}
describe('CR02 applied model and experiment state',()=>{
  it('reveals the numerical decomposition and leaves G unchanged after an initial-state edit',()=>{
    const view=visit();view.click('Reveal derivation & response');
    const transfer=view.container.querySelector('[aria-label="Zero-state transfer function"]')!.textContent;
    expect(view.container.textContent).toContain('0.1997882');
    view.change('Initial displacement y(0−) (m)','1');
    expect(view.container.querySelector<HTMLElement>('[data-ui="answers"]')!.hidden).toBe(true);
    view.click('Reveal derivation & response');
    expect(view.container.querySelector('[aria-label="Zero-state transfer function"]')!.textContent).toBe(transfer);
    expect(view.container.textContent).toContain('0.6004236'); // 2e^-1-e^-2
    expect(view.container.textContent).toContain('0.8002118'); // .5+e^-1-.5e^-2
    view.close();
  });
  it('physical cells write an ODE draft and cannot silently reuse a stale model after invalid input',()=>{
    const view=visit();view.change('Mass m (kg)','2');
    expect(view.container.querySelector<HTMLTextAreaElement>('[aria-label="Physical ODE"]')!.value).toContain("2y''");
    view.click('Apply ODE');expect(view.container.querySelector('[aria-label="Normalized ODE"]')!.textContent).toContain("1.5y'");
    view.change('Mass m (kg)','');view.click('Apply ODE');view.click('Reveal derivation & response');
    expect(view.container.querySelector<HTMLElement>('[data-ui="answers"]')!.hidden).toBe(true);
    expect(view.field('Mass m (kg)').value).toBe('');
    view.click('Baseline');view.click('Reveal derivation & response');expect(view.field('Mass m (kg)').value).toBe('1');view.close();
  });
  it('rejects a visual e/E expression before a new calculation',()=>{
    const view=visit(),field=view.container.querySelector<HTMLTextAreaElement>('[aria-label="Physical ODE"]')!;
    field.value="1e-2y''+3y'+2y=u";field.dispatchEvent(new Event('input'));view.click('Apply ODE');
    expect(view.container.textContent).toContain('visual editor treats e/E');
    expect(view.container.querySelector<HTMLElement>('[data-ui="answers"]')!.hidden).toBe(true);view.close();
  });
  it('does not silently turn nonzero underflow in numeric cells or initial data into zero',()=>{
    const view=visit();view.change('Damping c (N·s/m)','1e-999');
    expect(view.container.textContent).toContain('Damping c is too small to represent');
    view.click('Apply ODE');view.click('Reveal derivation & response');
    expect(view.container.querySelector<HTMLElement>('[data-ui="answers"]')!.hidden).toBe(true);
    view.click('Baseline');view.change('Initial displacement y(0−) (m)','-1e-999');
    expect(view.container.querySelector('[aria-label="Selected term and its Laplace transform"]')).toBeNull();
    view.click('Reveal derivation & response');
    expect(view.container.textContent).toContain('Initial displacement is too small to represent');
    expect(view.container.querySelector<HTMLElement>('[data-ui="answers"]')!.hidden).toBe(true);
    view.change('Initial displacement y(0−) (m)','0e-999');view.click('Reveal derivation & response');
    expect(view.container.querySelector<HTMLElement>('[data-ui="answers"]')!.hidden).toBe(false);
    view.change('Command amplitude / ramp slope','1e-2');view.click('Reveal derivation & response');
    expect(view.container.querySelector('[aria-label="Numerical response at cursor"]')!.textContent).toContain('0.001997882');view.close();
  });
  it('explains the derivative of the same scalar input and the step velocity jump',()=>{
    const view=visit();view.click('Input-derivative example');view.click('Reveal derivation & response');
    expect(view.container.textContent).toContain('not a second independent input');
    expect(view.container.textContent).toContain('y′(0+) = y′(0−) + dA/m = 1 m/s');
    expect(view.container.querySelector('[aria-label="Modified states and one-input state equation"]')!.textContent).toContain("x_2=y'-(1)u");view.close();
  });
  it('uses zero command even when a disabled amplitude draft is empty',()=>{
    const view=visit();view.change('Initial displacement y(0−) (m)','1');
    view.change('Command amplitude / ramp slope','');view.change('One scalar command','zero');
    expect(view.field('Command amplitude / ramp slope').disabled).toBe(true);
    view.click('Reveal derivation & response');
    expect(view.container.querySelector<HTMLElement>('[data-ui="answers"]')!.hidden).toBe(false);
    expect(view.container.querySelector('[aria-label="Numerical response at cursor"]')!.textContent).toContain('0.6004236');
    expect(view.container.textContent).toContain('Command u = 0 input units');
    view.change('One scalar command','step');view.click('Reveal derivation & response');
    expect(view.container.querySelector<HTMLElement>('[data-ui="answers"]')!.hidden).toBe(true);
    expect(view.container.textContent).toContain('Command amplitude/slope must be finite');view.close();
  });
  it('dismisses the keyboard before Escape can switch the editor to raw notation, then removes that listener',()=>{
    const previous=window.mathVirtualKeyboard,hide=vi.fn();Object.defineProperty(window,'mathVirtualKeyboard',{value:{hide},configurable:true});
    try{
      const view=visit(),field=view.container.querySelector<HTMLTextAreaElement>('[aria-label="Physical ODE"]')!,editorHandler=vi.fn();field.addEventListener('keydown',editorHandler);
      const escape=new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true});field.dispatchEvent(escape);
      expect(escape.defaultPrevented).toBe(true);expect(editorHandler).not.toHaveBeenCalled();expect(hide).toHaveBeenCalledOnce();
      view.click('W02 worksheet');view.click('Reveal derivation & response');expect(view.container.textContent).toContain('0.1142073');
      view.close();field.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true,cancelable:true}));expect(hide).toHaveBeenCalledOnce();
    }finally{Object.defineProperty(window,'mathVirtualKeyboard',{value:previous,configurable:true});}
  });
  it('aborts old listeners and reopens at the baseline without carrying state',()=>{
    const first=visit();first.click('Nonzero initial displacement');const oldButton=[...first.container.querySelectorAll('button')].find(b=>b.textContent==='Reveal derivation & response')!;first.close();
    const next=visit();oldButton.click();expect(next.field('Initial displacement y(0−) (m)').value).toBe('0');
    expect(next.container.querySelector<HTMLElement>('[data-ui="answers"]')!.hidden).toBe(true);next.close();expect(next.container.children.length).toBe(0);
  });
});
