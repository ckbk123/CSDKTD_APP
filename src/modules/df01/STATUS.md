# DF01 implementation status

- **Stage:** implemented (hidden-brace correction checked; coordinator native-number adaptation pending before acceptance)
- **Assessed:** 2026-10-29; base `c5d1135`, tested implementation `717adda`; earlier checkpoints `a798749`, `309dbc8`
- **Ownership:** `src/modules/df01/**`; acceptance: [TASK.md](TASK.md)

## Requirement evidence

| Accepted requirement | Implementation and checks |
|---|---|
| Editable sampled channel, period, horizon and band | `view.ts`: shared visual G(z) field; T, N, 2%/5% controls. `math.ts`: independent bounded parser/validation; malformed, unsupported, nonfinite, improper and unstable inputs tested. Edits invalidate stale answers. |
| Identify largest/peak and settling indices before revealing | Stem plot and numeric sample inspector; two prediction inputs and an unestablished option; reveal gives feedback and reasoning. For monotone responses, distinguish largest plotted sample from an attained global peak. |
| Stem visualization, final value, band and markers | Computed SVG stems, dashed final level, shaded band, selected sample and revealed largest/settling markers. Both k and t=kT axes; keyboard numeric inspector shows both numerical routes. |
| Samples and physical time with explicit initialization | k=0 is the first output, including direct feedthrough. Unit step starts at k=0, all prior inputs/outputs and x[0] are zero. Output is read before simultaneous state update. No added feedback. T changes seconds without changing this fixed discrete sequence. |
| Remain in band after the first settling index | Observed suffix plus a conservative bound on **every** unplotted homogeneous-error sample; insufficient horizon or unresolved numerical boundary gives “not established.” Never substitutes N for settling. |
| Compare recurrence/state under identical initialization | Independent output recurrence and controllable state realization; matrices, recurrence, DC limit and maximum discrepancy revealed. Fixtures check both routes against independently derived sequences. |
| Changed-data experiment | Oscillatory `1.25/(z²+.25)` and short-horizon `.01/(z-.99)` presets; manual model/T/N/band edits; state and answer do not survive reopening. |
| Intersample distinction | No continuous plant/hold is supplied. Explicitly no reconstruction or continuous-peak claim. |
| Lifecycle/metadata/style isolation | Original `index.ts` unchanged. Synchronous `workspace.ts` mount owns guarded lazy view and cleanup; tests prevent late import mount and duplicate disposal. View listeners use signal, field destroyed, no timers/workers. All CSS under `[data-module="DF01"]`. |
| Independent math and project checks | 30 parser/math tests plus 4 UI/lifecycle tests (34 local total); exact commands/results and real-browser evidence below. |

## Supported mathematics and numerical limits

- Real SISO LTI proper rational polynomials in z, denominator degree **1 or 2**, numerator degree no larger; optional G(z)=. One visual fraction or typed division; decimal coefficients, sums, products, parentheses and integer powers 0–2. No variables other than z, symbolic parameters, functions, nested fractions or implicit cancellation. Visual `2e-7` is rejected rather than silently treating the displayed variable e as scientific syntax; enter a decimal coefficient.
- Parser uses ascending powers internally; normalized solver arrays/equations use descending powers: a=[1,a1,a2], b=[b0,b1,b2], dropping the second-order entries for order one. Direct term D=b0; C=[b1−a1b0,b2−a2b0]. No feedback loop is added.
- Strict disk stability uses every unreduced denominator root, radius <1−10⁻⁹. Unstable cancelled modes remain rejected. Zero-state unit step only. Relative bands need nonzero final value: 10⁻⁹≤|G(1)|≤10⁶.
- ≤512 input characters and 128 polynomial tokens; degree ≤2 including intermediate polynomial products. Coefficients and normalized coefficients ≤10⁶, leading denominator magnitude ≥10⁻¹⁰. T in [10⁻⁶,1000] seconds; integer last index N in [2,500] (N+1 plotted samples). Abort computation if response/state magnitude exceeds 10⁹. No iterative root finder.
- All displayed decimal evaluations are numerical approximations (7 significant digits); small nonzero residuals remain visible and scientific outputs use typeset powers of ten. State/recurrence agreement threshold 10⁻⁸ times max(1,response scale). Peak ties within 10⁻¹² of final-value scale choose the earliest index. Negative-gain peaks/overshoot follow the direction of final value.
- For future-error certification use the homogeneous error state v=[e[k],e[k−1]] and companion matrix A. Find m≤4096 with q=||A^m||∞<1−10⁻⁸. For j=lm+r, ||A^j v||∞≤||A^r||∞ q^l ||v||∞. The maximum norm for r=0…m−1 bounds every future sample; inflate by 1+10⁻⁸ and reserve 10⁻¹⁰ times the output scale. First-order errors use their monotone absolute envelope. This bound can be conservative. An ambiguous band-boundary sample does not justify naming the following sample as first; such cases remain unestablished. Extending N can resolve insufficient horizons, but cannot resolve a mathematically exact boundary obscured by floating arithmetic.
- Overshoot is observed on the grid. A positive directional peak has supporting numerical evidence across the whole sample grid only if its excess dominates the future-error envelope including the roundoff allowance. This is not interval-arithmetic certification. Otherwise “largest plotted sample” is the stated result; a monotone response may have no attained finite maximum.

## Independent fixtures and provenance

The course audit DF1 supports TF/recurrence/state comparison and sampled transient metrics (CH8:41–62; S13:6–11). This worker read the recorded audit/atlas, not original slide assets; no fixture below is claimed to be a slide transcription.

- Baseline `.2/(z−.8)`: y[k]=1−.8^k, y[0…3]=0,.2,.36,.488; `.8^17>.02`, `.8^18<.02`, so k_s=18 and t_s=1.8 s at T=.1. At 5%, k_s=14; T=.25 gives 3.5 s with unchanged sequence.
- Alternating `1.5/(z+.5)`: y[k]=1−(−.5)^k; k_p=1, 50% overshoot, k_s=6. Negative-gain counterpart checks direction and absolute band.
- Repeated poles `.25/(z−.5)^2`: h[k]=(k−1).5^k for k≥2, zero earlier; step is its partial sum, error=(k+1)/2^k; k_s=9.
- Conjugate poles `1.25/(z²+.25)`: sequence 0,0,1.25,1.25,.9375,.9375,1.015625,1.015625; first peak k=2, overshoot25%, k_s=6.
- Direct feedthrough `(z+.2)/(z−.5)`: y[k]=2.4−1.4(.5)^k, y[0]=1; checks output-before-update timing.
- Temporary band entry `(z²−z+1.64)/(z²+.64)`: y[2]=1, y[3]=1.64, final1; N=2 must not establish settling. Exact 5% boundary with pole sqrt(.05) checks numerical uncertainty.
- Tail bounds checked against independently continued sequences to k=500 for distinct/repeated/conjugate modes. Failure cases include unstable hidden cancellation, ±1/unit-circle poles, zero final value, malformed/incomplete forms, noncausal degree, coefficient limits and invalid T/N/band.

## Executed checks

Toolchain: **Node 24.22.1**, npm 10.8.2, locked dependencies inside this worktree. Invoked npm via `node.exe C:\Program Files\nodejs\node_modules\npm\bin\npm-cli.js` with Node24 on child PATH; direct Vitest via the same Node runtime.

- `npm ci`: passed, 109 packages / 0 vulnerabilities. Initial machine-default Node20 invocation printed engine warnings; repeated under Node24 successfully. No dependency files changed.
- `npx vitest run src/modules/df01` (direct equivalent `node node_modules/vitest/vitest.mjs run src/modules/df01`): **3 files / 34 tests passed** after all review corrections.
- `npm run check`: passed after all implementation/review corrections.
- `npm test`: **9 files / 76 tests passed** after all implementation/review corrections.
- `npm run build`: passed after all implementation/review corrections; only the existing large MathLive chunk warning. All 20 local font files emitted.
- `git diff --check`: passed.
- An initial full-suite import failure exposed MathLive's browser-only initialization in a public workspace import. The visit-owned lazy `view.ts` now keeps public metadata/workspace loading independent of browser initialization, with explicit abort/disposal tests. No shared files changed.
- Browser QA attempts correctly reported other owners (DR01, then DS03). No browser control was used without the reservation. Worker production preview is at `127.0.0.1:8811`; primary port8787 untouched.

## Remaining work and delivery

The accepted bounded exercise is implemented and checked. The hidden-brace correction is complete. Native-number adaptation is separately assigned to the coordinator before acceptance; see the latest disposition below. Independent integration review is still separate; no final verified-stage review is claimed. Branch `codex/df01-sampled-quality-01a18701`; final evidence commit and submission follow these checks. No merge, deployment, version/dependency changes or added agents.

## Preliminary review correction (2026-10-29)

Coordinator review identified that a floating residual could round to zero even though the exact tail remains nonzero. Corrected the returned/displayed tail envelope to **include** the scale-aware roundoff allowance already used for settling, and explicitly labeled it floating-point evidence rather than an interval-arithmetic proof. Global-peak wording uses the same allowance. Regression `(z²+.5z+.75)/(z²+.25)` has exact e[2]=1/5 and e[62]=(1/5)4^-30>0, while its computed residual can round to zero; the displayed envelope now remains positive and encloses this error. No independent final-review stage is claimed.

Also accepted MathLive's single-token fraction arguments (for example fraction numerator 1 need not serialize with braces); decimal-only coefficient grammar remains explicit. Current checks after these changes: local suite **3 files / 34 tests**, full `npm test` **9 files / 76 tests**, `npm run check`, `npm run build` and `git diff --check` all passed under Node24. Build warning unchanged. Subsequent real-browser evidence follows below.


## Real-browser evidence (2026-10-29, 17:23–17:28 Asia/Saigon)

- Worker chat: `01a18701-3f40-7572-9a49-7dc0103c9161`. Shared QA acquired through the claim helper; used a newly created, dedicated in-app Chromium tab on the production build at `http://127.0.0.1:8811/#/module/DF01`. Tested system dark theme at 1280×900 and 390×844; temporary viewport override reset, temporary tab closed and QA released after testing. Primary preview8787 untouched.
- Baseline predictions k_p=60 (largest plotted sample) and k_s=18 both checked correct; y∞=1, t_s=1.8s, observed overshoot0%. Monotone/no-attained-peak distinction visible.
- T=.25 and 5% band recomputed k_s=14, t_s=3.5s with unchanged sequence. Changing inputs immediately removed old plot/answer.
- Oscillatory preset: predicted k_p=2 and k_s=6 checked correct; overshoot25%, t_s=.6s; inspector k=3 agreed at1.25 in state/recurrence routes.
- Short-horizon preset N=20 correctly reported unestablished settling. Raising N to500 established k_s=390 and39s, without inventing the horizon as a settling time; 501-stem rendering remained responsive.
- Cleared the actual MathLive field: useful empty-equation feedback and no stale response. Inserted incomplete fraction: highlighted-box feedback and no response. Ordinary keys plus fraction button built `1/(z−.5)` and computed final2, k_s=6, t_s=.6s. Fraction and power buttons built `1.25/(z²+.25)` and computed the independently checked oscillatory response. The test also deliberately produced a term outside the fraction; the bounded grammar rejected it with a useful one-fraction message.
- Actual Systems keyboard opened and inserted z; this invalidated the old response. Escape dismissed it without leaving the tool. Changing the visual denominator to z−2 produced the strict-unit-circle error. Fraction/power and matrix result glyphs rendered correctly with bundled styles; browser console captured **no error/warning logs**. Document font status reported loaded. No claim of testing every browser or separately testing light theme.
- Shell Reset example restored G=.2/(z−.8), T=.1, N=60, band2%, blank predictions and a closed keyboard. Numeric inspector keyboard ArrowUp advanced k=18→19, yielding t=1.9s and matching output. Leaving with the keyboard open removed the field and keyboard; rapid DF01→CP01 navigation left zero `.df-tool` roots on CP01. Reopening DF01 restored its baseline and independent state.
- Narrow baseline and quadratic revealed views: document client/scroll widths both375px (390px viewport with scrollbar). Plot scrolled internally (281px container /540px plot); long quadratic equations scrolled internally (281px container, largest644px), without widening the page. Controls stacked and remained usable. No visual layout repairs were required.
- Screenshot evidence saved outside Git at `C:/Users/baokh/.codex/visualizations/2026/10/29/01a18701-3f40-7572-9a49-7dc0103c9161/df01-browser.jpg`.

## Final handoff

Owned changes: `math.ts`, `math.test.ts`, `view.ts`, `view.test.ts`, `workspace.ts`, `workspace.test.ts`, scoped `style.css` and this record. `TASK.md` and metadata unchanged. Supported scope remains stable real order1–2, proper channel, zero prehistory and sampled evidence only. Conservative numerical/near-boundary cases can remain unestablished; higher orders, arbitrary initial states and continuous intersample reconstruction are outside this declared exercise domain. The independent integration owner reviews and merges separately. Claim submission records the final tested branch SHA; retain its worktree and reservation.


## Pull request delivery record (2026-10-29)

- PR: [#16 — Implement DF01 sampled transient quality exercise](https://github.com/ckbk123/CSDKTD_APP/pull/16), targeting main; no prior PR existed for this branch. Attached to the worker chat.
- Worker chat: `01a18701-3f40-7572-9a49-7dc0103c9161`.
- Branch: `codex/df01-sampled-quality-01a18701`; preserved worktree: `C:/Users/baokh/.codex/worktrees/df01-sampled-quality/CSDKTD APP`.
- Coordinator reopened the existing submitted reservation solely to complete this delivery record and trim EOF whitespace. Mathematical/UI behavior is unchanged from reviewed implementation `f77ac833d927a79723b2164fc897f19c9770c53c`; no new browser reservation was acquired.
- PR creation through the connected GitHub integration returned403 (insufficient integration permission). Existing local Git authentication successfully created the single PR; no credential values were printed or saved.
- The final submitted SHA includes this record; independent integration/versioning remains with the coordinator.

## Hidden-brace review return (2026-10-29)

Coordinator reopened PR16's same reservation and branch after finding that standalone TeX braces were being turned into invented visible parentheses. The reported numerator `1{+2}` and `{z+2}z` cases are now rejected with guidance to use visible parentheses. True fraction arguments remain consumed by the fraction reader; power arguments remain limited to0,1,2; unsigned numeric wrappers are removed without inventing multiplication (`1{2}` stays the displayed12). Nontrivial standalone groups, including nested/signed placements, reject. Numeric wrapper nesting is bounded at16; malformed adjacent decimal points reject.

Added 10 regression checks covering both failures, nested/denominator/signed/grouped variants, numeric wrappers/concatenation, compact fractions, power arguments, and distinct visible-addition/parenthesis controls. Current local total44 tests; full suite86 tests, type check and production build pass. Build warning unchanged. Focused actual-entry rejection/control checks subsequently passed, as recorded below.

Coordinator disposition: period, horizon, inspector and prediction native-number controls will be adapted to current shared `readNumericInput` by the coordinator during integration, including raw nonzero numeric underflow such as1e-400. This older branch does not import/copy the unowned shared helper, rebase or merge main. That adaptation and its combined tests are required before coordinator acceptance; this record does not claim it has already happened.

### Focused correction browser evidence (2026-10-29, 19:16–19:18 Asia/Saigon)

Held DF01 QA via current primary helper. Used a new dedicated hidden Chromium tab on production preview8811 with the corrected parser; no viewport override was applied. Pasted the actual notation payload into the real MathLive field through its native paste action, not a mocked editor or DOM assignment:

- `\frac{1{+2}}{z-.8}` rendered visible numerator1+2, then Plot response showed “Use visible parentheses ( ) to group polynomial terms. Hidden brace groups are not supported.” No response was computed.
- `\frac{{z+2}z}{z^2+.25}` rendered numerator z+2z and received the same rejection, without inventing a z² direct term.
- Explicit `\frac{1+2}{z-.8}` computed normalized numerator3 and final15, with k_s=18; explicit `\frac{(z+2)z}{z^2+.25}` retained the visible grouping and independently stepped y[0]=1 in both routes.
- Shell Reset example restored the baseline, final1 and k_s=18. Console returned no errors/warnings. Temporary tab closed and QA released; primary preview8787 remained untouched.
- Screenshot: `C:/Users/baokh/.codex/visualizations/2026/10/29/01a18701-3f40-7572-9a49-7dc0103c9161/df01-hidden-braces.jpg` (outside Git).

Correction verification: 44 module tests /86 application tests, `npm run check`, `npm run build`, and `git diff --check` pass; unchanged MathLive size warning. The latest same-PR submission includes this evidence. Native-number API adaptation remains coordinator-owned and pending before acceptance, as explicitly assigned above; it is not claimed complete in this worker tree.
