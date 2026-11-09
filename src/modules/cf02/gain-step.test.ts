import{describe,expect,it}from'vitest';
import{gainStep}from'./gain-step';
describe('native gain keyboard arithmetic',()=>{
  it('preserves exact decimal increments and all entered significant digits',()=>{expect(gainStep('4.1',1)).toBe('4.2');expect(gainStep('4.2',-1)).toBe('4.1');expect(gainStep('.12345678901234567',1)).toBe('0.22345678901234567');expect(gainStep('4e0',1,true)).toBe('5');});
  it('respects the complete original gain bounds without wrapping or rounding input data',()=>{expect(gainStep('.05',-1)).toBe('0.05');expect(gainStep('49.99',1,true)).toBe('50');expect(gainStep('0.050000000001',1)).toBe('0.150000000001');expect(()=>gainStep('0',1)).toThrow('Checked gain');});
});
