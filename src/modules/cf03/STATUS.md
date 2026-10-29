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
