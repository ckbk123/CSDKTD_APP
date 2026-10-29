# CF03 implementation status

- **Stage:** in-progress
- **Assessed:** 2026-10-29; starting primary revision `c45512e`
- **Ownership:** `src/modules/cf03/**`; acceptance: [TASK.md](TASK.md)
- **Worker chat:** `01a18701-3f40-7572-9a49-7dc0103c9161`
- **Branch/worktree:** `codex/cf03-error-effort-01a18701`, `C:/Users/baokh/.codex/worktrees/cf03-error-effort/CSDKTD APP`

## Starting audit and accepted requirements

The current workspace is blank, metadata-only lazy loading works and there are no module tests. No functionality is being replaced. Shared visual equations and native-number validation are available; no shared mathematical toolbox is implemented.

| Requirement | Starting evidence / implementation action |
|---|---|
| Compute IAE/ISE/ITAE/ITSE | Absent; derive error in explicit unity negative feedback, integrate all four finite-horizon criteria |
| Explain different controller rankings | Absent; compare two editable P/PI controllers on the same plant/horizon, show each criterion and effort separately, include a checked ranking-reversal example |
| Shade incremental contributions | Absent; selected metric's density and shaded chosen time interval, cumulative/interval contributions and a numeric cursor |
| Overlay error with u(t) and units | Absent; labeled separate scales and line styles; zero initial conditions, unit reference, no saturation |
| Temporary baseline/variant | Absent; mount-local controller drafts and results, reset/reopen baseline |
| Independent/finer check | Absent; analytic first-order error-integral fixture and independently derived baseline response, plus bounded resolution refinement and reported numerical discrepancy |
| Unstable/truncated designs | Absent; complete low-order characteristic stability conditions and visible finite-horizon-only warnings; no optimizer/optimality claim |
| Visual inputs and errors | Absent; bounded real-polynomial plant and P/PI controller grammar, mixed/hidden grouping/e-symbol semantic gates, shared native-number helper |
| Verification/lifecycle | No module tests/browser evidence; add meaningful mathematical and error/cleanup coverage then project checks/reserved real browser QA |

## Intended bounded domain

Real constant-numerator strictly proper first/second-order G(s), and proportional or PI C(s), in explicit unity negative feedback. Editable visual polynomial/factored forms within degree2; PI as a linear numerator over s. Zero initial plant state/integral, unit step at t=0. Finite common horizon, bounded RK4 state stepping with independently accumulated quadrature and resolution refinement. Declare all bounds and accuracy limits in the final record. No derivative impulse, actuator saturation, nonlinear model or infinite-horizon optimum is introduced.

Source atlas CF03 and continuous audit P2 were read (Ch5:28–32; S07:6,9–11); original slide assets were not inspected. New small analytic/ranking fixtures are independently constructed checks, not asserted slide transcriptions. Implementation, independent fixtures, all checks and browser evidence remain pending. Prior DF01 PR16/worktree remains preserved for coordinator integration.

## Mathematical checkpoint

`input.ts` provides the bounded visual grammar with compact-fraction, unary-sign, scientific-symbol, mixed/nested fraction and hidden-brace guards. `math.ts` steps the actual closed-loop plant/P or PI state with RK4, accumulates five finite-horizon Simpson integrals, checks strict low-order Hurwitz conditions on the full chosen realization, and doubles the grid until all cost and sampled-error/control differences meet the numerical tolerance. A selected integral can be checked by a different quadrature rule on a twice-finer state grid. These discrepancies are numerical consistency evidence, not certified error bounds.

`input.test.ts` and `math.test.ts`: **27 tests pass**. Independent fixtures include all first-order closed integrals; baseline analytic damped response and exponential-antiderivative costs; a full cubic-residue ranking reversal; zero controller, changed gain, unstable finite trajectories, boundaries, panel decomposition and bounded failures. Baseline costs at10s independently evaluate to IAE3.666666590918936, ISE1.5185184680200159, ITAE16.722221469421186, ITSE5.645061226527535, effort24.296295488320254. Interface, full checks and browser evidence remain pending.

Ranking fixture on the baseline plant at10s: A=(Kp=.5,Ki=.5) has IAE3.7796985901715963, ISE2.242892549216929; B=(2,.25) has IAE4.055776887555571, ISE1.9147761290106218. Thus IAE favorsA and ISE favorsB; effort favorsB. Reference values use independent exponential-residue antiderivatives, not RK/quadrature output. A's error is positive from its real two-mode expression; forB a positive slow residue dominates the fast oscillatory envelope after about.32s, while the initial cosine/sine combination is positive before then. Absolute-error integrals therefore reduce to their signed analytic integrals for this fixture. Original source-slide inspection is not claimed.

## Interface checkpoint before browser QA

`view.ts`, `plots.ts` and scoped `style.css` now provide three real visual fields (plant and two P/PI controllers), shared native-number reads, common horizon/tolerance, response e/u overlay with explicit dual units and line patterns, selected metric/run/time, shaded density accumulation and incremental Simpson panel arithmetic, predictions/reveal, five-cost comparison, early/late tracking-cost breakdown and a separate finer trapezoidal check. Ranking-reversal and short unstable presets are computed from their inputs. `workspace.ts` guards the lazy view and cleanup.

`view.test.ts` checks ranking reversal, refinement, underflow feedback/stale-result removal, ordinary numeric exponent and genuine-zero inspection, preserved prior valid plot, unstable flags, hidden-grouping rejection and fresh reopen state (shared equation mock is not browser evidence). `workspace.test.ts` checks stale import, once-only cleanup and failed-view recovery. Local total **33 tests**; full current worktree suite **473 tests /23 files**, type check and production build pass. These full results precede the added early/late result breakdown; rerun is required for final submission. Existing MathLive chunk warning only. Browser reservation remains deferred under the coordinator's DP03→DP04→DP02 order; no browser control has been used for CF03.

## Finer-tolerance and comparison completion

The selected-integral check now resolves the same model at a **ten-times tighter requested tolerance**, then applies the independent composite trapezoid rule on twice that refined grid. Both rule difference at the refined tolerance and agreement with the original score are reported; no certified exact-error claim is made. This fulfills the finer-tolerance check rather than merely redrawing more points. The supported finest check target is10⁻⁸, with maximum32768 intervals; requesting a check finer than the supported limit returns a useful error.

The revealed early/late breakdown provides numerical reasoning for the ranking fixture. Splitting at5s: A's IAE is approximately3.04717+0.73253, B's2.52269+1.53309; A's larger early error is offset by smaller late area. For ISE the split is A2.11705+0.12584 versus B1.44047+0.47431, so squaring penalizes A's early error enough to favorB. ITAE emphasizes B's late error further. These are finite-horizon contributions, not a claim of an optimal controller.

After these changes, **33 local tests, all473 application tests, TypeScript and production build pass**. Production browser QA, final documentation/PR and submission remain pending. Coordinator's explicit QA order is being respected; no CF03 acquisition has been attempted during it.

## Declared supported domain and numerical limits

- One nonzero constant-numerator strictly proper real plant G(s), denominator degree1 or2. Polynomial coefficients are ascending inside the private parser, but normalized model/characteristic displays use descending powers with leading coefficient1. Normalized coefficient/gain magnitudes at most1000, nonzero g magnitude at least10⁻⁹; original polynomial arithmetic bounded by10⁶ and leading denominator magnitude at least10⁻⁹.
- Proportional C=Kp, or PI (Kp s+Ki)/s. Gain magnitudes at most1000; nonzero Ki magnitude at least10⁻⁹. Ki=0 explicitly selects P with no integral state. The state choice is y for order1, [y,y′] for order2, plus integral I only for PI; y(0)=y′(0)=I(0)=0, r(t)=1 for t≥0. e=r−y and u=Kp e+Ki I in unity negative feedback. No controller derivative, saturation or inferred hidden physical realization.
- Visual decimal polynomials/products/visible parentheses/powers0–2, one fraction or simple parenthesized division, optional G(s)=/C(s)=, outer visible grouping/unary signs, compact TeX arguments and ordinary numeric wrappers. No scientific e/E variable substitution, mixed/nested fractions or standalone hidden algebraic brace groups. Up to512 characters/field,128 tokens/polynomial,16 nested numeric wrappers. Nonzero literal/product underflow rejects. Adjacent numeric wrappers preserve displayed digits instead of inventing multiplication.
- Common H in[.05,50]s. Requested tolerance10⁻⁸…10⁻² (UI choices10⁻³,10⁻⁵,10⁻⁷). RK4 and composite Simpson use at most16384 intervals, and a separate tighter-tolerance/trapezoidal check at most32768. Refinement compares all five costs and aligned e/u values against tolerance×(1+|value|) in their stated numerical units. Initial resolution uses the closed characteristic coefficient scales; a first-order loop pole scales linearly with proportional gain, not its square root. A regression pins the high-gain first-order resource failure. No checked result is returned when refinement/work/magnitude bounds fail; state or control magnitudes above10⁸ reject.
- Hurwitz tests check the complete degree1–3 monic characteristic with scale-aware strict margin10⁻¹⁰; boundary or failed tests do not claim strict stability. A short unstable run remains explicitly a finite-horizon illustration. No optimizer or infinite-horizon optimality claim is provided.
- E is the output/error unit, U the control unit. IAE[E·s], ISE[E²·s], ITAE[E·s²], ITSE[E²·s²], effort[U²·s]. The overlay has distinct e/u axes and line patterns; density shading is a piecewise-linear illustration, while panel totals use Simpson. Plot maxima are sampled approximations; displayed decimals have7 significant digits. Refinement differences are numerical consistency checks, not interval-certified errors.

Source provenance: source atlas/audit inspected, original slides not inspected. Independent expected values use closed first-order formulas and exponential-residue antiderivatives (standard double-precision complex arithmetic, not the production RK4/quadrature). For exponential term z, ∫exp(zt)=(exp(zH)−1)/z and ∫t exp(zt)=((zH−1)exp(zH)+1)/z², with continuous limits atz=0. Quadratic products use pairwise exponent sums. The P baseline has poles−1.5±j√15/2 and error1/3+(2/3)exp(−1.5t)[cos(√15t/2)+(3/√15)sin(√15t/2)]. PI ranking fixtures use E(s)=(s²+3s+2)/[s³+3s²+(2+Kp)s+Ki] and retain the full characteristic in stability checks.

Final parser conditioning check also rejects a nonzero normalized coefficient/controller ratio that underflows to zero, even when its numerator alone is still representable. The regression uses a tiny decimal divided by1,000,000, preserving genuine zero. This strengthens the stated nonzero-underflow guard without changing the mathematical input scope. All473 application tests/type/build pass after the guard.

## Draft PR / pending browser gate

[PR22 — Implement CF03 error criteria and control effort comparison](https://github.com/ckbk123/CSDKTD_APP/pull/22) is attached to this worker chat as a **draft**. No existing PR for this branch was found before creation. It accurately reports 33 local/473 application tests and browser QA pending; the active claim is not a completed submission. Connected GitHub write permission was unavailable (403), so existing local Git authentication created the draft without displaying or saving credentials. The same PR will be updated and marked ready after the browser gate. Earlier DF01 PR16 remains preserved separately.

## Readability checkpoint while QA is occupied

Spaced model/run/bound labels consistently and kept SVGs at their 820-unit design width inside the existing local horizontal scrollers, so narrow layouts retain 12px plot labels rather than shrinking them to about8px. No document-wide sizing or shared styles changed. The native-exponent UI regression expectation was updated for the clearer common-horizon label. `npm run check`, `npm test` (473/473,23 files) and `npm run build` pass after this change; the only build warning is the existing MathLive chunk size. Real-browser evidence remains pending normal shared QA access.
