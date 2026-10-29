import { describe, expect, it } from 'vitest';
import { convertLatexToMathMl, validateLatex } from 'mathlive/ssr';
import { modules } from '../../modules/catalog';
import { equationExamples, findEquationExample } from './examples';

const mathFor = (id: string, label: string): string => {
  const part = findEquationExample(id)?.parts.find((entry) => entry.kind === 'math' && entry.label === label);
  if (!part || part.kind !== 'math') throw new Error(`Missing ${id}: ${label}`);
  return part.latex;
};

describe('curated equation baselines', () => {
  it('has valid notation throughout and preserves fraction and matrix structure in the renderer', () => {
    for (const [id, example] of Object.entries(equationExamples)) {
      for (const part of example.parts) {
        if (part.kind === 'math') expect(validateLatex(part.latex), `${id}: ${part.label}`).toEqual([]);
      }
    }
    const plant = convertLatexToMathMl(mathFor('CD02', 'Plant transfer function'));
    expect(plant).toContain('<mfrac>');
    const matrix = convertLatexToMathMl(mathFor('CR03', 'State matrix'));
    expect(matrix).toContain('<mtable');
    expect(matrix.match(/<mtr>/g)).toHaveLength(2);
  });
  it('covers exactly the catalogue and retains every original source verbatim', () => {
    expect(Object.keys(equationExamples).sort()).toEqual(modules.map((module) => module.id).sort());
    expect(Object.keys(equationExamples)).toHaveLength(56);
    for (const module of modules) {
      const example = findEquationExample(module.id);
      expect(example?.source, module.id).toBe(module.defaultExample);
      expect(example?.parts.some((part) => part.kind === 'math' && part.editable), module.id).toBe(true);
      for (const part of example!.parts) {
        if (part.kind === 'math') {
          expect(part.label.trim(), module.id).not.toBe('');
          expect(part.latex.trim(), module.id).not.toBe('');
          // Accidental escaped JS control characters corrupt TeX silently.
          expect(part.latex, module.id).not.toMatch(/[\u0000-\u001f]/);
        } else {
          expect(part.text.trim(), module.id).not.toBe('');
        }
      }
    }
  });

  it('keeps the lead-design plant, complex targets and real compensator pole distinct', () => {
    expect(mathFor('CD02', 'Plant transfer function')).toBe(String.raw`G(s)=\frac{1}{s(s+2)}`);
    expect(mathFor('CD02', 'Target poles')).toBe(String.raw`s_{1,2}=-2\pm2\mathrm{j}`);
    expect(mathFor('CD02', 'Compensator pole')).toBe('p_c=-6');
    expect(findEquationExample('CD02')!.parts).toHaveLength(3);
  });

  it('retains signs, coefficient order and initial conditions when typesetting state equations', () => {
    expect(mathFor('CR03', 'State matrix')).toBe(String.raw`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`);
    expect(mathFor('CR03', 'Input matrix')).toBe(String.raw`B=\begin{bmatrix}0\\1\end{bmatrix}`);
    expect(mathFor('CR03', 'Output matrix')).toBe(String.raw`C=\begin{bmatrix}1&0\end{bmatrix}`);
    expect(mathFor('CR02', 'Differential equation')).toBe(String.raw`\ddot{y}+3\dot{y}+2y=u`);
    expect(mathFor('CR06', 'Second state equation')).toBe(String.raw`\dot{x}_2=-2x_1-3x_2+u`);
    expect(mathFor('CR06', 'Initial state')).toBe(String.raw`\mathbf{x}(0)=\begin{bmatrix}0\\0\end{bmatrix}`);
  });

  it('retains nested fractions, delays, inverse powers and discrete transforms', () => {
    expect(mathFor('CF05', 'Controller')).toBe(String.raw`C(s)=\frac{12\left(s+\frac{8}{3}\right)}{s+6}`);
    expect(mathFor('CD07', 'Plant transfer function')).toBe(String.raw`G(s)=\frac{e^{-0.5s}}{2s+1}`);
    expect(mathFor('DR04', 'Discrete controller')).toBe(String.raw`C(z)=10-2z^{-1}`);
    expect(mathFor('DP02', 'Pole mapping')).toBe(String.raw`z=e^{sT}`);
    expect(mathFor('DS03', 'Bilinear substitution')).toBe(String.raw`z=\frac{1+w}{1-w}`);
    expect(mathFor('DD06', 'Target discrete poles')).toBe(String.raw`z_1=0.7,\quad z_2=0.8`);
  });

  it('provides immutable seeds and normalizes route IDs without inventing examples', () => {
    expect(findEquationExample(' cd02 ')).toBe(equationExamples.CD02);
    expect(findEquationExample('missing')).toBeUndefined();
    expect(findEquationExample('')).toBeUndefined();
    expect(Object.isFrozen(equationExamples)).toBe(true);
    for (const example of Object.values(equationExamples)) {
      expect(Object.isFrozen(example)).toBe(true);
      expect(Object.isFrozen(example.parts)).toBe(true);
      for (const part of example.parts) expect(Object.isFrozen(part)).toBe(true);
    }
  });
});
