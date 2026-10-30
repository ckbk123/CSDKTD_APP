# CS04 implementation status

- **Stage:** implemented; independent technical review pending.
- **Last assessed:** 2026-10-30.
- **Base:** `a43989def918052cc969cbee8691ce79d8824ec9` (upstream v0.3.14).
- **Delivery/reservation:** [PR #54](https://github.com/ckbk123/CSDKTD_APP/pull/54), branch `codex/cs04-nyquist-pole-count-20261030`; reservation checkpoint `b9be543` preceded implementation. Current tested revision and upstream CI state are recorded in that PR and the private submission record.
- **Contract:** [TASK.md](TASK.md), unchanged. Only `src/modules/cs04/**` changes; metadata, other modules, shared infrastructure, dependencies and release files remain unchanged.

## Delivered exercise

Students edit real plant numerator/denominator polynomials and scalar C/H, construct their own `L=CGH`, follow the complete clockwise RHP source contour and its mapped curve, check an open-loop RHP pole-count attempt, then predict signed winding and reveal `Z=P−N_CCW` and all feedback roots. A wrong P displays the actual open poles and an explanation while keeping the closed-loop answer unavailable. Changing model data or P revokes the prior result. Counterclockwise image turns are positive; both frequency directions, every axis indent and the mapped outer arc participate.

The baseline is the metadata loop, decomposed here as G=1/((s+1)(s+2)), C=4, H=1. Ten presets include unstable plants, nonunit sensing, two RHP poles, negative winding, origin/triple-origin poles, conjugate axis poles and a −1 boundary. An editable sample cursor has slider and numeric/keyboard controls. Equal-unit Cartesian source/image plots have arrows, pole/critical markers and a separately labeled clipped view around −1. Clipping retains gaps and never changes the count. The revealed accumulated argument explains the complete traversal.

The displayed loop numerator N_L and denominator D_L are scaled together to make D_L monic. The displayed Q=D_L+N_L is proportional to the original D_G+C H N_G; it is not falsely equated to unnormalized input coefficients. The reference-transfer numerator is C N_G in the original plant scale. Negative common scaling of the input polynomials leaves the loop and roots unchanged.

## Mathematical support and limits

- Continuous, normalized SISO LTI transfer models; negative summing junction `e=r−Hy`. L is dimensionless, s uses s⁻¹ and imaginary-axis ω uses rad/s. This frequency-domain exercise does not integrate a time response or request initial state values.
- Proper, nonzero, coprime real rational G; denominator degree 1–3 and numerator degree no greater. Common polynomial factors are rejected rather than concealing modes. Controller magnitude 0.05–50 (either sign); positive sensor gain H 0.05–20. A singular direct-feedback term `1+CGH(∞)=0` is rejected. Proper direct feedthrough with a nonzero term is supported.
- Private coefficient arrays ascend in s. Visual polynomial input supports rational numbers, visible parentheses, sums/products and integer powers; negative powers apply only to constants. Each field: ≤600 characters, ≤240 tokens and nesting ≤24. Each decimal: ≤15 digits, decimal scale 10⁻¹⁵…10¹⁵; exact rational arithmetic: ≤60 digits. Input polynomials have primitive integer coefficients ≤10,000 and coefficient magnitude ≤10⁶; normalized loop and feedback coefficients are also bounded. Model degree limits apply after parsing. Incomplete boxes, hidden grouping, mixed-number ambiguity, e/E and unsupported functions are rejected.
- RHP and axis multiplicities are computed by exact rational Routh rules through degree three, including origin factors, zero first elements and auxiliary zero rows. Numerical roots are separately checked with relative residual ≤10⁻⁹, coefficient reconstruction ≤10⁻⁷ and agreement with the exact RHP/axis counts. Conditioning failures do not become axis/stability guesses.
- Contour R: 0.01…10,000; indent ε: 10⁻⁵…1 and ε<R/4. Right semicircle indents exclude exact imaginary-axis poles from P. Overlapping indents and near-pole/end-point intersections are rejected. The minimum of Cauchy and conservative Fujiwara root bounds, with a 5% margin, must put every root of D_L and Q inside the outer radius. A conservative whole-disk Taylor check must exclude closed-loop roots from each indent disk. This sufficient check can report unresolved even when a smaller semicircle-specific argument might succeed.
- N comes from the mapped contour, not from subtracting precomputed root counts. Finite polynomial Taylor disks bound each accepted source interval's argument change below π/3; additional midpoint curvature refinement resolves the plot. Q/D_L is evaluated directly to avoid cancellation in floating-point 1+L. Padding is 10⁻¹² times coefficient scale; this is guarded floating arithmetic, not an interval-arithmetic certificate. Limits: 32,768 visits/contour, depth 30, critical distance |1+L|≥10⁻⁹ and integer-turn residual <10⁻⁷.
- A second safe contour changes both R and ε and must give the same N. The inferred Z must agree with independent exact Routh counts. Insufficient radius, unresolved indentation, near-critical values, numerical disagreement or resource exhaustion report unresolved, with no winding-based stability claim. Ordinary response hits at −1/closed-loop axis roots have a separate boundary state and no reported N. Exact critical frequencies are inserted into ordinary-axis curve segments when those frequencies are actually traversed; a finite/indented view can omit or bypass them.

## Independent fixtures and verification

The original Ch4/S09/E05 slides/worksheets are outside Git and uninspected. The metadata loop is the provided starting fixture; its decomposition and all variations here are authored. The separately inspected [Illinois ECE486 Lecture 18](https://courses.physics.illinois.edu/ece486/fa2026/documentation/handbook/lec18.html) supports the argument principle and CCW convention, not a claim to have inspected the original course materials.

Independent analytical expectations include:

| Loop/variation | P, N_CCW, Z | Independent check |
| --- | --- | --- |
| Baseline 4/((s+1)(s+2)) | 0, 0, 0 | Q=s²+3s+6; roots −1.5±j√15/2. |
| 2/(s−1) | 1, 1, 0 | Q=s+1; the image circle encloses −1 CCW. |
| 0.5/(s−1) | 1, 0, 1 | Q=s−0.5; zero winding is insufficient. |
| C=1.5, G=1/(s−1), H=0.5 | 1, 0, 1 | Pole +0.25; omitting H would give pole −0.5. |
| −2/(s+1) | 0, −1, 1 | Q=s−1. |
| C=2, G=(s+2)/(s+1) | 0, 0, 0 | Proper feedthrough; Q=3s+5. |
| C=−2, G=(s−2)/(s+1) | 0, −1, 1 | Proper negative feedthrough; Q=−s+5. |
| 5(s+10)/((s−1)(s−2)) | 2, 2, 0 | Q=s²+2s+52. |
| 10(s²+5s+10)/((s−1)(s−2)(s−3)) | 3, 3, 0 | Q=s³+4s²+61s+94; Routh column [1,4,37.5,94]. |
| −12(s²+1)/((s+1)(s+2)(s+3)) | 0, −3, 3 | Q=(s−1)(s−2)(s−3); numerator axis zeros are allowed. |
| 1/s, right origin indent | 0, 0, 0 | Q=s+1; open axis pole is excluded from P. |
| 1/s³, right origin indent | 0, −2, 2 | Q=s³+1; roots −1, 0.5±j√3/2. |
| 4/((s²+1)(s+2)), two indents | 0, −2, 2 | Q=s³+2s²+s+6; Routh column [1,2,−2,6]. |

Boundary fixtures include Q=s, s²+2, (s+6)(s²+11) and s(s²+1); N is not reported. Tests also cover repeated RHP poles, equivalent negative scaling, a narrow critical feature at large R, insufficient R/ε, arithmetic/domain errors and deliberate work-limit exhaustion.

A separate Python 3.12.14 standard-library calculation imported no module/TypeScript code. Dense complete complex contours (60,001–144,005 points each) independently reproduced all 13 table rows, then repeated them at R=40 and ε=0.025; turn errors were below 10⁻⁹. Direct critical-frequency evaluations checked the boundary cases. These are independently calculated checks by the contributor, not an independent technical review.

Local final gates with Node 24.19.0/npm 10.9.3:

- **94 module tests / 5 files passed.** Includes staged P/N interaction, invalid/recovery, input-change revocation, helper compatibility, model isolation and delayed/failed/reentrant mount cleanup.
- **npm run check passed.**
- **npm test: 4,786 tests / 224 files passed.**
- **npm run build passed.** Existing shared MathLive chunk-size advisory only; no dependency/global change.
- **git diff --check passed.** Metadata and TASK unchanged.

Actual production-browser checks used an isolated per-chat in-app browser at 1280×900 and 390×844. Baseline, stable/unstable open-loop variations, nonunit H, both winding signs, two RHP poles, origin/triple-origin and conjugate-axis indents, and boundary handling produced the expected results. Wrong P kept the answer hidden; changing P/model data revoked it. Real visual fraction C=3/2 changed the baseline roots to −1.5±j√5/2; a real power entry changed the denominator to s² and yielded axis roots ±j√1.5. Incomplete fractions and visible unsupported scalar s were rejected without stale tables. Native e drafts and 1e−999 underflow were rejected; recovery worked. Final focused checks confirmed negative equivalent scaling, proper negative feedthrough (root +5) and reset-baseline roots.

Cursor arrow keys changed the paired source/image sample. The clipped view retained the exact same count table. Numeric/Systems keyboard switching worked. Reset with the keyboard open restored fresh controls, no results and four closed keyboard toggles. Immediate exit after reload, three rapid cached route cycles and leave/reopen left zero CS04 roots/mathfields on the next page. Phone document width was 375/375; the focusable table was 276/560 with keyboard horizontal scrolling to offset 284. Browser warning/error logs were empty. Owned QA tabs/viewport overrides and preview processes were cleaned up. Desktop/phone screenshots are retained in this task's user-facing outputs, not committed generated assets.

## Pure helper compatibility and review handoff

`exact.ts`, `expression.ts`, `roots.ts`, `nyquist.ts` and the existing Nyquist compatibility fixtures were privately ported from CP05 at upstream a43989d, retaining its pure `construct(n,d,R,epsilon) -> Construction` data contract. No CP05 imports, state or files are used or changed at runtime. The added `winding(loop,construction)` rejects mismatched model coefficients and has no stored current system. Mathematical checks are independent of SVG rendering.

**Coordinated extraction request:** the integration owner can assign a shared-helper owner to extract the unchanged contour contract and optional criterion extension into `src/shared/math`, preserving CP05's removable-point/Bode support. No shared extraction is made without that assignment. Both existing CP05 and this working module currently run independently; there is no unresolved runtime dependency or new package request.

The coordination-helper suite had already passed 32/32 earlier in this contribution goal and was not rerun for unchanged scripts. Its unchanged blobs are `64bd6ba343a7e0e4c8c2837539e6fd278c95de07` (agent-claim.mjs) and `3f0ee4448a38d39d8d0c9661d0047e03e1fca6f2` (agent-claim.node-test.mjs). That reused evidence is separate from the module/full Vitest counts above.

Upstream CI execution needs the repository's fork-workflow approval, and independent maintainer review remains pending. Keep the PR draft until those gates are resolved. No merge, release or deployment is performed.

## Independent review and focused local correction — 30 October 2026

Reviewer chat: `01a186d1-f1f0-7393-88e7-377fbac7299a`. Reviewed frozen PR #54 source **`1d5e04586b8ba5315bef963b515d8fb96f89e6cf`** in a separate review worktree. The original 94 module tests passed. Ten temporary independent probes passed, including 155 factored degree-1–3 Routh/multiplicity cases, four additional complete-contour fixtures (mixed RHP/axis poles and a nonunit sensor), a closed-axis boundary, TeX argument controls and the UI reproductions below. These are source/math/jsdom checks, not fresh browser evidence.

The independently derived fixtures include `G=(s+3)/((s−2)(s+1)), C=3, H=2`, giving `Q=s²+5s+16`, P=1/N=1/Z=0; `G=1/(s²−2s+2), C=−3, H=2`, giving roots `1±√5`, P=2/N=1/Z=1; and `G=1/[s²(s−1)], C=2`, giving `Q=(s+1)(s²−2s+2)`, P=1/N=−1/Z=2. The declared clockwise-source/CCW-image convention, sensor inclusion, boundary separation and stateless contour calculation agree with these checks.

**Confirmed and corrected locally:** build the baseline, clear the native Contour sample index (or enter `1e-999`), then select the other mapped-curve view. The original unguarded zoom listener threw an uncaught validation error and left the old plot under the new selector value. The focused correction routes index/slider/zoom redraws through a guarded handler, remembers the last successfully painted view, restores that selector after validation failure and preserves the displayed plots with useful recovery feedback. It does not change Nyquist mathematics or the accepted input bounds.

- Eight new regressions failed before the correction and pass afterward: empty, nonzero-underflow, negative and excessive indices from both whole/critical views. Each checks no uncaught event, unchanged valid figures, matching selector and successful recovery after entering index 0.
- `npm exec vitest run src/modules/cs04`: **102 tests / 5 files pass**.
- `npm run check`: pass. `git diff --check`: pass.
- This correction is confined to `view.ts`, `view.test.ts` and this record on local branch `codex/cs04-pr54-zoom-fix-7393`, rooted at the frozen PR source. It is not pushed and does not change the external PR. The coordinator owns its independent check and integration.

**Distinct finding, not corrected in this focused commit:** for `G=1/(s−10)³`, C=4, H=1, R=10.001 and ε=0.05, the outer-arc midpoint is explicitly numerically undefined. The analysis correctly reports an insufficient-radius/unresolved result and does not invent N. However, the view drops that point from its single image series and the plot draws a chord between its neighboring valid responses. The mapped series should split at the missing response so the unresolved part stays a gap. This was reproduced by the real math helper and captured series in a mocked-editor view; actual browser verification remains a coordinator gate.

**Nonblocking workflow follow-up:** the initial view has no computed plot and exposes four equation editors, ten preset buttons and R/ε before the first construction. The coordinator clarified that the external contribution predates the new baseline-first feedback. Keep simplifying that presentation as a prioritized UX follow-up, rather than treating it alone as a TASK correctness rejection. Shared palette-token alignment is also a later presentation follow-up.

No fresh browser control is available in this review session, and no unsupported Firefox route was retried. Full combined tests/build, final desktop/narrow-browser gates and fork CI approval remain with the coordinator. The earlier contributor browser/full-suite evidence above is not claimed as a new reviewer run. The mistakenly reserved local implementation claim was released as unstarted; its clean setup and the separate review worktree were preserved, with no competing implementation started.
