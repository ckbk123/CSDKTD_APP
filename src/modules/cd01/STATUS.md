# CD01 implementation status

- **Stage:** in-progress — bounded models/parser/UI implemented;68 local tests/type/build pass; prior725 combined tests pass. Substantial browser math/editor checks pass; lifecycle/narrow/final delivery remain.
- **Assessed:** 29 October 2026; primary base `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (v0.3.9).
- **Ownership:** `src/modules/cd01/**`; [TASK.md](TASK.md), atlas CD01 and continuous exercise audit controller-design section.
- **Worker chat:** `01a18700-78e9-7a80-af1b-4436e25b10ff`.
- **Branch:** `codex/cd01-linear-pid-01a18700`.
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cd01-linear-pid-01a18700\CSDKTD APP`.
- **PR:** not created.

## Source/ownership assessment

Primary CD01 folder was clean and unclaimed; index was metadata-only, workspace blank, no local tests. Claimed atomically and created a fresh isolated worktree/branch at the current committed primary base. Locked dependencies installed with bundled Node24.22.1:109 packages,0 vulnerabilities. No shared solver/helper exists beyond equation UI and native numeric reading. Original slides were not reinspected; TASK/atlas course comparison is the accepted fixture, and independently authored checks below are not extra slide-transcription claims.

Earlier contributions remain separate: CD08 PR20 resubmitted at203b985 after targeted review; DD07 PR35 submitted at899723d; CD09 PR30 is frozen/draft with an inherited spacing-argument review hold awaiting coordinator reopening. No earlier contribution is merged into this branch. Review returns take priority.

## Accepted requirement audit

| Accepted requirement | Current assessment / action |
|---|---|
| Requirement → controller structure | Error/overshoot/observed-window/effort requirements, P/PI/filtered PD/PID choice, DC/initial-effort prediction, structure cues and full-model requirement assessment. |
| Gain/filter controls and individual terms | Shared visual second-order plant and monic target inputs, native gains/filter/initial data; parallel/standard conversion and separate P/I/D effort. Inactive derivatives never show0/0. |
| Analytic coefficient matching | Typeset coefficient identities/solved gain formulas, fixed-coefficient compatibility check, optional Tf draft from target, actual desired/coefficient comparison and every mode. |
| Actual output/effort and course comparison | Full active state model plus independent P/PI/PID comparisons, four computed plots, numeric time inspector and metric/sample tables. Filter and plant modes retained; unavailable comparisons get separate feedback without discarding selected model. |
| Reason before each change | Draft edits apply only after a student selects a reason; eight bounded temporary trial reasons/results per visit. Course baseline is explicitly app-authored initial state. Reset/reopen clears notes; no persistence. |
| Meaningful checks and limits | Analytic and independent SciPy fixtures, parser semantics, changed data, inactive modes, fixed-order failures and native underflow tested. Actual fonts/keyboard/horizon feedback still need browser checks. |
| UI/lifecycle/project/browser | Shared equations/native numeric reader, scoped locally scrolling plots/tables, owned child-signal wrapper and partial-failure cleanup tests.65 local tests/type pass; project/build/browser QA pending. |

## Mathematical design and independent fixtures to verify

Bounded planned plant: real strictly proper `G(s)=b/(s²+a1*s+a0)`, with nonzero b, negative unity feedback, constant step reference, continuous seconds. No delays/hardware/nonlinearities. Controller is parallel `C=Kp+Ki/s+Kd*s/(Tf*s+1)` with explicit term activation P/PI/filtered PD/PID. Derivative is on error; the finite filtered kick and units must be shown. When Kp≠0, equivalent standard notation uses Ti=Kp/Ki and Td=Kd/Kp (inactive integral has no Ti); Kp=0 needs no fabricated standard conversion.

For selected nonzero active terms, unreduced characteristic polynomials in descending powers follow directly from the loop:
- P: s²+a1*s+(a0+b*Kp).
- PI: s³+a1*s²+(a0+b*Kp)*s+b*Ki.
- Filtered PD: Tf*s³+(1+a1*Tf)*s²+(a1+a0*Tf+b*Kp*Tf+b*Kd)*s+(a0+b*Kp).
- Filtered PID: Tf*s⁴+(1+a1*Tf)*s³+(a1+a0*Tf+b*Kp*Tf+b*Kd)*s²+(a0+b*Kp+b*Ki*Tf)*s+b*Ki.

At b1,a1=3,a0=2,Kp4,Ki2,Kd1,Tf.05: P polynomial s²+3s+6; PI s³+3s²+6s+2; filtered PID monic s⁴+23s³+86s²+122s+40. Stable P has y∞=2/3 for unit reference, e∞=1/3; stable PI/PID have e∞0. These equalities do not imply faster settling. All relevant controller/plant modes and actual response must be checked.

Matching constraints: P's linear coefficient is fixed at a1; PI's quadratic coefficient is fixed at a1. With fixed Tf, filtered PD/PID next-leading monic coefficient is fixed at a1+1/Tf. Solve the remaining linear equations for gains and independently verify the resulting coefficients/modes; inconsistent targets get feedback, not plausible gains. A zero gain removes its inactive controller term/state and may reduce actual order; never hide a retained plant mode through transfer cancellation.

Independent analytic authored fixture: b1,a1=3,a0=2,PI Kp1,Ki1 gives full characteristic (s+1)^3 while output transfer is1/(s+1)^2. From zero initial states/unit step, y=1−(1+t)exp(−t),u=2−exp(−t). This tests the full realization plus a cancelled output factor without dropping its internal mode.

Plan: bounded degree≤4 root verification, augmented-state numerical exponential response, explicit sampled overshoot/effort and finite-window settling feedback; analytic stable DC error separate from finite-horizon measures. Resource and conditioning thresholds must be fixed/tested in code before delivery. This record is an early recovery checkpoint, not a solver success claim.

## Mathematical checkpoint

Owned `math.ts`/`numerics.ts` now implement the four structures, inactive-term/state removal, actual state-matrix characteristic check, complete degree≤4 analytic roots with normalized residual/Vieta verification, stable DC error, coefficient matching/constraints, standard-form conversion and an augmented-state step response. Final-value overshoot/window and command-tracking band are distinct, so P's nonzero tracking error is not mislabeled as a missing transient settling window. Sampled measures remain finite-horizon observations. No parser/UI exists yet; the workspace remains the untouched scaffold at this checkpoint.

Node24.22.1: `node node_modules/vitest/vitest.mjs run src/modules/cd01/math.test.ts` passes22 tests; `node node_modules/typescript/bin/tsc --noEmit` passes. Fixtures cover four real roots, two conjugate pairs, repeated multiplicities, zero/RHP/imaginary-axis roots, singular-matrix exponential, all course characteristic polynomials, analytic P response and cancelled-mode PI response, fixed-coefficient matching failures, changed numerator invariance, controller term contributions and range/growth/horizon failures. Repeated triple/quartic tests allow2×10⁻⁴ root error because multiple roots are sensitive; polynomial and complete coefficient residual checks remain separate.

Independent bundled NumPy2.3.5/SciPy1.18.1 check used manually specified output TFs P4/[1,3,6],PI[4,2]/[1,3,6,2],PID[1.2,4.1,2]/[.05,1.15,4.3,6.1,2]. Effort numerators multiply each output numerator by[1,3,2], retaining direct feedthrough. `scipy.signal.tf2ss` plus `scipy.linalg.expm` at t0,1,5,20 gives PID output[0,.7232639601893959,.971128782713998,.9999700109233961] and effort[24,1.8964989138990447,1.9759366374534828,1.9999749340840935]; independent P/PI values are recorded in tests. This is numerical reference evidence, not an added application dependency.

Current implemented bounds: plant |b| from10⁻⁶ to100,|a0/a1|≤100; gains magnitude≤100; active Tf.001–10s; closed state/input entries≤10⁶; monic polynomial coefficients≤10¹²; degree1–4 roots require relative normalized residual10⁻⁹ and complete Vieta check10⁻⁸. Actual matrix/formula coefficient discrepancy≤10⁻⁹. Stability uses real-part tolerance10⁻⁸ times max(1,mode magnitude). Initial states/reference magnitude≤100,horizon.1–100s,2–1001samples (default801),response≤10⁸. Exponential order≤5,30 scaling steps,24 Taylor terms,reduced norm≤.5,term threshold10⁻¹⁶. Coarse mode sampling is flagged. These bounds still need UI disclosure, parser tests and real-browser checks before delivery.

## Guided UI/parser checkpoint

Owned parser and UI now disclose these bounds and support degree≤4 real polynomial arithmetic and one constant-over-quadratic plant, signed/nested/compact numeric fractions and normalized nonmonic plant denominators. Explicit TeX spacing arguments are checked before normalization; mixed adjacency, hidden grouping, e/E, unsupported powers/0⁰, plant zeros/delays and wrong degree reject. Targets/plant are shared visual fields; all native numbers use the shared reader. Inactive controller states are omitted explicitly while every plant mode remains. Stable DC error, command overshoot/tracking band and final-value overshoot/window are distinct.

`node node_modules/vitest/vitest.mjs run src/modules/cd01` now passes65 tests (22 mathematical,31 parser,8 mocked UI,4 loader); type check passes. Tests include reason gating/notes/reset isolation, coefficient derivation, actual target/effort checks, Kp0 standard-form feedback, changed controller memories and native underflow. Mathematical/SciPy evidence above remains. Workspace uses an owned synchronous loading host and child abort signal; partial-failure listeners are aborted before recovery. Actual MathLive fonts/entry/keyboard, narrow layout, reset/navigation, combined tests/build and final PR/delivery remain pending; no implementation completion is claimed yet.

## Production-browser checkpoint

Own verified private IAB inventory matched chat01a18700-78e9-7a80-af1b-4436e25b10ff and had no other tabs; own preview9001 used. Baseline actual four modes, parallel/standard parameters(Ti2,Td.25,Tf.05), DC error0, initial effort24 and sample t1 output.723264/effort1.896499 match independent fixtures. Course P has steady error.3333333, final-value overshoot8.773022%,observed2%window2.45s; PI0error/window6.075s/peak4.137828; PID0error/window5.825s/peak24. No permanent-settling claim. Real reason gating blocks unreasoned Apply and appends selected reasons on success; native nonzero underflow rejects, intentional zero recovers with honest Kp0 standard-form feedback.

Actual visual fraction-button entry changed G to2/((s+1)(s+2)), yielding full monic polynomial[1,23,110,204,80]. Actual target power-button entry(s+1)^3 plus PI matching gives Kp=Ki1 and all three modes−1; changing to(s+2)^3 rejects the fixed coefficient. Authored PID target(s+17)(s+2)^3 gives Kp8.26,Ki6.8,Kd2.187,all four numerical modes and initial effort52,so the effort limit30 fails even though the observed window meets4s. Repeated roots are explicitly labeled numerically sensitive.

A separately authored unstable plant entered as1/(s(s−1)−1),Kd4 with the baseline other gains,horizon100 yields[1,19,63,62,40],stable selected modes−15.0843,−2.865647,−.5250253±.8060468j. P/PI comparison growth hits10⁸ and reports unavailable without discarding selected output. Coarse-sampling warning appears. During entry an unintended denominator-only power left later terms outside the fraction; the parser correctly rejected the unsupported plant. This was repaired through visible parentheses before the successful trial. Screenshot outside Git: `C:\Users\baokh\.codex\visualizations\2026\10\29\01a18700-78e9-7a80-af1b-4436e25b10ff\cd01-unstable-plant.jpg`.

Current local checks:68 tests (24 math,31 parser,9 mocked UI,4 loader) and type/build pass. A last comparison-failure regression and zero-start window correction followed the earlier725-project-test run; rerun the combined suite at final delivery. Keyboard/reset/reopen/fast-navigation/narrow/console evidence and final screenshots/PR/claim submission remain pending. Preview9001 and own temporary QA tab are currently active.
