import { afterEach, describe, expect, it, vi } from 'vitest';
import { validateLatex } from 'mathlive/ssr';
import type { EquationDraft, EquationInputOptions } from '../../shared/equations/input';
import { mount } from './view';
vi.mock('../../shared/equations/input', () => ({
  createEquationDisplay: (latex: string, label: string) => { const e=document.createElement('div');e.textContent=latex;e.dataset.resultLatex=latex;e.setAttribute('aria-label',label);return e; },
  createEquationInput: (options: EquationInputOptions) => {
    const element=document.createElement('div'),field=document.createElement('textarea');field.value=options.value;element.append(field);
    const getValue=():EquationDraft=>({latex:field.value,empty:!field.value.trim(),hasPlaceholders:false,syntaxIssues:[]});field.addEventListener('input',()=>options.onChange?.(getValue()),{signal:options.signal});
    return {element,getValue,setValue:(v:string)=>{field.value=v;},focus:()=>field.focus(),destroy:()=>element.remove()};
  },
}));
const cleanup:(()=>void)[]=[];
afterEach(()=>{cleanup.splice(0).forEach(f=>f());document.body.replaceChildren();});
function visit(){
  const container=document.createElement('div');container.dataset.module='DD03';document.body.append(container);const controller=new AbortController(),dispose=mount({container,signal:controller.signal});
  cleanup.push(()=>{controller.abort();if(typeof dispose==='function')dispose();});
  const action=(id:string)=>container.querySelector<HTMLButtonElement>(`[data-action="${id}"]`)!.click();
  const preset=(id:string)=>container.querySelector<HTMLButtonElement>(`[data-preset="${id}"]`)!.click();
  const select=(id:string,value:string)=>{const f=container.querySelector<HTMLSelectElement>(`[data-choice="${id}"]`)!;f.value=value;f.dispatchEvent(new Event('change',{bubbles:true}));};
  const numeric=(id:string,value:string)=>{const f=container.querySelector<HTMLInputElement>(`[data-number="${id}"]`)!;f.value=value;f.dispatchEvent(new Event('input',{bubbles:true}));};
  const edit=(source:string)=>{const f=container.querySelector('textarea')!;f.value=source;f.dispatchEvent(new Event('input',{bubbles:true}));};
  const predict=(stability='inside',ramp='same')=>{select('stability',stability);select('warp','greater');select('ramp',ramp);action('check');};
  const text=(s:string)=>container.querySelector(s)!.textContent!;
  const hidden=()=>container.querySelector<HTMLElement>('.wp-results')!.hidden;
  return {container,controller,dispose,action,preset,select,numeric,edit,predict,text,hidden};
}
describe('DD03 teaching flow with mocked equation presentation (not browser evidence)',()=>{
  it('requires predictions, then reveals independent full baseline checks',()=>{
    const v=visit();v.action('prepare');expect(v.hidden()).toBe(true);v.action('check');expect(v.text('.wp-message')).toContain('all three');v.predict();expect(v.hidden()).toBe(false);
    expect(v.text('.wp-poles')).toContain('0.9');expect(v.container.querySelector('[aria-label="Full closed-loop poles"] tbody')!.children).toHaveLength(2);
    expect(v.text('.wp-margins')).toContain('47.347327');expect(v.text('.wp-tracking')).toContain('unit-ramp error: 0.5');expect(v.text('.wp-grade')).toContain('Correct full-stability');
  });
  it('typesets every actual result formula for constant, lead, lag and direct routes',()=>{
    for(const id of ['baseline','lead','lag','direct']){const v=visit();v.preset(id);v.action('prepare');v.predict();
      expect(v.hidden()).toBe(false);for(const el of v.container.querySelectorAll<HTMLElement>('[data-result-latex]'))expect(validateLatex(el.dataset.resultLatex!),el.getAttribute('aria-label')!).toEqual([]);
    }
  });
  it('keeps emulation and direct routes separate and compares remapping with redesign',()=>{
    const v=visit();v.preset('direct');v.action('prepare');expect(v.text('.wp-steps')).toContain('Required lead');v.predict('inside','smaller');expect(v.text('.wp-tracking')).toContain('Target recheck on the actual loop: |L|=1');
    expect(v.container.querySelector('[aria-label="Full closed-loop poles"] tbody')!.children).toHaveLength(3);v.action('compare');expect(v.text('.wp-comparison')).toContain('T₂: same supplied controller');expect(v.text('.wp-comparison')).toContain('T₂: redesigned physical target');
    v.preset('lead');v.action('prepare');v.predict();v.action('compare');expect(v.text('.wp-comparison')).not.toContain('redesigned physical target');expect(v.text('.wp-steps')).toContain('Emulation route');
  });
  it('supports exact sample inspection, terminal timing and local plot alternatives',()=>{
    const v=visit();v.preset('exact');v.action('prepare');v.predict('inside','larger');v.numeric('sample','1');expect(v.text('.wp-inspection')).toContain('0.19314718');
    v.numeric('sample','40');expect(v.text('.wp-inspection')).toContain('Terminal: no additional');v.numeric('sample','1.5');expect(v.text('.wp-inspection')).toContain('integer');expect(v.container.querySelector('.wp-inspection table')).toBeNull();
    v.select('response','control');expect(v.container.querySelector('.wp-response svg')!.getAttribute('aria-label')).toContain('Held control');v.select('axis','warped');expect(v.container.querySelector('.wp-bode svg')!.getAttribute('aria-label')).toContain('warped frequency');
  });
  it('inspects endpoints, rejects invalid cursor values while preserving the last plotted point',()=>{
    const v=visit();v.action('prepare');v.predict();v.action('nyquist');expect(v.text('.wp-cursor')).toContain('∞');
    const previous=v.container.querySelector('.wp-disk svg')!.innerHTML;v.numeric('cursor','1e-999');expect(v.text('.wp-cursor')).toContain('last valid');expect(v.container.querySelector('.wp-cursor table')).toBeNull();expect(v.container.querySelector('.wp-disk svg')!.innerHTML).toBe(previous);
    v.numeric('cursor','0e-999');expect(v.text('.wp-cursor')).toContain('pole');v.numeric('cursor','1e-2');expect(v.text('.wp-cursor')).toContain('finite');
  });
  it('hides stale results for native underflow and unsupported mathematical meaning',()=>{
    const v=visit();v.action('prepare');v.predict();v.numeric('gain','1e-999');v.action('prepare');expect(v.hidden()).toBe(true);expect(v.text('.wp-message')).toContain('too small');
    v.numeric('gain','1e-2');v.action('prepare');v.predict();expect(v.hidden()).toBe(false);
    v.edit(String.raw`\frac{2\frac12}{s(s+2)}`);v.action('prepare');expect(v.text('.wp-message')).toContain('explicit + or ×');
    v.edit(String.raw`\frac1\quad2/(s(s+2))`);v.action('prepare');expect(v.text('.wp-message')).toContain('blank space cannot fill a box');
    v.edit('1e-2/(s(s+2))');v.action('prepare');expect(v.text('.wp-message')).toContain('e/E');
  });
  it('reports infeasible direct phase, aliasing and excessive work then recovers',()=>{
    const v=visit();v.preset('direct');v.numeric('crossover','32');v.action('prepare');expect(v.text('.wp-message')).toContain('angle');expect(v.hidden()).toBe(true);
    v.numeric('crossover','1');v.numeric('margin','20');v.action('prepare');expect(v.text('.wp-message')).toContain('positive phase');
    v.preset('baseline');v.numeric('intervals','2001');v.action('prepare');expect(v.text('.wp-message')).toContain('between');v.numeric('intervals','10.5');v.action('prepare');expect(v.text('.wp-message')).toContain('integer');
    v.preset('baseline');v.action('prepare');v.predict();expect(v.hidden()).toBe(false);
  });
  it('does not require unused disabled corner values and keeps insufficient-horizon feedback explicit',()=>{
    const v=visit();v.numeric('zero','1e-999');v.numeric('pole','');v.numeric('gain','.1');v.numeric('intervals','10');v.action('prepare');v.predict('inside','larger');expect(v.hidden()).toBe(false);
    expect(v.text('.wp-performance')).toContain('rise is not complete');expect(v.text('.wp-performance')).toContain('horizon is insufficient');
  });
  it('keeps exact full poles/tracking available when an amplified trajectory is unavailable',()=>{
    const v=visit();v.numeric('gain','100');v.numeric('intervals','2000');v.action('prepare');v.predict('outside','smaller');expect(v.hidden()).toBe(false);
    expect(v.text('.wp-poles')).toContain('outside');expect(v.text('.wp-performance')).toContain('no partial');expect(v.container.querySelector('.wp-response svg')).toBeNull();expect(v.container.querySelector<HTMLInputElement>('[data-number="sample"]')!.disabled).toBe(true);
    v.preset('baseline');v.action('prepare');v.predict();expect(v.container.querySelector<HTMLInputElement>('[data-number="sample"]')!.disabled).toBe(false);
  });
  it('validates changed-period experiments locally and replaces entire editor sessions',()=>{
    const v=visit(),old=v.container.querySelector('textarea')!;v.preset('direct');expect(old.isConnected).toBe(false);v.action('prepare');v.predict();v.numeric('comparePeriod','1e-999');v.action('compare');expect(v.text('.wp-comparison')).toContain('too small');expect(v.hidden()).toBe(false);
    v.numeric('comparePeriod','.2');v.action('compare');expect(v.text('.wp-comparison')).toContain('Original chosen loop');v.numeric('comparePeriod','.3');expect(v.text('.wp-comparison')).toBe('');
  });
  it('labels an unresolved baseline comparison without hiding a valid chosen loop',()=>{
    // Independently solve the critical-gain discriminant for the C=4 loop.
    const a=Math.exp(-.2),h=1-a,b1=(.2-h)/4,b0=(h-.2*a)/4,A=16*b1*b1,B=-8*(1+a)*b1-16*b0,C=(1-a)**2;
    const gain=2*C/(-B+Math.sqrt(B*B-4*A*C)),v=visit();v.edit(`${gain}/(s(s+2))`);v.numeric('gain','1');v.action('prepare');v.predict('inside','larger');
    expect(v.hidden()).toBe(false);expect(v.text('.wp-bode')).toContain('comparison curve is unavailable');expect(v.text('.wp-bode')).toContain('Only the current design curve');
  });
  it('cleans once and reopens with baseline state rather than a prior design',()=>{
    const v=visit();v.preset('direct');v.action('prepare');v.predict();v.controller.abort();if(typeof v.dispose==='function'){v.dispose();v.dispose();}expect(v.container.querySelector('.wp-tool')).toBeNull();
    const fresh=visit();expect(fresh.container.querySelector<HTMLInputElement>('[data-number="period"]')!.value).toBe('0.1');expect(fresh.hidden()).toBe(true);fresh.action('prepare');fresh.predict();expect(fresh.container.querySelector('[aria-label="Full closed-loop poles"] tbody')!.children).toHaveLength(2);
  });
});
