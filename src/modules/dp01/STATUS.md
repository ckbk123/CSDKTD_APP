# DP01 implementation status

- **Stage:** in-progress (implementation and automated checks complete; browser QA pending)
- **Last assessed:** 2026-10-29
- **Starting revision:** `c5d1135ba8b595215dfc7007824d5bd206908152`
- **Tested implementation checkpoint:** `2b1b8fb9c45343eea704007c1c09a294e956f842`
- **Ownership:** `src/modules/dp01/**`; branch `codex/dp01-sequences-f802`
- **Contract:** [TASK.md](TASK.md); [stage definitions](../../../docs/PROJECT_STATUS.md)

## Requirement-to-evidence audit

The starting revision contained a blank workspace and no local tests. Existing metadata and the baseline banner were preserved. The banner remains a notation preview; the workspace owns its actual model.

| Accepted requirement | Delivered behavior and evidence |
|---|---|
| Editable data, mathematical validation | `view.ts` uses shared visual input/display. `math.ts` parses bounded real rational expressions in z; parser tests cover fractions, products, powers, normalization and useful rejection of unsupported/improper/singular forms. |
| Step/impulse/ramp/free sequences | `simulate` evaluates the causal normalized recurrence with explicit output history. Zero-history forced and zero-input free components are computed separately and summed. All four inputs have independent closed-form tests. |
| Stems and sample/time axes | `plot.ts` draws actual samples; sample index or seconds is selectable. Optional dashed held stairs are explicitly a drawing guide. Numeric sample inspection and the full accessible sample table supplement the plot. Narrow plots scroll inside their own focusable region. |
| Selectable initial history | Zero or custom y[-1], y[-2]. Changing history leaves the zero-state TF/forced response unchanged. Tests check superposition and prehistory indexing. |
| Modal decomposition | Original quadratic/linear denominator poles, radius/angle and decay/sign/oscillation reasoning. Analytic free-response and impulse modal-tail formulas handle distinct real, conjugate, repeated and zero poles; the forced response is linked through convolution. Near-coincident roots use the recurrence instead of an ill-conditioned residue display. |
| Prediction/reveal and changed data | Prediction of strict natural decay, revealable results, presets for ±0.8, conjugates and repeated +1. Separate comparison holds radius fixed while angles vary, including 45°/90° and 0°/180°. Interaction tests cover changed amplitude/history, error inputs and reopen. |
| Physical timing and intersample limits | T changes time labels and physical ramp values, not fixed discrete step/impulse/free samples. Principal pole angle is rad/sample, θ/T is rad/s with alias branches. No continuous plant/hold or intersample maximum is inferred. |
| Lifecycle/isolation | `workspace.ts` exports synchronous mount and guards its lazy browser-only view against abort/disposal. State is mount-local; listeners use the signal; cleanup destroys the equation input and removes owned content. Two loader tests and five view-flow tests exercise lifecycle/results. |
| Project/browser checks | Automated checks below pass. Real-browser editor/fonts/keyboard, reset/reopen/rapid navigation and narrow-screen checks are pending the shared reservation. |

## Supported domain and conventions

- Real proper rational SISO transfer function with denominator degree 1–2. Optional G(z)=; decimal numbers; z; sums, subtraction, products, fractions, parentheses, integer powers 0–2 and ordinary implicit multiplication. No general CAS, negative powers, transcendental functions or other variables.
- Coefficients are displayed in descending z powers, normalized to leading denominator 1; numerator is left-padded to the same degree. Recurrence coefficients multiply successive delays. The denominator is not cancelled: arbitrary output history may excite its modes even if the selected zero-state channel cancels a factor. No feedback topology is assumed.
- Causal input u[k]=0 for k<0. Step A, sample impulse A at k=0, physical ramp A kT, or zero input. Output history is y[-1], y[-2] (second entry unused for order 1). Free response uses zero input; forced response uses zero output history.
- 4–200 samples; T in [0.0001,100] seconds; entered/normalized coefficient magnitudes at most 10^6; amplitude/history magnitudes at most 10^4; response/components at most 10^10. Leading denominator magnitude at least 10^-8. Expression length 512, nesting 20, intermediate degree 6 and intermediate coefficients at most 10^12.
- Floating-point arithmetic; displays use six significant digits and scientific notation as needed. Pole-radius boundary tolerance 10^-9. Near-coincident real modal roots (relative separation below 10^-7) use recurrence reasoning. Repeated unit-circle poles may give k p^k growth; a single-mode envelope does not certify BIBO/internal stability. δ[k] denotes a sample impulse and 0^0=1 in zero-pole formulas.

## Independent mathematical fixtures and provenance

TASK/atlas cites Ch8:41–44,46–62 and S13. The recorded discrete source audit describes negative-pole worksheet/modal reasoning. Original slides have not been newly inspected by this worker. ±0.8 and equal-radius comparisons remain proposed teaching fixtures, distinct from inspected source examples.

Independent expected values in `math.test.ts` are derived from geometric sums or explicit modes:

- Baseline G(z)=0.2/(z-0.8): step y[k]=1−0.8^k, first samples 0,0.2,0.36,0.488; impulse h[0]=0 and h[k]=0.2·0.8^(k−1) for k≥1; ramp T[k−5+5·0.8^k].
- Free history c gives c·0.8^(k+1). Negative pole gives (−0.8)^k; conjugates ±0.8j give 0.8^k cos(kπ/2).
- Repeated 0.5 pole impulse is (k−1)0.5^(k−2) for k≥2. Repeated +1/history [1,0] gives k+2. Two zero poles give a two-sample delay. Direct feedthrough, unreduced cancelled modes and changes of T are checked separately.
- Distinct-mode decomposition is checked against 2(0.5)^k+3(−0.5)^k with independently chosen histories. Failures include malformed/empty/nonfinite notation, improper/future-input models, zero/tiny denominator, excessive degree/size/nesting, invalid T/count/history, and explosive responses.

## Actual automated verification

In this worktree, bundled Node v24.22.1 with npm 10.8.2 and locked dependencies (`npm ci`: 109 packages, zero audit vulnerabilities):

- `npm test -- src/modules/dp01`: **48 tests pass** (41 mathematical/parser tests, 5 view-flow tests with a public equation API stub, 2 lazy-mount lifecycle tests).
- `npm run check`: **pass**.
- `npm test`: **90 tests pass across 9 files**.
- `npm run build`: **pass**. Existing MathLive large-chunk advisory remains; all 20 fonts are emitted as same-origin WOFF2 assets. No generated files committed.
- A first full-suite run exposed browser-only MathLive import evaluation during catalogue testing. Fixed within DP01 by lazy view loading; the subsequent full suite passed.
- Private production preview: http://127.0.0.1:8891/ returns HTTP 200. Primary checkout/preview 8787 was not modified.

## Remaining work and delivery

Real-browser QA is pending because another worker holds the shared reservation. No browser controls have been used by this worker yet. Complete those checks, record exact evidence, mark implemented, commit/push and submit the exact tested revision. No shared dependency/API request, version change, deployment or main merge is needed. Independent integration review is separate and has not been claimed.
