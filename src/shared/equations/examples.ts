/**
 * Curated presentation of the original exercise baselines. These are display
 * and editor seeds, not parsed models or calculated answers. Keep source in
 * sync with the matching manifest; the coverage test checks this explicitly.
 */
export type EquationExamplePart =
  | { readonly kind: 'math'; readonly latex: string; readonly label: string; readonly editable: true }
  | { readonly kind: 'text'; readonly text: string };

export interface EquationExample {
  readonly source: string;
  readonly parts: readonly EquationExamplePart[];
}

const math = (label: string, latex: string): EquationExamplePart =>
  Object.freeze({ kind: 'math', label, latex, editable: true });
const text = (value: string): EquationExamplePart => Object.freeze({ kind: 'text', text: value });
const example = (source: string, ...parts: EquationExamplePart[]): EquationExample =>
  Object.freeze({ source, parts: Object.freeze(parts) });

// String.raw preserves TeX backslashes and matrix row separators verbatim.
const tex = String.raw;

export const equationExamples: Readonly<Record<string, EquationExample>> = Object.freeze({
  CR01: example('P(s) = s^4 + 7s^3 + 27s^2 + 47s + 26',
    math('Polynomial', tex`P(s)=s^4+7s^3+27s^2+47s+26`)),
  CR02: example("y'' + 3y' + 2y = u; y(0) = 0; y'(0) = 0",
    math('Differential equation', tex`\ddot{y}+3\dot{y}+2y=u`),
    math('Initial output', tex`y(0)=0`), math('Initial output derivative', tex`\dot{y}(0)=0`)),
  CR03: example('A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; D = 0',
    math('State matrix', tex`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`),
    math('Input matrix', tex`B=\begin{bmatrix}0\\1\end{bmatrix}`),
    math('Output matrix', tex`C=\begin{bmatrix}1&0\end{bmatrix}`), math('Feedthrough', 'D=0')),
  CR04: example('G1 = 1/(s+1); G2 = 1/(s+2); H2 = 2; H1 = 1; negative feedback',
    math('First block', tex`G_1(s)=\frac{1}{s+1}`), math('Second block', tex`G_2(s)=\frac{1}{s+2}`),
    math('Second feedback block', 'H_2=2'), math('First feedback block', 'H_1=1'), text('Negative feedback.')),
  CR05: example('G1 = 1/(s+1); G2 = 1/(s+2); inner H2 = 2; outer H1 = 1',
    math('First block', tex`G_1(s)=\frac{1}{s+1}`), math('Second block', tex`G_2(s)=\frac{1}{s+2}`),
    math('Inner feedback block', 'H_2=2'), math('Outer feedback block', 'H_1=1')),
  CR06: example("x1' = x2; x2' = -2x1 - 3x2 + u; y = x1; x(0) = [0;0]",
    math('First state equation', tex`\dot{x}_1=x_2`),
    math('Second state equation', tex`\dot{x}_2=-2x_1-3x_2+u`), math('Output equation', 'y=x_1'),
    math('Initial state', tex`\mathbf{x}(0)=\begin{bmatrix}0\\0\end{bmatrix}`)),

  CP01: example('G(s) = 1/((s+1)(s+2)); input: unit step; initial state: zero',
    math('Plant transfer function', tex`G(s)=\frac{1}{(s+1)(s+2)}`), text('Unit-step input. Initial state: zero.')),
  CP02: example('G(s) = 4/(s^2+2s+4); input: unit step',
    math('Plant transfer function', tex`G(s)=\frac{4}{s^2+2s+4}`), text('Unit-step input.')),
  CP03: example('G(s) = 1/((s+1)(s+2)); u(t) = sin(t); omega = 1 rad/s',
    math('Plant transfer function', tex`G(s)=\frac{1}{(s+1)(s+2)}`),
    math('Input', tex`u(t)=\sin(t)`), math('Angular frequency', tex`\omega=1\;\mathrm{rad/s}`)),
  CP04: example('G(s) = 1/((s+1)(s+2)); frequency unit: rad/s',
    math('Plant transfer function', tex`G(s)=\frac{1}{(s+1)(s+2)}`), text('Frequency in rad/s.')),
  CP05: example('L(s) = 4/((s+1)(s+2)); negative unity feedback',
    math('Loop transfer function', tex`L(s)=\frac{4}{(s+1)(s+2)}`), text('Negative unity feedback.')),
  CP06: example('L(s) = K/(s(s+2)(s+5)); K >= 0',
    math('Loop transfer function', tex`L(s)=\frac{K}{s(s+2)(s+5)}`), math('Gain constraint', tex`K\geq0`)),

  CS01: example('G(s) = 1/((s+1)(s+2)); poles = -1, -2',
    math('Plant transfer function', tex`G(s)=\frac{1}{(s+1)(s+2)}`), math('Poles', tex`s_1=-1,\quad s_2=-2`)),
  CS02: example('P(s) = s^3 + 7s^2 + 10s + K; K = 20',
    math('Characteristic polynomial', 'P(s)=s^3+7s^2+10s+K'), math('Gain', 'K=20')),
  CS03: example('P(s) = s^3 + 7s^2 + 10s + K; parameter: K',
    math('Characteristic polynomial', 'P(s)=s^3+7s^2+10s+K'), text('Vary the parameter K.')),
  CS04: example('L(s) = 4/((s+1)(s+2)); negative unity feedback',
    math('Loop transfer function', tex`L(s)=\frac{4}{(s+1)(s+2)}`), text('Negative unity feedback.')),
  CS05: example('L(s) = K/(s(s+2)(s+5)); K >= 0',
    math('Loop transfer function', tex`L(s)=\frac{K}{s(s+2)(s+5)}`), math('Gain constraint', tex`K\geq0`)),

  CF01: example('T(s) = 4/(s^2+2s+4); unit step; settling band: 2%',
    math('Closed-loop transfer function', tex`T(s)=\frac{4}{s^2+2s+4}`), text('Unit step. Settling band: 2%.')),
  CF02: example('L(s) = 4/(s(s+2)); unity feedback; reference: r(t) = t',
    math('Loop transfer function', tex`L(s)=\frac{4}{s(s+2)}`), math('Reference', 'r(t)=t'), text('Unity feedback.')),
  CF03: example('G(s) = 1/((s+1)(s+2)); C(s) = 4; unit step; horizon: 10 s',
    math('Plant transfer function', tex`G(s)=\frac{1}{(s+1)(s+2)}`), math('Controller', 'C(s)=4'),
    text('Unit step. Time horizon: 10 s.')),
  CF04: example('G(s) = 1/(s(s+2)); C(s) = 4; L(s) = C(s)G(s)',
    math('Plant transfer function', tex`G(s)=\frac{1}{s(s+2)}`), math('Controller', 'C(s)=4'),
    math('Loop relation', 'L(s)=C(s)G(s)')),
  CF05: example('G(s) = 1/(s(s+2)); C(s) = 12(s+8/3)/(s+6)',
    math('Plant transfer function', tex`G(s)=\frac{1}{s(s+2)}`),
    math('Controller', tex`C(s)=\frac{12\left(s+\frac{8}{3}\right)}{s+6}`)),

  CD01: example('G(s) = 1/((s+1)(s+2)); Kp = 4; Ki = 2; Kd = 1; Tf = 0.05 s',
    math('Plant transfer function', tex`G(s)=\frac{1}{(s+1)(s+2)}`), math('Proportional gain', 'K_p=4'),
    math('Integral gain', 'K_i=2'), math('Derivative gain', 'K_d=1'), math('Filter time', tex`T_f=0.05\;\mathrm{s}`)),
  CD02: example('G(s) = 1/(s(s+2)); targets = -2 +/- 2j; compensator pole = -6',
    math('Plant transfer function', tex`G(s)=\frac{1}{s(s+2)}`),
    math('Target poles', tex`s_{1,2}=-2\pm2\mathrm{j}`), math('Compensator pole', 'p_c=-6')),
  CD03: example('G(s) = 1/(s(s+2)); baseline C(s) = 4; unit-ramp reference',
    math('Plant transfer function', tex`G(s)=\frac{1}{s(s+2)}`), math('Baseline controller', 'C(s)=4'),
    text('Unit-ramp reference.')),
  CD04: example('G(s) = 1/(s(s+2)); baseline C(s) = 4; negative unity feedback',
    math('Plant transfer function', tex`G(s)=\frac{1}{s(s+2)}`), math('Baseline controller', 'C(s)=4'),
    text('Negative unity feedback.')),
  CD05: example('G(s) = 1/(s(s+2)); C0 = 4; target crossover = 2 rad/s',
    math('Plant transfer function', tex`G(s)=\frac{1}{s(s+2)}`), math('Baseline controller gain', 'C_0=4'),
    math('Target crossover', tex`\omega_c=2\;\mathrm{rad/s}`)),
  CD06: example('G(s) = 1/(s(s+2)); C0 = 4; negative unity feedback',
    math('Plant transfer function', tex`G(s)=\frac{1}{s(s+2)}`), math('Baseline controller gain', 'C_0=4'),
    text('Negative unity feedback.')),
  CD07: example('G(s) = exp(-0.5s)/(2s+1); response-curve tuning example',
    math('Plant transfer function', tex`G(s)=\frac{e^{-0.5s}}{2s+1}`), text('Response-curve tuning example.')),
  CD08: example('A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; targets = -2, -4',
    math('State matrix', tex`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`),
    math('Input matrix', tex`B=\begin{bmatrix}0\\1\end{bmatrix}`),
    math('Output matrix', tex`C=\begin{bmatrix}1&0\end{bmatrix}`), math('Target poles', tex`s_1=-2,\quad s_2=-4`)),
  CD09: example('A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; observer targets = -6, -7',
    math('State matrix', tex`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`),
    math('Input matrix', tex`B=\begin{bmatrix}0\\1\end{bmatrix}`),
    math('Output matrix', tex`C=\begin{bmatrix}1&0\end{bmatrix}`), math('Observer target poles', tex`s_1=-6,\quad s_2=-7`)),

  DR01: example('h[k] = 0.8^k for k >= 0; initial history: zero',
    math('Impulse response', 'h[k]=0.8^k'), math('Index range', tex`k\geq0`), text('Initial history: zero.')),
  DR02: example('y[k+1] = 0.90483742 y[k] + 0.09516258 u[k]; T = 0.1 s',
    math('Difference equation', 'y[k+1]=0.90483742y[k]+0.09516258u[k]'), math('Sample period', tex`T=0.1\;\mathrm{s}`)),
  DR03: example('A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; use ZOH at T = 0.1 s',
    math('Continuous state matrix', tex`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`),
    math('Continuous input matrix', tex`B=\begin{bmatrix}0\\1\end{bmatrix}`),
    math('Output matrix', tex`C=\begin{bmatrix}1&0\end{bmatrix}`), math('Sample period', tex`T=0.1\;\mathrm{s}`),
    text('Use a zero-order hold.')),
  DR04: example('G(s) = 5 exp(-0.2s)/s^2; T = 0.2 s; H = 0.1; C(z) = 10 - 2z^-1',
    math('Plant transfer function', tex`G(s)=\frac{5e^{-0.2s}}{s^2}`), math('Sample period', tex`T=0.2\;\mathrm{s}`),
    math('Feedback gain', 'H=0.1'), math('Discrete controller', tex`C(z)=10-2z^{-1}`)),
  DR05: example('G(s) = 1/(s+1); zero-order hold; T = 0.1 s',
    math('Continuous plant', tex`G(s)=\frac{1}{s+1}`), math('Sample period', tex`T=0.1\;\mathrm{s}`), text('Zero-order hold.')),

  DP01: example('G(z) = 0.2/(z-0.8); unit-step input; T = 0.1 s',
    math('Discrete plant', tex`G(z)=\frac{0.2}{z-0.8}`), math('Sample period', tex`T=0.1\;\mathrm{s}`), text('Unit-step input.')),
  DP02: example('s = -2 + 3j and -2 - 3j; z = exp(sT); T = 0.1 s',
    math('Continuous pole pair', tex`s_{1,2}=-2\pm3\mathrm{j}`), math('Pole mapping', tex`z=e^{sT}`),
    math('Sample period', tex`T=0.1\;\mathrm{s}`)),
  DP03: example('G(z) = (0.0544z+0.0493)/(z^2-1.741z+0.741); T = 0.1 s',
    math('Discrete plant', tex`G(z)=\frac{0.0544z+0.0493}{z^2-1.741z+0.741}`), math('Sample period', tex`T=0.1\;\mathrm{s}`)),
  DP04: example('L(z) = K(z+0.2)/(z(z-1)); K >= 0; T = 0.1 s',
    math('Discrete loop transfer function', tex`L(z)=\frac{K(z+0.2)}{z(z-1)}`), math('Gain constraint', tex`K\geq0`),
    math('Sample period', tex`T=0.1\;\mathrm{s}`)),

  DS01: example('Modes: 0.8^k and (-0.8)^k; T = 0.1 s',
    math('First mode', '0.8^k'), math('Second mode', '(-0.8)^k'), math('Sample period', tex`T=0.1\;\mathrm{s}`)),
  DS02: example('P(z) = z^2 + (K-1)z + 0.2K; parameter: K',
    math('Characteristic polynomial', 'P(z)=z^2+(K-1)z+0.2K'), text('Vary the parameter K.')),
  DS03: example('P(z) = z^2 + (K-1)z + 0.2K; z = (1+w)/(1-w)',
    math('Characteristic polynomial', 'P(z)=z^2+(K-1)z+0.2K'), math('Bilinear substitution', tex`z=\frac{1+w}{1-w}`)),
  DS04: example('L(z) = K(z+0.2)/(z(z-1)); negative unity feedback',
    math('Discrete loop transfer function', tex`L(z)=\frac{K(z+0.2)}{z(z-1)}`), text('Negative unity feedback.')),
  DS05: example('L(z) = 0.5/(z-0.8); negative unity feedback; T = 0.1 s',
    math('Discrete loop transfer function', tex`L(z)=\frac{0.5}{z-0.8}`), math('Sample period', tex`T=0.1\;\mathrm{s}`),
    text('Negative unity feedback.')),

  DF01: example('G(z) = 0.2/(z-0.8); unit step; T = 0.1 s; settling band: 2%',
    math('Discrete plant', tex`G(z)=\frac{0.2}{z-0.8}`), math('Sample period', tex`T=0.1\;\mathrm{s}`),
    text('Unit step. Settling band: 2%.')),
  DF02: example('L(z) = 0.1/(z-1); unity feedback; r[k] = kT; T = 0.1 s',
    math('Discrete loop transfer function', tex`L(z)=\frac{0.1}{z-1}`), math('Reference', 'r[k]=kT'),
    math('Sample period', tex`T=0.1\;\mathrm{s}`), text('Unity feedback.')),
  DF03: example('L(z) = 0.5/(z-0.8); negative unity feedback; T = 0.1 s',
    math('Discrete loop transfer function', tex`L(z)=\frac{0.5}{z-0.8}`), math('Sample period', tex`T=0.1\;\mathrm{s}`),
    text('Negative unity feedback.')),
  DF04: example('G(s) = 1/(s+1); C = 2; zero-order hold; T = 0.1 s',
    math('Continuous plant', tex`G(s)=\frac{1}{s+1}`), math('Controller gain', 'C=2'),
    math('Sample period', tex`T=0.1\;\mathrm{s}`), text('Zero-order hold.')),

  DD01: example('C(s) = 12(s+8/3)/(s+6); Tustin; T = 0.1 s',
    math('Continuous controller', tex`C(s)=\frac{12\left(s+\frac{8}{3}\right)}{s+6}`),
    math('Sample period', tex`T=0.1\;\mathrm{s}`), text('Tustin transformation.')),
  DD02: example('G(s) = 50/(s(s+5)); ZOH T = 0.1 s; target zeta = 0.707, wn = 10 rad/s',
    math('Continuous plant', tex`G(s)=\frac{50}{s(s+5)}`), math('Sample period', tex`T=0.1\;\mathrm{s}`),
    math('Target damping ratio', tex`\zeta=0.707`), math('Target natural frequency', tex`\omega_n=10\;\mathrm{rad/s}`),
    text('Zero-order hold.')),
  DD03: example('G(s) = 1/(s(s+2)); ZOH T = 0.1 s; baseline controller C = 4',
    math('Continuous plant', tex`G(s)=\frac{1}{s(s+2)}`), math('Sample period', tex`T=0.1\;\mathrm{s}`),
    math('Baseline controller gain', 'C=4'), text('Zero-order hold.')),
  DD04: example('Kp = 4; Ki = 2; Kd = 1; T = 0.1 s; trapezoidal I; backward D',
    math('Proportional gain', 'K_p=4'), math('Integral gain', 'K_i=2'), math('Derivative gain', 'K_d=1'),
    math('Sample period', tex`T=0.1\;\mathrm{s}`), text('Trapezoidal integration. Backward-difference derivative.')),
  DD05: example('G(s) = 10/(10s+1); H = 0.05; T = 2 s; zeta = 0.707; wn = 2 rad/s',
    math('Continuous plant', tex`G(s)=\frac{10}{10s+1}`), math('Feedback gain', 'H=0.05'),
    math('Sample period', tex`T=2\;\mathrm{s}`), math('Target damping ratio', tex`\zeta=0.707`),
    math('Target natural frequency', tex`\omega_n=2\;\mathrm{rad/s}`)),
  DD06: example('A = [0,1; -2,-3]; B = [0;1]; ZOH T = 0.1 s; targets = 0.7, 0.8',
    math('Continuous state matrix', tex`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`),
    math('Continuous input matrix', tex`B=\begin{bmatrix}0\\1\end{bmatrix}`),
    math('Sample period', tex`T=0.1\;\mathrm{s}`), math('Target discrete poles', tex`z_1=0.7,\quad z_2=0.8`),
    text('Zero-order hold.')),
  DD07: example('A = [0,1; -2,-3]; C = [1,0]; ZOH T = 0.1 s; observer targets = 0.3, 0.4',
    math('Continuous state matrix', tex`A=\begin{bmatrix}0&1\\-2&-3\end{bmatrix}`),
    math('Output matrix', tex`C=\begin{bmatrix}1&0\end{bmatrix}`), math('Sample period', tex`T=0.1\;\mathrm{s}`),
    math('Observer target discrete poles', tex`z_1=0.3,\quad z_2=0.4`), text('Zero-order hold.')),
});

export function findEquationExample(id: string): EquationExample | undefined {
  return equationExamples[id.trim().toUpperCase()];
}
