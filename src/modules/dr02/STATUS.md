# DR02 implementation status

- **Stage:** implemented
- **Last assessed:** 2026-10-29
- **Owned scope:** `src/modules/dr02/**` only
- **Starting revision:** `c5d1135ba8b595215dfc7007824d5bd206908152`
- **Delivery branch:** `codex/dr02-01a186d2`; exact submitted revision is recorded in the shared claim.
- **Contract:** [TASK.md](TASK.md). Independent integration review remains separate; no `verified` review is claimed.

## Requirement-to-evidence audit

The starting workspace was a blank synchronous mount with metadata and no local tests. Existing metadata, shell preview and unrelated files were preserved.

| Accepted requirement | Implementation and checked evidence |
|---|---|
| Editable TF → recurrence/delay structure | `math.ts` parses real rational polynomials in z or inverse powers, expands products, normalizes the denominator and derives a/b taps. `view.ts` uses the shared visual input and displays linked z / z⁻¹ forms and the isolated current-output equation. |
| Coefficient memory slots and old-value highlight | Computed register cards show current input, each stored input/output, its multiplier and its next shift source. The tapped-delay/summer path is labeled. Selecting a contribution highlights its source card and row and exposes the selected state accessibly. |
| Arithmetic and commit-update step | Reveal computes from the unchanged old snapshot. Commit shifts all registers from that same snapshot. The result table and sample stems contain only committed samples. A prediction can be checked within 10⁻⁶ × max(1, |answer|). |
| Specified history; changed data without changing TF | Editable y[−i], u[−i], held/pulse/ramp input, amplitude and T. Restart rebuilds the visit state. Each committed sample compares supplied history against a separate zero-state run of the same TF/input. Edits invalidate pending arithmetic and old results. |
| Baseline values and causality | Browser and analytic tests give y[0…3] = 0, 0.09516258, 0.181269243, 0.259181774 for the rounded baseline coefficients. Improper models explain that y[k] would require future u[k+r], then disable execution. |
| Changed-input experiment and reveal | Baseline, second-order, three-sample sum and improper presets; all results still come from parsed inputs. Ordinary typing plus the fraction button built 0.5/(z−0.5), yielding 0, 0.5, 0.75, 0.875 in the browser. Nonzero y[−1] = 1 gives y[0] = 0.90483742 while zero-state y[0] stays 0. |
| Lifecycle, accessibility and scoped design | `index.ts` stays metadata-only. `workspace.ts` mounts synchronously and guards the browser-view import against disposal/abort. Equation draft and every mutable model/history/result belong to `view.ts`'s mount. Signal-bound listeners, equation destruction and root cleanup prevent old visits from updating a new page. Styles use `[data-module="DR02"]` and existing Indigo/slate tokens. Numeric controls and buttons support the entire workflow. |

## Supported domain and numerical limits

- Scalar SISO discrete LTI rational polynomials, optionally prefixed by G(z)=. One fraction, real decimal/scientific literals, +/−, explicit products, implicit products such as 2z and (z+1)(z−1), parentheses and integer powers −6…6. Negative powers apply to z only. No symbolic parameters/functions, nested rational expressions or general CAS claims.
- At most 1,000 source characters and 256 tokens per polynomial; intermediate powers within ±12 and coefficient magnitude ≤ 10¹². After normalization there are at most six input/output delays. Entered and normalized coefficients are finite with magnitude ≤ 10⁶. Zero denominator, near-degenerate leading denominator (< 10⁻¹² of its largest coefficient), noncausal future input, unsupported notation, overflow and coefficient underflow produce explicit errors.
- Coefficients a[i], b[i] multiply z⁻ⁱ (increasing delay); a[0] = 1. Thus y[k] = Σ b[i]u[k−i] − Σ a[i]y[k−i] for i ≥ 1 in the second sum. No external feedback topology is assumed. Polynomial factors are expanded without pole/zero cancellation.
- Unilateral zero-state TF convention. Supplied pre-k=0 history contributes separately; it need not be a trajectory from a specified earlier input. Baseline history is zero. u[0] = 1 starts the held input, y[0] = 0, and y[1] is its first nonzero response.
- 10⁻⁶ ≤ T ≤ 10⁴ seconds, t = kT. T labels physical sample time rather than an integration step. A held input is A, a unit-sample pulse is Aδ[k] (no 1/T scaling), and a physical ramp is A·kT with slope in input units/s. Other input/output units are arbitrary but consistent.
- Up to 128 committed samples per experiment. Entered history and input amplitude/slope have magnitude ≤ 10⁶; running memory, inputs, products and outputs must remain finite with magnitude ≤ 10¹². A failing step leaves old memory unchanged. Both history and zero-state comparison must remain in bounds.
- Double-precision arithmetic; displays round to nine significant digits and explicitly typeset small numbers with powers of ten. Algebraic conversion is a polynomial identity subject to floating-point arithmetic; stems are computed samples. No between-sample trajectory, asymptotic stability, symbolic exactness or convergence claim is inferred from a finite run.

## Independent mathematical fixtures

`math.test.ts` contains 30 parser/mathematics cases; `view.test.ts` and `workspace.test.ts` add four caller-state/lifecycle cases. The latter mock equation rendering only and are not offered as interactive-editor evidence.

- Baseline: b = 1−a for the entered rounded numbers, so the independently derived held-input answer is y[k] = 1−aᵏ. Tests check eleven samples and the course's first three nonzero rounded values.
- Changed history: the difference from zero history equals (2a+3b)aᵏ for stored y[−1]=2, u[−1]=3. The TF is unchanged.
- Changed second-order model (0.5z+0.25)/(z²−0.5z+0.125): hand-calculated samples 0, 0.5, 1, 1.1875, 1.21875; nonzero memory gives 3.875, with simultaneous old-value shifts checked.
- S14 audit fixture (14.1z²−23.9z+10)/(z²−z): input 0,1,1 gives 0,14.1,4.3 by manual arithmetic.
- Three-sample FIR sum retains gain 3 rather than being silently normalized. Impulse samples are 1,1,1,0,0. Gain, zero numerator, pure delay, inverse-power equivalence, physical ramp timing, scientific display, malformed decimals, unsupported forms, singular/near-degenerate denominators, overflow, underflow and sample bounds are covered.
- Existing repository source audits supply Ch7/S12/S14/E09 provenance. This worker did not newly inspect original external decks or the MIT exam. The second-order and edge cases are independently derived proposed fixtures, not newly attributed course examples.

## Verification performed

Commands ran in this isolated worktree using bundled Node **v24.22.1** and npm **10.8.2** (npm CLI explicitly launched by that Node executable; its directory prepended for child processes). No dependency or lockfile changes.

| Command | Result |
|---|---|
| `npm ci` | Passed; 109 packages installed, no vulnerabilities reported |
| `npm run check` | Passed |
| `node node_modules/vitest/vitest.mjs run src/modules/dr02` | Passed: 34 tests, 3 files |
| `npm test` | Passed: 76 tests, 9 files |
| `npm run build` | Passed; all 20 equation fonts emitted locally. Existing MathLive chunk-size warning remains. |
| `git diff --check` | Passed |

Production browser QA used the in-app Chromium browser on **127.0.0.1:8792**, at the default **1280×720** and temporary **390×844** viewport, with the system dark theme. The shared QA reservation was acquired before use and released afterward. The viewport override was reset. The primary preview on 8787 was untouched.

Actual browser checks: baseline reveal versus commit and first four samples; nonzero-history comparison; changed TF built through ordinary keys and the fraction button; pure gain prediction; a z⁻¹ model built with the power button; Systems keyboard visibility, symbol insertion and Escape dismissal; Tab from the mathfield to its symbol tools; empty and incomplete fraction feedback; improper-model causality message; invalid T=0; shell Reset restoring TF/T/history/hidden result; leave/reopen restoring baseline and dismissing keyboard; rapid DR02↔DR01 navigation with zero old controls/mathfields on the destination. Local equation fonts reported loaded and KaTeX_Main available; captured browser warning/error logs were empty. Phone layout had page width 375 px within a 390 px viewport; long equations/tables scroll locally.

Local screenshots (outside tracked source): `C:/Users/baokh/.codex/visualizations/2026/10/29/01a186d2-0050-7de0-aa3f-c6616623f222/dr02-desktop.jpg`, `dr02-phone.jpg`, and `dr02-full-page.jpg`. The final production build was reloaded and its baseline arithmetic inspected after the last numerical change.

## Delivery and remaining boundaries

No accepted bounded exercise work remains. Independent integration review is pending. Light-theme rendering and browsers other than the in-app Chromium were not separately exercised; styling uses the shared light/dark tokens. No shared API/dependency request, version bump, main merge or deployment was made. Generated build/dependency files and screenshots are excluded from commits.

Early checkpoints: audit `05a13bd`, implementation `3a9331d` (pushed before interruption), user-requested pause checkpoint `39b6a99`. The resumed worker completed the remaining numerical/display hardening and browser verification. The branch/worktree and submitted claim retain the final deliverable for the integration owner.
