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

Second-order passive mass/damper/spring models m y''+c y'+k y=b u+d u', with positive finite mass and nonnegative damping/stiffness. The model is SISO and linear; u' is the derivative of the same input. Zero and nonzero initial displacement/velocity are supported. The planned excitation modes are zero input, a step and a physical ramp, all starting with u(0−)=0. Step input derivatives require an explicitly shown velocity jump; a ramp avoids that impulse. No feedback connection is assumed.

Visual ODE entry will accept numeric coefficients and standard prime/dot forms, including simple numeric fractions emitted by MathLive. Numeric physical controls provide an alternative. Coefficients are displayed in descending powers of s. Time is seconds, displacement metres, velocity m/s; mass kg, damping N s/m, stiffness N/m, with input-force conversion units declared beside the controls.

Response samples will use a bounded local matrix exponential, not an external solver or a time-step integration guarantee. Plots join computed samples and will warn if their spacing misses fast modes. Final numerical/input/resource bounds and actual evidence will replace this implementation plan. No completed exercise or browser behavior is claimed yet.

## Source distinction and recovery

The repository's continuous exercise audit records the inspected W02 model 2y''+5y'+3y=u, poles −1 and −1.5, DC gain 1/3. Its nonzero-IC and input-derivative examples are proposed verification fixtures. The worker read that audit; original worksheets/decks were not found at the recorded parent-directory path, so no new inspection of those originals is claimed. Independent algebra verifies the required fixtures without that material.

DR02 is preserved separately at `C:/Users/baokh/.codex/worktrees/dr02-difference-equation/CSDKTD APP`, branch `codex/dr02-01a186d2`, PR https://github.com/ckbk123/CSDKTD_APP/pull/5, submitted `b44907dddae6314fd0c79992082fdd67f6fec4e6`. Its compact-fraction targeted browser check is explicitly deferred under coordinator QA scheduling. A review return or released scheduling will checkpoint CR02 before returning to that original worktree. No parallel implementation or sibling import is authorized.
