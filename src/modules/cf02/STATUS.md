# CF02 implementation status

- **Stage:** in-progress
- **Assessed:** 2026-10-29, fresh primary-main baseline `0b199d44b5a83d2c4fbf08e3e7c8dec1117da31d` (v0.3.3).
- **Worker chat:** `01a186d1-f1f0-7393-88e7-377fbac7299a` (host `local`).
- **Ownership:** `src/modules/cf02/**`; [TASK](TASK.md).
- **Branch/worktree:** `codex/cf02-steady-state-7393`; `C:\Users\baokh\.codex\worktrees\cf02-steady-state-7393\CSDKTD APP`.
- **PR:** [#18](https://github.com/ckbk123/CSDKTD_APP/pull/18), draft pending browser verification. Prior DS01 PR #10 is submitted and preserved for coordinator review; corrections take priority.

## Audit before implementation

At the initial audit, `workspace.ts` was an empty synchronous mount and there were no local helpers or tests. `index.ts` is the correct lazy metadata. The shell equation preview is not a solver. The table below preserves the preimplementation requirement audit; later checkpoints record actual delivery.

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

The fresh worktree and unique branch are registered in the claim. Locked dependencies installed under bundled Node v24.22.1 (109 packages, zero audit vulnerabilities). At the initial checkpoint only this audit existed. Later evidence follows; browser QA and final submission remain pending.

## Parser checkpoint

`parser.ts` implements a bounded linear-polynomial entry prototype: decimals, s, sums/products, signed groups, constant-denominator fractions (including compact/mixed/nested numeric forms) and font wrappers from MathLive. It rejects raw e/E scientific algebra, powers/degree >1, variable denominators, empty/incomplete expressions, excessive nesting/size, nonfinite/oversized coefficients and nonzero arithmetic underflow.

`node node_modules/vitest/vitest.mjs run src/modules/cf02/parser.test.ts`: 45 tests passed. `npm run check`: passed. No workspace computation or browser result is claimed. Exact coefficient cancellation must be retained before implementing limit classification; numeric roundoff must not change a numerator's zero order. Derivations and the proposed numerical trace are preserved in IMPLEMENTATION_NOTES.md. Solver, visual workspace, full mathematical fixtures, project/browser checks and PR remain unfinished.

## Solver/workspace checkpoint — 29 October 2026

The bounded exercise is now implemented locally, pending final project/browser verification. Exact rational coefficients preserve numerator zero order and cubic Hurwitz signs. The solver derives reference, plant-input-disturbance and sensor-noise transfer functions for comparator/physical error, Kp/Kv/Ka, finite limits and the full polynomial asymptote for stable loops. It refuses FVT for unstable/boundary full-loop polynomials, even where a channel cancellation might hide a mode. Zero excitation is an explicitly separate zero-initial-state identity.

The workspace has two shared visual equation inputs, all native numeric readers use `readNumericInput`, optional predictions, eight changed-data presets, signal derivation before the type table, exact checked results and separately labeled numerical error curves/sample tables. Any edit clears prior results. New mounts/restore baseline reset all local state; abort guards lazy equation loading and destroys both inputs. Module CSS is scoped; index metadata is unchanged.

Bounds: normalized pole rate a=0.1–10; gain=0.05–50 (b0 for a constant numerator, b1 otherwise); optional zero rate b0/b1=0.05–10; H=0.1–10; amplitude −10–10; horizon 0.1–120 s; exact rationals 4096 bits, parser 400 characters/160 operations/depth 12/intermediate magnitude ≤10^12. The numerical trace uses at most six augmented companion/input states, scaling/Taylor exponentiation, 600–40,000 intervals and a 10^12 state/signal cap. Cap/truncation and insufficient-horizon cautions are visible. This is a bounded family, not an arbitrary transfer-function CAS.

Checks on this checkpoint under bundled Node v24.22.1:

- `node node_modules/vitest/vitest.mjs run src/modules/cf02`: **94 tests pass** (45 parser, 5 rational, 37 math/trace, 7 workspace/lifecycle).
- `npm run check`: passes.
- Independent numerical oracles: baseline ramp inverse Laplace expression at every sample; type-0 step 1/3+(2/3)exp(−6t); direct-feedthrough P=2 algebraic loop; independent underdamped step for disturbance/noise; stable type-2 and nonunity-sensor asymptotes; known diagonal/nilpotent matrix exponentials. Exact fixtures include H=.8 cancellation and a nearby nonzero coefficient, cubic boundary/unstable cases, changed gain/scale/amplitude, input bounds and divergence truncation.
- Mock-editor tests exercise result invalidation, source/prediction/reset, malformed and native-underflow input, immediate abort/late loading, initialization failure and new-mount baseline. They do not establish real MathLive functionality.

Full application tests/build, real browser editing/keyboard/font/reset/fast-navigation/mobile evidence, PR creation and exact submitted commit remain unfinished. No shared dependency request is outstanding. Primary preview and shared browser remain untouched by this checkpoint.

The initial full project run at `d6f3454` passed `npm test` (**297 tests / 19 files**) and `npm run build` (including type checks). The existing MathLive input chunk warning remains; no dependency or global build changes were made. Draft PR #18 is created and attached. Shared browser QA was busy (CR02); no browser evidence is claimed yet. A further zero-channel regression and equation-initialization cleanup refinement follow this checkpoint and require the final checks.

### Visual mixed-fraction correction before submission

The coordinator identified that pinned MathLive presents number/fraction adjacency as a mixed number (e.g. 2 followed by 1/2 means 2.5). CF02's initial implicit-product parser would have multiplied it. The current parser rejects an implicit product where a constant precedes a fraction or fraction-containing group, with explicit +/× guidance. Signed, grouped, wrapped and nested cases are covered. Ordinary compact fractions, fractions times s and explicit +/× retain their displayed meaning. This conservative grammar also asks for × between adjacent fractions or before a constant-times-fraction-containing group. No normalization silently converts mixed notation to a product. Seventeen added grammar fixtures bring the local suite to **112 passing tests**, with an added workspace regression in the existing lifecycle test. Actual editor validation remains pending.

The private QA watcher was stopped after the coordinator assigned CR02→CP03→coordinator order. No CF02 browser reservation has been acquired. Own production preview is on port 8796; primary 8787 is unchanged. Wait for the coordinator's order-release notice before new acquisition.

The local suite now passes **115 tests**: 62 parser, 5 rational, 41 math/trace and 7 workspace. Three additional independent trace fixtures cover a factorable cubic at every sample (residues 1, −5/2, 2, −1/2), a stable finite-pole cancellation and a biproper plant with H=3. `npm test` passed **315 tests** and the production build/type check passed after the mixed-fraction correction, before those three extra fixture-only tests. Final full-project/browser evidence remains required before submission.

### Hidden grouping and styled adjacency

Inspection of the pinned MathLive 0.111.1 SSR MathML confirmed that `2{3+4}` has no visible parentheses, and a font wrapper such as `\mathrm{2+3}s` does not visibly group the sum. CF02 now rejects free hidden braces, arithmetic used inside font wrappers, and adjacent numeric factors that could look like joined digits. Atomic numeric/single-s font styles remain supported, including fraction-argument scope. Explicit visible parentheses and explicit multiplication retain ordinary polynomial meaning. A braced numerator/denominator of an actual fraction remains its proper visible fraction scope. No SSR inspection is counted as real interactive browser evidence.

The updated local suite passes **133 tests** (80 parser, 5 rational, 41 math/trace, 7 workspace). UI regressions cover hidden grouping rejection/correction and normal native scientific input in addition to the existing raw-underflow/intentional-zero checks. Final full-project/build and actual-editor checks must use this corrected candidate.

After this correction, `npm test` passes **336 tests / 19 files** and `npm run build` (including `npm run check`) passes under Node v24.22.1. This is the production candidate served by the private port 8796 preview. Real-browser QA and final submission still await the coordinated reservation order; no browser result is implied by these checks.

The error-constant table now labels Kp as dimensionless, Kv in s⁻¹ and Ka in s⁻². Small/large approximate values use multiplication by a superscripted power of ten rather than visual e notation. Seven workspace tests and the production build/type check pass after this presentation-only refinement; numerical algorithms and exact fixtures are unchanged. Pushed `23138cd` also passed GitHub CI. The final submitted SHA will include the completed browser record and any resulting fixes.
