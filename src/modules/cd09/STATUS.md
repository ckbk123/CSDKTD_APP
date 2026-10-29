# CD09 implementation status

- **Stage:** implemented — accepted bounded exercise, independent mathematical fixtures, production-browser checks and project checks pass. Independent integration review remains pending.
- **Assessed:** 29 October 2026, primary main `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (v0.3.9).
- **Ownership:** `src/modules/cd09/**`, [TASK.md](TASK.md), atlas CD09 and continuous exercise audit D1.
- **Worker chat:** `01a18700-78e9-7a80-af1b-4436e25b10ff`.
- **Branch:** `codex/cd09-observer-01a18700`.
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cd09-observer-01a18700\CSDKTD APP`.
- **PR:** [#30 — CD09 observer design and estimated-state feedback](https://github.com/ckbk123/CSDKTD_APP/pull/30).

## Current source assessment

`index.ts` remains metadata-only. `workspace.ts` now loads the owned `ui.ts` synchronously through an owned loading host/child signal; partial failure aborts resources before showing recovery. Module-owned `math.ts`, `parser.ts`, scoped `style.css` and tests implement the bounded exercise. Existing shared services provide visual equation entry/display and native numeric reading; no shared math/package change was made. Locked dependencies installed with bundled Node24.22.1 (`npm ci`:109 packages,0 vulnerabilities). Primary checkout and8787 were not changed. Previous CD08 PR20/source5886e80 remains submitted in its preserved worktree for asynchronous review.

## Requirement audit

| Accepted requirement | Current state / implementation action |
|---|---|
| Edit model and observer targets | Five shared visual A/B/C and target inputs, bounded local parser; native initial state/estimate/input/noise/time controls use shared numeric reader. Actual fraction, power, matrix and keyboard edits checked. |
| Row-by-row observability | C then CA reveal, normalized-row determinant/rank; changed C=[0,1], rank loss and near-rank loss tested. |
| Derive and check L | Matching equations, nominal actual A−LC/modes/residual, gain prediction and reveal; repeated/conjugate and conditioning/accuracy tests. |
| Estimate from one output | Separate plant/estimate dynamics; only known u and measured scalar drive the estimator. Seven plots, numeric time inspector and signal table distinguish truth, measured/estimated output, innovation, injection, component error and effort. |
| Connect estimated-state feedback | Explicit toggle computes K/N from feedback targets and uses xhat. Complete4/5-mode homogeneous spectrum shown, including filter modes. Known-input experiment remains available; unused controls are disabled. |
| Linear noise/filter experiments | Sinusoidal amplitude/frequency/phase, optional innovation filter, actual three-mode spectrum and unfiltered comparison. Component RMS and effort statistics are sampled, not settling proofs. Independent phasor/DC and unstable-filter fixtures pass. |
| Changed data and failures | Sensor/faster/conjugate/noisy/filtered variations, explicitly authored unstable-filter example and editable initial conditions. Native/visual edits invalidate stale results; zero/underflow/exponent and domain failures tested. Tiny gains stay nonzero and zero predictions fail. |
| Lifecycle and accessible UI | Owned child-abort loading wrapper and partial-failure resource tests; mount-owned state and scoped styles. Keyboard focus survives rerender; Escape preserves visual entry; equations/table scroll locally. Real reset, leave/reopen, fast navigation and 390px viewport pass. |
| Mathematical/project/browser checks | 59 module tests, 719 project tests, type check and build pass. Actual bundled MathLive editing/fonts/keyboard and production-preview behavior checked as recorded below. |

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

## Bounded calculation domain

Real continuous two-state SISO with D=0 and x column. Observer is xhat_dot=A*xhat+B*u+L(y_measured−C*xhat); feedback uses the estimated state, negative sign, held scalar reference. Time seconds; noise frequency rad/s; other units follow supplied model. Target polynomials real/monic/quadratic and strictly Hurwitz. Signed numeric matrix fractions and expanded/factored quadratic targets preserve visual meaning; no general CAS, e/E visual literals, hidden grouping or ambiguous mixed-number/exponent interpretation. The local parser includes the tested MathLive row-whitespace protection from prior CD08; there are no sibling imports.

Current bounds: matrix entries≤1000; target coefficients≤10000, strictly positive; gain≤10⁶; closed two-state entries≤10⁴; normalized-row rank/matching determinant threshold10⁻⁹; each actual two-state coefficient relative error≤10⁻⁹. DC solve uses the same conditioning guard; unavailable/poor/excessive prefilter returns no supported N while preserving K. Cubic roots use scale-normalized analytic formulas plus relative polynomial residual10⁻⁹ and coefficient/multiplicity backward check10⁻⁸. Cubic coefficients≤10¹⁵. Error-mode classification uses real-part tolerance10⁻⁹ times max(1,mode magnitude). Pole underflow rejects explicitly.

Initial states/estimates, held input/reference and noise controls have magnitude≤100; amplitude/frequency nonnegative. Tau is0 or.001–10s; horizon.1–50s; sample count2–1001 (UI401). An augmented7/8-state exponential propagates the plant, observer, optional filter, sinusoidal source and held input. Taylor≤24 terms at reduced norm≤.5, term tolerance10⁻¹⁶, scaling≤30. Response values≤10⁸; modal/noise resolution receives a sampling flag. RMS estimation error is returned separately for each state, avoiding addition of unlike physical units.

## Verification — 29 October 2026

Bundled Node24.22.1 with its executable prefixed on PATH and the installed npm CLI: `node node_modules/vitest/vitest.mjs run src/modules/cd09` passes 59 tests (48 math/parser, 7 mocked UI, 4 loader); `npm run check` / `tsc --noEmit` passes. `npm test` passes 719 tests in 29 files; `npm run build` passes including type check (existing MathLive chunk warning only). `git diff --check` passes. The final delivery commit is checked again before exact-HEAD submission; mocked editors are supplemented by the actual browser checks below.

The private in-app browser inventory identifies this chat's `codexSessionId=01a18700-78e9-7a80-af1b-4436e25b10ff`; only this worker's tab/production preview on port8998 was used. Current primary guidance permits parallel verified private contexts without the global QA reservation. No shared reservation is held. Desktop1280×720 and narrow390×844 were checked in the displayed system-dark theme; light-theme emulation was not separately performed. No unsupported Firefox route was repeated. Browser console error/warning log was empty at completion.

- Course baseline: observability rows and rank2; predicted L=[10;10] accepted; actual A−LC and both modes−7,−6 displayed. At t1, truth=[.6004236;−.4650883], estimate=[.6042123;−.4462859], error=[−.003788729;−.01880244], matching the independent trajectories.
- Changed sensor: C=[0,1] gives L=[−20;10], actual A−LC=[[0,21],[−2,−13]], still observable. Connecting this velocity output reports zero DC tracking gain and the explicit N1 fallback without a unity-tracking claim.
- Connected baseline feedback: K=[6,3],N8 and all four modes−4,−2,−7,−6. With tau.1 and sinusoidal noise.05 at omega20, all three actual error/filter modes and five combined modes appear; component RMS and effort compare current/unfiltered samples.
- Actual visual entry: selected C's numeric cell, entered signed fraction−1/2 through the fraction button, and obtained L=[−20;−20]; rebuilt s²+13s+42 using ordinary keys and the power button. Edited A(1,2)=2 and obtained L=[10;4]. Edited B=[0;0]: observer-only remains valid, feedback reports controllability rank loss. C=[0,0] reports observability rank loss. Systems keyboard inserted an actual symbol; Escape closed it without switching the editor into LaTeX entry.
- Native controls: changed independent truth/estimate initial conditions and held input preserve the correct t0 errors/output/innovation; nonzero underflow1e−999 is rejected, intentional0e−999 and frequency1e−2 accepted. Tau.0001, horizon0, empty visual target and visual e/E notation reject with clear feedback. Frequency100/horizon50 reports coarse sampling.
- Authored unstable-filter variation: A=diag(1,2), B=C transpose=[1;1], nominal observer−6,−7, controller−2,−4, tau1. Displayed error polynomial s³−2s²+15s+42 and modes−1.882611,1.941305±4.3059j show instability despite stable nominal poles. At t3 the current error grows while the unfiltered comparison is about10⁻⁷. Horizon50 hits the declared10⁸ response limit and clears stale results. This variation is labeled authored, not claimed as inspected course evidence.
- Reset with modified data and an open math keyboard returns baseline inputs, blank prediction, no revealed plots, all keyboards closed. Leaving with a keyboard open removes old fields; rapid CD09/CD08 navigation leaves no late observer DOM. Reopening starts fresh. CD08 remains a scaffold in this preserved base; the separate submitted CD08 branch was not merged into this contribution.
- Narrow layout: document client/scroll width375/375, seven responsive plots, locally scrolling equations and keyboard-focusable numeric table. ArrowRight scrolls the table; time inspection with Enter retains focus and correct sample values. Axis labels enlarged on narrow screens and visually rechecked after the final build. Bundled math fonts loaded. Viewport override was reset to desktop1280×720 afterward.

Actual screenshot evidence outside Git (not generated build artifacts):
- `C:\Users\baokh\.codex\visualizations\2026\10\29\01a18700-78e9-7a80-af1b-4436e25b10ff\cd09-browser.jpg` — final desktop baseline.
- `C:\Users\baokh\.codex\visualizations\2026\10\29\01a18700-78e9-7a80-af1b-4436e25b10ff\cd09-narrow.jpg` — final390px baseline after axis-label repair.
- `C:\Users\baokh\.codex\visualizations\2026\10\29\01a18700-78e9-7a80-af1b-4436e25b10ff\cd09-unstable-filter.jpg` — authored unstable filter and unfiltered comparison.

## Remaining delivery/review work

No accepted exercise requirement or shared dependency remains deferred. This delivery record belongs to PR #30; the claim/PR record the exact tested final commit including this URL. Independent coordinator review and integration remain separate; this record does not claim `verified` status or a release. Preserve the branch/worktree for requested corrections. The contribution preview and temporary browser tab are closed after verification; primary8787 is preserved.

## Prepared coordinator integration and spacing repair — 29 October 2026

Frozen source `2a490bad144b9392cc0aff244fe74fcc3614e16d` is merged with preserved history. Independent review checked observer coefficient matching, observability and dual feedback placement, estimated-state rather than truth feedback, deterministic noise forcing, filter initial conditions, actual added filter modes and N=1 fallback disclosure. New hand-derived fixtures use diagonal A with L=(6,-2) and single-mode error (-3,2)exp(-3t); changed B=(0,2) gives K=(4,2), N=5, exact step/effort curves, and tau=.2 gives actual filter polynomial s^3+8s^2+67s+210. Rank-loss and declared limits remain honest.

The coordinator-authorized repair for the draft PR's known spacing defect installs shared argument preflight before lexical erasure. Scalar, matrix and target regressions reject malformed command/Unicode/nested-delimiter arguments while preserving boxed fractions and real matrix row separators. The UI already uses shared native input. The child wrapper retains partial-failure/standalone-resource tests and now checks reentrant late release with guaranteed host cleanup. 68 module tests, TypeScript and diff checks pass. Stage remains implemented; root owns final browser/combined acceptance and PR disposition. No new worker browser evidence is claimed.

## Coordinator true-state propagation correction — 30 October 2026

Before publication the coordinator supplied A=[[0,1],[-1,8.125]],C=[1,0],observer target s^2+5s+6,B=0,x0=xhat0=[1.1,.1375],H=5,count201. Previous truth and estimate both ended near[-.4570564,-19.8401318], with apparent estimation error about10^-12; exact truth is exp(5/8)*x0≈[2.0550705532,.2568838191]. Agreement between two corrupted trajectories is not observer verification.

The visit-local screen now tracks initial/local floating error, the full-step versus two-half-step transition defect and propagated state uncertainty. It convolves local errors with signed transition powers before taking absolute bounds. Cached binary products carry power-rounding radii; iterating |F| alone would falsely invent unstable growth for an ordinary stable rotation. No shared API or cross-module import is used. States qualify against10^-7*max(1,|coordinate|); differences qualify at the scale of their two states, not by claiming relative accuracy in an arbitrarily tiny error. This is a conservative floating-point screen, not a formal interval proof or a guarantee of relative accuracy for canceling scalar output/effort. A failed allowance throws before any observer trajectory is returned or rendered. The visible scope discloses the convention; no mode/input is clipped or removed.

New regressions reject the supplied failure and verify the independently known slow eigenmode over H=1, genuine exp(8t) fast-mode growth, stable signed-rotation allowance and80rad/s deterministic noise with/without filtering. A mocked UI test confirms useful feedback, no stale plots and baseline recovery. Existing ordinary/noisy/filtered/feedback tests pass. The authored unstable-filter+feedback illustration now defaults to H=2 instead of3: the longer requested trace exceeds this conservative allowance, while the shorter visit retains all five homogeneous modes and the same unstable-filter lesson. Manual horizon/model bounds remain unchanged; students can request the longer horizon and receive numerical-conditioning feedback. Root must inspect this affected preset during its actual-browser gate; prior H=3 screenshots are historical evidence only.

75 CD09 tests pass,100 CR06 tests pass, combined175/type/diff pass. Root owns independent review and combined/browser acceptance; stage remains implemented. No new worker or browser run is claimed.
