# CP04 implementation status

- **Stage:** in-progress
- **Last assessed:** 2026-10-29
- **Starting revision:** `8696261267b7620bfc101ce2b5f13772bfaa529a` (fresh primary-main snapshot)
- **Worker chat:** `01a18701-1ec8-7073-a23f-e744d40a5355`
- **Ownership:** `src/modules/cp04/**`, claim `worker-cp04-01a18701`.
- **Branch/worktree:** `codex/cp04-bode-01a18701`; `C:/Users/baokh/.codex/worktrees/cp04-bode-01a18701/CSDKTD APP`.
- **Contract:** [TASK.md](TASK.md), atlas CP04 and continuous source audit P1.

## Requirement audit before implementation

Current `workspace.ts` is an empty synchronous mount, with metadata/lazy loading intact and no local tests. Preserve those foundations.

| Accepted requirement | Missing work / next action |
| --- | --- |
| Normalize factors and preserve gain | Editable raw first/second-order factor coefficients; show constant extraction and overall normalized gain |
| Gain/corners, additive slopes and phases | Compute corner table, running slope intervals, factor contributions and unwrapped phase |
| Student asymptote drawing and corner markers | Student normalization-gain and corner guesses generate an expected curve and markers before checked reveal |
| Select a factor | Selector overlays that factor's normalized magnitude/phase contributions |
| Exact versus asymptotic response and cursor error | Computed log-frequency plots and one numeric frequency cursor; compare magnitudes/phases and diagnose pure gain offset |
| Explicit delay | Add exp(-tau s) as a separate exact phase term with unchanged magnitude; no Pade approximation |
| rad/s versus Hz, dB versus linear | Convert display coordinates/controls while preserving the same physical frequency/model |
| Bounded validation, visual equations, changed inputs | Shared visual scalar coefficient inputs with independently tested numeric/fraction grammar, error feedback and declared limits |
| Lifecycle/scoped layout/tests/browser | Caller-owned mount state, abortable result controls and editor loading; meaningful fixtures, project checks and reserved real-browser QA |

## Chosen bounded domain

Continuous-time scalar transfer represented as K s^n exp(-tau s) times up to six numerator/denominator factors. Each factor is a0+a1 s (a0>0, nonzero signed a1) or a0+a1 s+a2 s² with positive coefficients and under/critical damping (0.05<=zeta<=1); quadratic natural frequency and all first-order corners lie in 10^-4–10^4 rad/s. Higher or overdamped polynomials can be entered as separate supported real factors where applicable; there is no general factoring/CAS claim. n is an integer -3…3, tau is 0…10 s. Coefficient/gain numbers use bounded real decimal/fraction entry. All frequencies remain positive. A declared finite log grid is sampled for illustration, while frequency evaluation is analytic up to floating-point arithmetic. The tool makes no loop-stability or complete-resonance-search claim.

## Verification plan and source provenance

The default raw factors (s+1)(s+2) must normalize to K_n=1/2, corners 1 and 2 rad/s and slopes 0,-20,-40 dB/decade. Independently, G(j)=1/(1+3j)=0.1-0.3j, magnitude sqrt(0.1), phase -atan(3). At omega=2 the magnitude is 1/sqrt(40). Test gain-offset prediction, factor rescaling, unit round trips, delay-only phase change, origin powers, signed first-order factors, a resonant quadratic and malformed/unsupported/bounded inputs.

Read current primary coordination guides, TASK/STATUS/source, contribution/development/design/equation guides, atlas CP04, source audit P1 and shared math README. No shared mathematical helpers are available or required. Original course slides remain outside Git; the source audit's baseline is retained, and new numerical fixtures will be labeled proposed. All implementation and checks are pending; no completed exercise is claimed at this checkpoint.

## First calculation checkpoint

`math.ts` implements bounded visual number/fraction parsing, raw-factor normalization, additive exact numerical response, straight-line magnitude and phase approximations, pure delay, student-predicted curves, gain-offset diagnosis, slope intervals and a bounded logarithmic grid. `math.test.ts` passes 25 independent baseline/changed/boundary/failure checks under Node 24.22.1. At omega=1 the default gives magnitude sqrt(0.1), -10 dB and -atan(3); at omega=2 it gives 1/sqrt(40), with asymptote 1/4. Delay and unit-conversion invariants pass. UI and browser evidence remain missing. Frequency and quadratic-damping boundary comparisons allow relative/numeric 10^-12 rounding tolerance; predictions are bounded to 10^-100…10^100 to keep numerical curves finite.
