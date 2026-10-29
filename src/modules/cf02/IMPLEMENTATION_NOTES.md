# CF02 implementation notes (unfinished design)

This file preserves derivations for the active implementation, not completion evidence. The full TASK remains the contract.

## Model and selected signal

Let N(s)=b1*s+b0 and D(s)=s^n*(s+a), n=0..2, with positive a,b0 and b1>=0. Normalize any positive leading scale in the editable finite pole factor without losing numerator gain. Negative feedback uses constant positive H=h:

- y=P*(e_c+d), e_c=r-h*y-noise, physical tracking error e_t=r-y.
- One scalar excitation at a time; other inputs and initial states are zero.
- Q=D+h*N is the full characteristic polynomial, retained even when a stable mode cancels in a selected channel.

Channel transfer numerators over Q:

| Source | Y | Comparator e_c | Physical e_t |
|---|---|---|---|
| r | N | D | D+(h-1)N |
| plant-input d | N | -h*N | -N |
| sensor noise (after H) | -N | -D | N |

The reference type table applies to the comparator's reference channel. Physical error with h!=1 requires its own numerator. Example: baseline N=4,D=s(s+2),h=2 has comparator ramp limit .25 but physical ramp error asymptotically .5*t+.125.

## Exact coefficient work still needed

The initial `parseLinear` prototype returns numeric [constant,s] pairs and passes its grammar fixtures. Before classifying low-frequency powers, retain exact rational coefficients from its decimal/fraction arithmetic. For example h=.8,N=10,D=s+2 gives exactly zero constant term in D+(h-1)N, while naive floating subtraction can leave a tiny residue and incorrectly predict ramp growth. Do not trim small nonzero coefficients to zero. A bounded private rational helper (e.g. reduced integer fractions with a declared bit budget) is appropriate; preserve parser behavior and fixtures while adding an exact-coefficient API. Read native controls with shared readNumericInput first, then retain valid decimal/exponent text when exact parameter algebra needs it. Scientific e notation remains forbidden in visual polynomial entry.

A finite exact-rational resource bound must give useful feedback. Numerical simulation is a separately labelled approximation. Avoid losing nonzero values through underflow or normalization. Literal and arithmetic bounds currently tested by the prototype are not a certificate of exact cancellation.

## Stability and limits

Q degree is <=3. Normalize its leading coefficient for state simulation, but preserve the original characteristic equation for display. A quadratic is strictly Hurwitz iff all its normalized coefficients are positive. A cubic additionally needs a2*a1>a0 (monic); compare exactly when rational data are retained. Boundary/unstable loops must not receive an unconditional final-value result.

For excitation A*t^q/q! (q=0,1,2), U=A/s^(q+1). If a stable selected channel has numerator B and denominator Q with Q(0)>0, let j be the first nonzero power in B. Then sE=A*B/(s^q*Q):

- j>q: limit zero.
- j=q: finite limit A*B_j/Q_0.
- j<q: polynomial growth of degree q-j, leading time coefficient A*B_j/[Q_0*(q-j)!]; no finite final-value theorem applies.

A zero excitation with zero initial state is identically zero, independently of a separate loop-stability verdict. Preserve intentional zero; raw nonzero native underflow is an error.

## Bounded trace

For normalized denominator d(s) of order m=n+1, controllable companion A has superdiagonal ones and last row -[d0,...,d_(m-1)], B=e_m. Subtract direct feedthrough D0 from the numerator to get C; D0 is nonzero only for the biproper n=0 case.

Solve the algebraic feedback explicitly:

- A_cl=A-B*h*C/(1+h*D0), B_cl=B/(1+h*D0).
- y=C*x/(1+h*D0)+D0*w/(1+h*D0), w=r+d-noise.
- Recompute e_c and e_t from actual selected r,d,noise, not by a unity-feedback shortcut.

Augment the state with w and its polynomial derivatives (q+1 states). Initial highest derivative is signed A, others zero. At most six real states are needed. A bounded scaling/squaring Taylor exponential for a fixed plotting interval, followed by matrix-vector stepping, avoids a stiff explicit integration step loop. Bound term count/scaling, check finite values, and truncate with a visible explanation if a response exceeds its declared range. Suggested plotting bounds: 600 intervals, final time .1..120 s, |signal/state| cap 1e12. Stability/limit conclusions come from algebra, not this finite trace.

Test against independently derived baseline ramp error:

 e(t)=.5-.5*exp(-t)*cos(sqrt(3)*t)+exp(-t)*sin(sqrt(3)*t)/(2*sqrt(3)).

Also test type-0 first-order response, stable type-2 parabolic limit, nonunity physical/comparator differences, input-channel signs, direct feedthrough at t=0, unstable/boundary rejection, zero excitation, insufficient horizon and resource failures.

## Interface and lifecycle

Use visual numerator and finite-pole-factor inputs plus an explicit integrator count, native h/input amplitude/horizon controls, selected channel/error and prediction/reveal. Derive E/source before displaying constants, highlight the origin integrators/limit powers, and compare analytical result with the trace. Plot labels need readable minimum widths inside focusable scroll regions with fixed captions. Use the current shared numeric reader and equation components. Keep the synchronous mount contract, abort/disposal guards and visible recovery errors; no sibling imports or shared edits.
