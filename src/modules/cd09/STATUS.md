# CD09 implementation status

- **Stage:** in-progress — full guided UI and calculations implemented;59 module/719 project tests and type/build pass; actual browser QA pending.
- **Assessed:** 29 October 2026, primary main `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (v0.3.9).
- **Ownership:** `src/modules/cd09/**`, [TASK.md](TASK.md), atlas CD09 and continuous exercise audit D1.
- **Worker chat:** `01a18700-78e9-7a80-af1b-4436e25b10ff`.
- **Branch:** `codex/cd09-observer-01a18700`.
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cd09-observer-01a18700\CSDKTD APP`.
- **PR:** not created; no implementation completion is claimed.

## Current source assessment

`index.ts` remains metadata-only. `workspace.ts` now loads the owned `ui.ts` synchronously through an owned loading host/child signal; partial failure aborts resources before showing recovery. Module-owned `math.ts`, `parser.ts`, scoped `style.css` and tests implement the bounded exercise. Existing shared services provide visual equation entry/display and native numeric reading; no shared math/package change was made. Locked dependencies installed with bundled Node24.22.1 (`npm ci`:109 packages,0 vulnerabilities). Primary checkout and8787 were not changed. Previous CD08 PR20/source5886e80 remains submitted in its preserved worktree for asynchronous review.

## Requirement audit and next work

| Accepted requirement | Current state / implementation action |
|---|---|
| Edit model and observer targets | Five shared visual A/B/C and target inputs, bounded local parser; native initial state/estimate/input/noise/time controls use shared numeric reader. Actual editor QA pending. |
| Row-by-row observability | C then CA reveal, normalized-row determinant/rank; changed C=[0,1], rank loss and near-rank loss tested. |
| Derive and check L | Matching equations, nominal actual A−LC/modes/residual, gain prediction and reveal; repeated/conjugate and conditioning/accuracy tests. |
| Estimate from one output | Separate plant/estimate dynamics; only known u and measured scalar drive the estimator. Seven plots, numeric time inspector and signal table distinguish truth, measured/estimated output, innovation, injection, component error and effort. |
| Connect estimated-state feedback | Explicit toggle computes K/N from feedback targets and uses xhat. Complete4/5-mode homogeneous spectrum shown, including filter modes. Known-input experiment remains available; unused controls are disabled. |
| Linear noise/filter experiments | Sinusoidal amplitude/frequency/phase, optional innovation filter, actual three-mode spectrum and unfiltered comparison. Component RMS and effort statistics are sampled, not settling proofs. Independent phasor/DC and unstable-filter fixtures pass. |
| Changed data and failures | Sensor/faster/conjugate/noisy/filtered variations and editable initial conditions. Native/visual edits invalidate stale results; zero/underflow/exponent and domain failures tested. Tiny gains stay nonzero and zero predictions fail. |
| Lifecycle and accessible UI | Owned child-abort loading wrapper and partial-failure resource tests; mount-owned state and scoped styles. Keyboard focus survives rerender; Escape preserves visual entry; equations/table scroll locally. Real reset/navigation/narrow checks pending. |
| Mathematical/project/browser checks |59 module tests,719 project tests/type/build pass. Browser editing, fonts, symbol keyboard, reset/reopen/rapid navigation and narrow QA remain mandatory. |

## Independent fixtures now covered by tests

Original decks were not reinspected. TASK/atlas cite Ch6:83–93; S11:6–11,13–14; E08. The continuous audit D1 records that the changed velocity sensor remains observable. The following calculations are independent fixtures from the supplied matrices, not newly claimed slide inspections.

For A=[[0,1],[−2,−3]], C=[1,0], desired q_o=s²+13s+42:
- O=[C;CA]=[[1,0],[0,1]], rank2.
- C L=tr(A)+13=10, C adj(A)L=det(A)−42=−40. Thus l₁=10 and−3l₁−l₂=−40, so L=[10;10].
- A−LC=[[-10,1],[−12,−3]] has trace−13, determinant42 and eigenvalues−6,−7.
- With e=x−xhat and e(0)=[1,0], noiseless e₁=−3e^(−6t)+4e^(−7t), e₂=−12e^(−6t)+12e^(−7t).
- With u=0,x(0)=[1,0], plant truth x₁=2e^(−t)−e^(−2t), x₂=−2e^(−t)+2e^(−2t); estimate must equal x−e.

Changed C=[0,1] gives O=[[0,1],[−2,−3]], determinant2. Matching gives L=[−20;10]; actual A−LC=[[0,21],[−2,−13]], still−6,−7. It must not be labeled unobservable merely because the sensor changes.

The baseline feedback targets−2,−4 give K=[6,3],N8. Without filtering/noise, combined coordinates[x;e] have block-triangular dynamics [[A−BK,BK],[0,A−LC]], hence all four modes−2,−4,−6,−7. Simulation implements separate plant/estimate equations using only measured y in the estimator, then derives e for display. Independent true/estimated trajectories and state-coordinate invariance are tested.

Proposed linear filter convention (an authored extension within the TASK's noise/filter experiment): tau*nu_dot=(y_measured−C*xhat)−nu and xhat_dot=A*xhat+B*u+L*nu. At tau=0 this is the standard observer. At tau>0, error/filter dynamics are [[A,−L],[C/tau,−1/tau]] with three actual modes. The matching identities give its polynomial s³+(1/tau−trA)s²+(detA+d1/tau)s+d0/tau. Baseline tau=.1 gives s³+13s²+132s+420, not the original pair alone. Check the actual matrix coefficients independently and label this filter-induced change explicitly. Initialize the filter from measured innovation at t0, with independent plant and estimate initial states.

Additional independent fixtures: A=[[1,2],[3,4]],C=[1,2],target[4,5] gives L=[3.5;2.75]; noisy baseline steady transfer at omega1 is [(40+10j);(−20+10j)]/(41+13j), while tau.1 gives [(400+100j);(−200+100j)]/(407+131j). A=diag(1,2),C=[1,1],L=[−56;72],tau1 gives actual error polynomial s³−2s²+15s+42 and unstable error modes despite stable nominal observer poles. Tiny observer gains10⁻¹⁴ and response≈10⁻¹⁵ remain nonzero. A poorly conditioned DC solve retains checked K with no supported prefilter.

## Bounded calculation domain and remaining work

Real continuous two-state SISO with D=0 and x column. Observer is xhat_dot=A*xhat+B*u+L(y_measured−C*xhat); feedback uses the estimated state, negative sign, held scalar reference. Time seconds; noise frequency rad/s; other units follow supplied model. Target polynomials real/monic/quadratic and strictly Hurwitz. Signed numeric matrix fractions and expanded/factored quadratic targets preserve visual meaning; no general CAS, e/E visual literals, hidden grouping or ambiguous mixed-number/exponent interpretation. The local parser includes the tested MathLive row-whitespace protection from prior CD08; there are no sibling imports.

Current bounds: matrix entries≤1000; target coefficients≤10000, strictly positive; gain≤10⁶; closed two-state entries≤10⁴; normalized-row rank/matching determinant threshold10⁻⁹; each actual two-state coefficient relative error≤10⁻⁹. DC solve uses the same conditioning guard; unavailable/poor/excessive prefilter returns no supported N while preserving K. Cubic roots use scale-normalized analytic formulas plus relative polynomial residual10⁻⁹ and coefficient/multiplicity backward check10⁻⁸. Cubic coefficients≤10¹⁵. Error-mode classification uses real-part tolerance10⁻⁹ times max(1,mode magnitude). Pole underflow rejects explicitly.

Initial states/estimates, held input/reference and noise controls have magnitude≤100; amplitude/frequency nonnegative. Tau is0 or.001–10s; horizon.1–50s; sample count2–1001 (planned UI401). An augmented7/8-state exponential propagates the plant, observer, optional filter, sinusoidal source and held input. Taylor≤24 terms at reduced norm≤.5, term tolerance10⁻¹⁶, scaling≤30. Response values≤10⁸; modal/noise resolution receives a sampling flag. RMS estimation error is returned separately for each state, avoiding addition of unlike physical units.

Bundled Node24.22.1: `node node_modules/vitest/vitest.mjs run src/modules/cd09` passes59 tests (48 math/parser,7 mocked UI,4 loader); `node node_modules/typescript/bin/tsc --noEmit` passes. `npm test` passes719 tests in29 files; `npm run build` passes including type check (existing MathLive chunk warning only). The initial syntax precedence error and overly exact complex-root test were corrected before this checkpoint. Mocked editors do not prove MathLive browser behavior; all actual browser checks remain pending.

Next: complete actual browser proof and any repairs, record evidence, then final exact-HEAD combined checks and one PR/submission. No shared API/package change is required. Private per-chat IAB testing is authorized after inventory identity verification; the earlier global queue is not required for this verified chat context. Do not repeat the unsupported Firefox control route.
