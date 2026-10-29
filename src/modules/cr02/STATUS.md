# CR02 implementation status

- **Stage:** in-progress
- **Assessed:** 2026-10-29
- **Baseline:** `ae7daf3477c322d980418ec094b35585e43e109c` (fresh primary-main snapshot)
- **Owned scope:** `src/modules/cr02/**`
- **Worker chat:** `01a186d2-0050-7de0-aa3f-c6616623f222`
- **Branch:** `codex/cr02-ode-laplace-01a186d2`
- **Worktree:** `C:/Users/baokh/.codex/worktrees/cr02-ode-laplace-01a186d2/CSDKTD APP`
- **Contract:** [TASK.md](TASK.md)
- **PR:** not created yet; one module PR will be recorded after implementation.

## Requirement audit before implementation

The claimed baseline has only metadata and a blank mount. There are no local algorithms, controls or tests to preserve. No shared dependency/API changes are needed for the bounded second-order mechanical exercise.

| Accepted requirement | Baseline | Planned evidence / missing work |
|---|---|---|
| Verified physical balance and normalized ODE | absent | Mass/damper/spring force balance with linked coefficient cells; editable ODE and division by mass |
| Term-by-term Laplace conversion and retained initial terms | absent | Select a physical/ODE term and see its derivative identity, polynomial coefficient and initial-condition contribution |
| Zero-state TF independent of experiment | absent | Show G(s)=N/D separately from Y_zi and Y_zs, keeping initial conditions out of the TF |
| Zero-input, zero-state and total responses | absent | Input-dependent numerical traces and a time cursor; exact analytic fixtures provide independent checks |
| Changed mass and displacement experiments | absent | Editable physical coefficients/history, worksheet and nonzero-IC presets; display exactly which terms change |
| Input derivatives without inventing a second input | absent | Separate construction using x1=y, x2=y'−(d/m)u; same scalar input, explicit step timing/jump assumptions |
| Predictions, visual equations, lifecycle and narrow screen | absent | Shared MathLive input/display, prediction/reveal, local state, abort-safe loading/cleanup; real browser QA pending |
| Independent mathematics and global checks | absent | Baseline/worksheet/free-response/derivative-input/critical/undamped/integrator/error fixtures; check/test/build pending |

## Intended bounded mathematical domain

**Mathematical checkpoint:** `math.ts` now implements the bounded ODE parser (prime/dot notation and compact numeric fractions), normalized/Laplace/TF/state equations, stable quadratic pole calculation, explicit DC-limit cancellation status, and a four-state augmented exponential for zero/step/ramp response. `math.test.ts` passed 33 tests, including the analytic baseline, W02, nonzero IC, repeated/complex poles, zero stiffness, derivative-input timing, stiff damping and the free-mass cubic ramp. UI, lifecycle and browser checks are still missing. The initial type check caught an unused test type import; it was removed before this checkpoint.

**Priority review suspension:** CR02 implementation is suspended after mathematical checkpoint `661cdd002e5370364ac17a691bad57fa0e40041e` while the worker corrects DR02 PR #5's ambiguous e/E visual-input semantics. No CR02 UI exists yet. On resumption the CR02 parser must also reject raw e/E numeric notation rather than interpreting the editor's displayed symbol as a scientific literal. The coordinator will own DR02's short visual 1/2 acceptance check, so no duplicate worker browser session is planned.

**Resumed:** DR02's correction was pushed and resubmitted at `3e0a9ba722e7e657e96f680a1a13f87d7ee089d5`; its pending browser gate is explicitly owned by the coordinator. CR02's ODE parser now rejects raw e/E input too, while accepting valid small coefficient fractions internally. The worker is resuming CR02's interface and lifecycle implementation.

**Interface checkpoint / second review suspension:** `view.ts` and scoped CSS now provide the force schematic, two-way coefficient/ODE draft entry, linked Laplace terms, normalized model, initial/input controls, prediction/reveal, TF/initial-response split, same-input derivative construction, response curves, time cursor and computed table. Abort-safe lazy loading and recovery are implemented. `npm run check`, all 45 module tests (37 math plus eight state/lifecycle tests), and all 87 project tests pass. Real-browser verification and final source/visual audit are still pending. CR02 is checkpointed again before DR02 PR #5's signed-fraction normalization correction, which takes priority.

Second-order passive mass/damper/spring models m y''+c y'+k y=b u+d u', with positive finite mass and nonnegative damping/stiffness. The model is SISO and linear; u' is the derivative of the same input. Zero and nonzero initial displacement/velocity are supported. The planned excitation modes are zero input, a step and a physical ramp, all starting with u(0−)=0. Step input derivatives require an explicitly shown velocity jump; a ramp avoids that impulse. No feedback connection is assumed.

Visual ODE entry will accept numeric coefficients and standard prime/dot forms, including simple numeric fractions emitted by MathLive. Numeric physical controls provide an alternative. Coefficients are displayed in descending powers of s. Time is seconds, displacement metres, velocity m/s; mass kg, damping N s/m, stiffness N/m, with input-force conversion units declared beside the controls.

Response samples will use a bounded local matrix exponential, not an external solver or a time-step integration guarantee. Plots join computed samples and will warn if their spacing misses fast modes. Final numerical/input/resource bounds and actual evidence will replace this implementation plan. No completed exercise or browser behavior is claimed yet.

## Source distinction and recovery

The repository's continuous exercise audit records the inspected W02 model 2y''+5y'+3y=u, poles −1 and −1.5, DC gain 1/3. Its nonzero-IC and input-derivative examples are proposed verification fixtures. The worker read that audit; original worksheets/decks were not found at the recorded parent-directory path, so no new inspection of those originals is claimed. Independent algebra verifies the required fixtures without that material.

DR02 is preserved separately at `C:/Users/baokh/.codex/worktrees/dr02-difference-equation/CSDKTD APP`, branch `codex/dr02-01a186d2`, PR https://github.com/ckbk123/CSDKTD_APP/pull/5, submitted `b44907dddae6314fd0c79992082fdd67f6fec4e6`. Its compact-fraction targeted browser check is explicitly deferred under coordinator QA scheduling. A review return or released scheduling will checkpoint CR02 before returning to that original worktree. No parallel implementation or sibling import is authorized.
