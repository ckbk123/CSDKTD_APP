# CD09 implementation status

- **Stage:** in-progress — ownership, source audit and independent fixture derivation recorded; the workspace is still the original blank scaffold.
- **Assessed:** 29 October 2026, primary main `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (v0.3.9).
- **Ownership:** `src/modules/cd09/**`, [TASK.md](TASK.md), atlas CD09 and continuous exercise audit D1.
- **Worker chat:** `01a18700-78e9-7a80-af1b-4436e25b10ff`.
- **Branch:** `codex/cd09-observer-01a18700`.
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cd09-observer-01a18700\CSDKTD APP`.
- **PR:** not created; no implementation completion is claimed.

## Current source assessment

`index.ts` is metadata-only and preserves the accepted baseline. `workspace.ts` is blank. There are no module computations, exercise controls or local tests. Existing shared services provide visual equation entry/display and native numeric reading; `src/shared/math/README.md` does not supply a numerical toolbox. Locked dependencies installed successfully with bundled Node24.22.1 (`npm ci`:109 packages,0 vulnerabilities). Primary checkout and8787 were not changed. Previous CD08 PR20/source5886e80 remains submitted in its preserved worktree for asynchronous review.

## Requirement audit and next work

| Accepted requirement | Current state / implementation action |
|---|---|
| Edit model and observer targets | Missing. Use shared visual A2×2,B2×1,C1×2 and real monic quadratic target inputs, with a bounded local parser; native initial states/estimate/input/noise controls use shared numeric reader. |
| Row-by-row observability | Missing. Construct C then CA, normalized-row determinant/rank, declared tolerance; test changed C=[0,1] and actual rank loss. |
| Derive and check L | Missing. Match trace/determinant coefficients, offer gain prediction/reveal, show actual A−LC and both modes, including repeated/conjugate targets and conditioning failures. |
| Estimate from one output | Missing. Simulate plant and estimate separately; estimator receives only known u and measured scalar y. Label simulated state truth separately from measured/estimated output. Plot states/estimates, innovation and estimation error with a numeric sample inspector. |
| Connect estimated-state feedback | Missing. Add u=−K xhat+Nr, compute/check the controller pair from an explicit target polynomial, and report all combined plant/estimator modes rather than one selected pair. Keep a known-input observer-only experiment. |
| Linear noise/filter experiments | Missing. Bounded deterministic sinusoidal measurement disturbance with amplitude/frequency/phase. An explicitly declared first-order innovation filter will add a state; compute its actual error modes and explain that filtering changes the nominal observer dynamics. Compare with the unfiltered design. No nonlinear hardware or stochastic/Kalman claims. |
| Changed data and failures | Missing. Sensor/target/initial-estimate/input/noise changes must recompute; empty/malformed/nonfinite/rank/conditioning/resource failures hide stale answers. Preserve small nonzero coefficients. |
| Lifecycle and accessible UI | Missing. Synchronous lazy wrapper with owned loading host/child signal, partial-failure cleanup, mount-owned state, scoped styles, keyboard/numeric alternatives, local equation/table scrolling and fresh reset/reopen. |
| Mathematical/project/browser checks | Missing. Independent fixtures below plus changed/noisy/filtered/failure cases, then module/type/full/build checks and actual private IAB editing/reset/reopen/rapid navigation/font/keyboard/narrow tests. |

## Independent fixture derivation (not yet implemented or tested)

Original decks were not reinspected. TASK/atlas cite Ch6:83–93; S11:6–11,13–14; E08. The continuous audit D1 records that the changed velocity sensor remains observable. The following calculations are independent fixtures from the supplied matrices, not newly claimed slide inspections.

For A=[[0,1],[−2,−3]], C=[1,0], desired q_o=s²+13s+42:
- O=[C;CA]=[[1,0],[0,1]], rank2.
- C L=tr(A)+13=10, C adj(A)L=det(A)−42=−40. Thus l₁=10 and−3l₁−l₂=−40, so L=[10;10].
- A−LC=[[-10,1],[−12,−3]] has trace−13, determinant42 and eigenvalues−6,−7.
- With e=x−xhat and e(0)=[1,0], noiseless e₁=−3e^(−6t)+4e^(−7t), e₂=−12e^(−6t)+12e^(−7t).
- With u=0,x(0)=[1,0], plant truth x₁=2e^(−t)−e^(−2t), x₂=−2e^(−t)+2e^(−2t); estimate must equal x−e.

Changed C=[0,1] gives O=[[0,1],[−2,−3]], determinant2. Matching gives L=[−20;10]; actual A−LC=[[0,21],[−2,−13]], still−6,−7. It must not be labeled unobservable merely because the sensor changes.

The baseline feedback targets−2,−4 give K=[6,3],N8. Without filtering/noise, combined coordinates[x;e] have block-triangular dynamics [[A−BK,BK],[0,A−LC]], hence all four modes−2,−4,−6,−7. Simulation must still implement the plant and estimate equations using only measured y in the estimator, then derive e for display.

Proposed linear filter convention (an authored extension within the TASK's noise/filter experiment): tau*nu_dot=(y_measured−C*xhat)−nu and xhat_dot=A*xhat+B*u+L*nu. At tau=0 this is the standard observer. At tau>0, error/filter dynamics are [[A,−L],[C/tau,−1/tau]] with three actual modes. The matching identities give its polynomial s³+(1/tau−trA)s²+(detA+d1/tau)s+d0/tau. Baseline tau=.1 gives s³+13s²+132s+420, not the original pair alone. Check the actual matrix coefficients independently and label this filter-induced change explicitly. Initialize the filter from measured innovation at t0, with independent plant and estimate initial states.

## Planned bounded domain and recovery

Real continuous two-state SISO with D=0 and x column. Observer is xhat_dot=A*xhat+B*u+L(y_measured−C*xhat); feedback uses the estimated state, negative sign, held scalar reference. Time seconds; noise frequency rad/s; other units follow supplied model. Target polynomials real/monic/quadratic and strictly Hurwitz. Support signed numeric matrix fractions and expanded/factored quadratic targets with visual meaning preserved; no general CAS, e/E visual literals, hidden grouping or ambiguous mixed-number/exponent interpretation. Matrix/numeric/iteration/conditioning bounds will be frozen with tests before claims of support.

Next: implement pure bounded matrix/design/simulation helpers and independent fixtures; then the full guided UI, changed-data experiments and actual browser proof. No shared API/package change is currently required. Private per-chat IAB testing is authorized after inventory identity verification; the earlier global queue is not required for this verified chat context. Do not repeat the unsupported Firefox control route.
