# CP01 response derivations (unfinished implementation)

These preserve the current direction for recovery. STATUS records actual progress; the full TASK remains required.

## Model and initial conditions

Support real proper first/second-order rational models plus an optional parallel direct gain. Parse N(s), D(s) (ascending exact rational coefficients), normalize the leading D coefficient, long-divide a biproper numerator into a direct constant and strict remainder. Reject degree(N)>degree(D) with the explicit differentiator/distribution explanation. Suggested normalized bounds: |a0|≤100, |a1|≤20, strict numerator coefficients |b0|,|b1|≤50, resulting direct gain |d|≤10, normalized rational denominators≤10^9. Exact/work bounds still need final tests.

For order 2 use w''+a1*w'+a0*w=u, x=[w,w'], A=[[0,1],[-a0,-a1]], B=[0,1], C=[b0,b1], y=Cx+d*u. For order 1, w'+a0*w=u, x=w, C=b0. Initial phase states are x(0−); they need not equal external y and y' when C/d differ. State units follow the chosen filter: order-2 w has input-units*s², w' has input-units*s; order-1 w has input-units*s. Display output and state conventions explicitly.

Changing a representation must preserve the same phase-state initial vector. A useful second-order centered-coordinate view is z=T*x, T=[[1,0],[alpha,1]], alpha=a1/2. Then Az=[[-alpha,1],[delta,-alpha]], Bz=[0,1], Cz=[b0-alpha*b1,b1], delta=alpha²-a0. z0=[x10,x20+alpha*x10]. This is a coordinate view, not another arbitrary model or a reason to reset initial conditions.

## Computed analytic terms without dividing by pole separation

Define C_delta(t), S_delta(t):

- delta>0, beta=sqrt(delta): C=cosh(beta*t), S=sinh(beta*t)/beta.
- delta=0: C=1, S=t.
- delta<0, omega=sqrt(-delta): C=cos(omega*t), S=sin(omega*t)/omega.

F(t)=exp(-alpha*t)*[[C+alpha*S,S],[-a0*S,C-alpha*S]]. For x0=[w0,v0], zero-input output is exp(-alpha*t)*(c*C+k*S), c=b0*w0+b1*v0, k=(alpha*b0-a0*b1)*w0+(b0-alpha*b1)*v0. Coefficients c,k can be exact rationals. Near-coincident roots must retain exact discriminant classification; the rounded display may not claim a repeated root.

For a0 !=0, the unit dynamic step response is k0+exp(-alpha*t)*(-k0*C+(b1-alpha*k0)*S), k0=b0/a0. The unit dynamic ramp response is k0*t+k1+exp(-alpha*t)*(-k1*C+(-k0-alpha*k1)*S), k1=b1/a0-b0*a1/a0². Add direct d for a step and d*t for a ramp, and multiply the forced response by amplitude A. This regular basis works for real distinct, repeated and conjugate roots; optional expanded exponentials can be computed where well-conditioned, with exact coefficients when roots are rational.

Impulse dynamic response is exp(-alpha*t)*(b1*C+(b0-alpha*b1)*S). An ideal input of area A also has output distribution area d*A at t=0; never draw it as a finite ordinary peak.

If a0=0,a1!=0, write g0=b0/a1, ge=b1-g0. Dynamic impulse is g0+ge*exp(-a1*t). Free output is b0*w0+g0*v0+ge*v0*exp(-a1*t). Unit step is g0*t+ge/a1-(ge/a1)*exp(-a1*t). Unit ramp is g0*t²/2+(ge/a1)*t-ge/a1²+(ge/a1²)*exp(-a1*t).

If a0=a1=0, dynamic impulse is b1+b0*t, free output is b0*w0+b1*v0+b0*v0*t, unit step is b1*t+b0*t²/2, unit ramp is b1*t²/2+b0*t³/6. These are integrators, not settling responses.

Order 1, a0!=0: free b0*w0*exp(-a0*t); dynamic impulse b0*exp(-a0*t); step b0/a0-(b0/a0)*exp(-a0*t); ramp (b0/a0)*t-b0/a0²+(b0/a0²)*exp(-a0*t). If a0=0, these become b0*w0, b0, b0*t and b0*t²/2.

## Independent numerical response and pulse handling

Use a bounded matrix-exponential transition on at most four augmented states to propagate canonical free state and polynomial-input forced state. Step/ramp augment u and optionally u'; ideal impulse gives the state jump B*A at 0 while the free initial state stays separate. Compare this numerical engine with the analytic formulas, not with itself. Suggested horizon .1–60 s, bounded 600–20,000 base intervals plus ≤24 pulse/event points and |state/signal| cap10^10; exact limits must be frozen/tested.

A rectangular pulse of area A,width W has height A/W on [0,W), including direct finite jumps at 0,W. Its dynamic response is (A/W)*S_state(t) before W, then F(t-W)*(A/W)*S_state(W), avoiding cancellation of two large step states. Analytic display may use (A/W)*[g_step(t)-H(t-W)g_step(t-W)]. Preserve free response separately. Show pulse width/height/area and warn if horizon ends before W. Ideal impulse input/output distributions are separate area markers; numeric curves show only regular parts.

Sampling must hit pulse endpoints exactly and include left/right duplicate points for jumps. A cursor should evaluate the selected one-sided response, not silently interpolate over a discontinuity. Numerical cursor results can use one bounded transition from the initial state or nearest stored state. Plots need a separate input scale so a narrow pulse's height does not hide output curves.

## Interface and remaining work

Actual visual N,D entries plus a direct-gain control; shape/free/impulse/pulse modes, amplitude/width/horizon, phase initial states, optional numeric y(time-cursor) prediction and reveal, computed analytic/free/forced/sum terms, all overlays, state/transfer coordinate presentation, keyboard-accessible cursor and readable scoped mobile plots. Changes must invalidate old results; representation/cursor-only changes preserve the initial state and model. Use shared numeric reader/equation UI and cleanup guards. Current parser is untested and shares the known CF02 lexical mixed-number bug; fix it on resume after the priority CF02 review return.
