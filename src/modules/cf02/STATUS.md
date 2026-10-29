# CF02 implementation status

- **Stage:** in-progress
- **Assessed:** 2026-10-29, fresh primary-main baseline `0b199d44b5a83d2c4fbf08e3e7c8dec1117da31d` (v0.3.3).
- **Worker chat:** `01a186d1-f1f0-7393-88e7-377fbac7299a` (host `local`).
- **Ownership:** `src/modules/cf02/**`; [TASK](TASK.md).
- **Branch/worktree:** `codex/cf02-steady-state-7393`; `C:\Users\baokh\.codex\worktrees\cf02-steady-state-7393\CSDKTD APP`.
- **PR:** not created yet. Prior DS01 PR #10 is submitted and preserved for coordinator review; corrections take priority.

## Audit before implementation

Current `workspace.ts` is an empty synchronous mount; `index.ts` is the correct lazy metadata. There are no local helpers or tests. The shell equation preview is not a solver.

| Accepted requirement | Existing evidence | Work to deliver |
|---|---|---|
| Step/ramp/parabolic limits and type/error constants | Absent | Editable bounded forward-path family; type and Kp/Kv/Ka from low-frequency powers; selected input A*t^q/q! |
| Derive E/R before table lookup | Absent | Explicit negative-feedback signal equations and computed selected-channel numerator/denominator before interpreting constants |
| Scalar reference/disturbance/sensor effects | Absent | Choose one excitation at a time, all others zero; disturbance at plant input and sensor noise after H; derive both comparator and physical error |
| Nonunity H distinction | Absent | e_c=r-Hy-n versus e_t=r-y; show why reference type tables do not directly give physical tracking error when H differs from 1 |
| Verify final-value conditions | Absent | Low-order closed-loop coefficient/Hurwitz certificate; refuse an unsupported finite-limit claim for unstable/boundary loops; distinguish polynomial error growth |
| Compare prediction and trace | Absent | Prediction/reveal, analytical limit/growth derivation and independent time-response trace with horizon/truncation feedback |
| Changed baseline and failure cases | Absent | Unit-step zero error and unit-ramp .5; changed gain, nonunity sensor, stable type-2 and unstable variants; parser/resource/native-number tests |
| Visual entry and lifecycle | Scaffold only | Shared visual equation inputs/display, local drafts/parser, abort-safe deferred equation loading and cleanup |
| Real-browser and project evidence | Absent | All required checks, actual fraction-button/sign/keyboard input, reset/reopen/rapid navigation, readable scrollable mobile plots |

## Bounded model selected for the full exercise

Use the real SISO forward path P(s)=(b1*s+b0)/[s^n*(s+a)], n=0,1,2, with a positive finite pole rate and positive constant/optional left-half-plane-zero numerator. Editable numerator and finite-pole-factor polynomials use visual entry; integrator count is explicit. Leading denominator scaling is normalized without losing gain. H is a positive constant sensor gain and the feedback sign is negative. This covers the declared baseline, types 0-2, a stable type-2 family and final-value failure variants without a general root finder.

The selected source is reference r, plant-input disturbance d or sensor noise n, one at a time. With y=P*(e_c+d), e_c=r-H*y-n, e_t=r-y, derive the channel first. All initial states are zero. The planned response trace uses a bounded augmented real state transition (at most six states including the polynomial input), independently checked against analytic fixtures; a finite trace is not the proof of a limit. Shared native numeric controls will use the current `readNumericInput` helper; no shared API/package change is needed.

## Independently derived fixtures to verify

These are mathematical test plans, not completed tests or new slide transcriptions:

- Baseline P=4/[s(s+2)], H=1: Kv=2, step error 0, unit-ramp error .5. Ramp error e(t)=.5-.5*exp(-t)*cos(sqrt(3)*t)+exp(-t)*sin(sqrt(3)*t)/(2*sqrt(3)).
- Change numerator to 8: Kv=4 and unit-ramp error .25.
- Baseline with H=2: comparator ramp error .25 while physical tracking error grows as .5*t+.125 (the table alone is insufficient).
- Type-0 P=4/(s+2), H=1: unit-step error 1/3.
- Type-2 P=4(s+1)/[s^2(s+2)], H=1: closed-loop polynomial s^3+2s^2+4s+4 is Hurwitz and unit-parabolic error is .5. Removing the zero gives an unstable loop and no certified final value.
- Baseline unit plant-input disturbance: physical error -1; unit sensor-noise step: physical error +1, comparator error 0.

Course provenance remains TASK/atlas Ch5:8-13, S07 and S03:5,13. The continuous audit independently records the baseline's 0/.5 checks. Original decks have not been newly inspected.

## Current checks and remaining work

The fresh worktree and unique branch are registered in the claim. Locked dependencies installed under bundled Node v24.22.1 (109 packages, zero audit vulnerabilities). Only this audit has been changed so far; implementation, numerical/parser tests, project checks, browser QA and PR delivery remain pending. No claim of implemented mathematics is made at this checkpoint.

## Parser checkpoint

`parser.ts` implements a bounded linear-polynomial entry prototype: decimals, s, sums/products, signed groups, constant-denominator fractions (including compact/mixed/nested numeric forms) and font wrappers from MathLive. It rejects raw e/E scientific algebra, powers/degree >1, variable denominators, empty/incomplete expressions, excessive nesting/size, nonfinite/oversized coefficients and nonzero arithmetic underflow.

`node node_modules/vitest/vitest.mjs run src/modules/cf02/parser.test.ts`: 45 tests passed. `npm run check`: passed. No workspace computation or browser result is claimed. Exact coefficient cancellation must be retained before implementing limit classification; numeric roundoff must not change a numerator's zero order. Derivations and the proposed numerical trace are preserved in IMPLEMENTATION_NOTES.md. Solver, visual workspace, full mathematical fixtures, project/browser checks and PR remain unfinished.
