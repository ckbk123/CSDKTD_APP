# CD07 implementation status

- **Stage:** implemented; independent maintainer review remains (not claimed verified).
- **Last assessed:** 2026-10-30.
- **Upstream baseline:** `a43989def918052cc969cbee8691ce79d8824ec9`; fetched again before delivery and unchanged.
- **Owner/branch:** `ckbk456`, `codex/cd07-response-curve-20261030`; only `src/modules/cd07/**`.
- **Reservation and delivery PR:** https://github.com/ckbk123/CSDKTD_APP/pull/50
- **Contract:** [TASK.md](TASK.md); stage definitions: [PROJECT_STATUS](../../../docs/PROJECT_STATUS.md).

## Requirement audit and implemented behavior

At selection, current main had an empty mount and no CD07 tests. All open
upstream PRs, including drafts, and open issues were checked: none existed.
The owned STATUS audit was pushed as `fd51302` and PR #50 opened as the public
draft reservation before substantial implementation. An immediate recheck found
only that reservation. This is a finite one-module contribution.

| Accepted requirement | Implementation and evidence |
| --- | --- |
| Estimate response-curve parameters | `view.ts` has editable K, τ, L visual equations and numeric/arrow-key tangent intercept markers. `plot.ts` draws the computed step curve, measured tangent and plateau; L̂=t₀, τ̂=t₁−t₀, R=K/τ̂. A model-tangent action supplies a checked measurement. |
| Assumptions and named rule | Confirmation gates the reveal. P, PI and PID use measured parameters; intermediate formulas, seconds, gain units, ideal standard/parallel conversion and the actually simulated filtered controller are shown. |
| Original PI discrepancy | The course audit's reported 0.3L is retained as provenance. The separately inspected reference table uses L/0.3; `math.test.ts` checks baseline PI Ti=5/3 s and Ki=2.16, not Ti=0.15 s. No correction or inspection of the original deck is claimed. |
| Prediction, reveal and changed data | Optional Kp prediction gets 2% agreement feedback. Results are staged behind the reveal and cleared on edits. An authored K=2, τ=3 s, L=1 s variation gives PID Kp=1.8, Ti=2 s, Td=0.5 s. Marker error and manual gain/time edits affect subsequent computations. |
| Test the suggested controller and refine | `math.ts` retains the actual pure delay, simulates suggested and edited controllers on the actual plant, and compares output/effort, overshoot, observed band entry, ending error, IAE and peak effort. Requirements are editable and explicitly finite-horizon observations. |
| Validation, mathematical limits and conditioning | Private bounded numeric grammar, shared TeX-argument preflight and native-number reader; range/work/growth/refinement failures clear stale results. Independent analytic and separately coded numerical fixtures check delayed responses. |
| Per-visit state and cleanup | Metadata unchanged. Synchronous `workspace.ts` adds owned loading feedback and defers the equation dependency. Child signals release partial/failed mounts, late imports, keyboard fields and listeners; `view.ts` owns all editable state. Fresh reset/reopen is baseline. |

## Supported mathematical domain

- SISO continuous LTI plant `G(s)=K exp(-Ls)/(τs+1)`: K in [0.05,20], τ in [0.2,20] s, L in [0.02,10] s and L/τ in [0.05,1]. Positive monotone response, unit reference step, negative unity feedback; all histories and controller/plant states initially zero. No arbitrary rational plant or ultimate-gain experiment is implemented: this is the accepted response-curve branch of the exercise.
- Markers use the same delay/time-constant bounds; the plateau is the entered plant gain. This is an FOPDT surrogate's initial tangent, not a claim to identify an arbitrary measured S-shaped plant.
- Model fields accept decimals, signed numbers, +/−, explicit ×/÷, visible parentheses, numeric fractions and integer powers −6…6. Compact simple TeX fractions are accepted. Nested fractions require completed argument boxes. Mixed-number adjacency, implicit multiplication, standalone hidden brace groups, e/E symbols, variables/functions, ambiguous unbraced exponents, blank arguments and unsupported commands are rejected. At most 512 characters, 12 nested atom groups, 128 arithmetic checks; nonzero intermediate magnitudes must be 10⁻⁸…10⁸. Nonzero decimal underflow is rejected before it can become zero.
- P omits integral action. PI/PID have Ti in [0.01,100] s; manual Kp is [0.001,500], Td is [0,10] s. PID simulation uses `Kp[1+1/(Ti s)+Td s/(1+Td s/10)]`, derivative on error with its reference-step kick. The ideal rule and filtered simulation are explicitly distinguished; there is no saturation, noise, anti-windup or hardware experiment.
- Horizon [1,200] s; at most 100,000 steps per run and four runs per comparison. RK4/method-of-steps meshes divide L exactly; linear interpolation of past control retains the delay, without Padé. The reference jump is handled with the left limit at the first delayed endpoint. A half-step comparison requires scaled output discrepancy ≤0.002 and effort discrepancy ≤0.005, each normalized by max(1,|fine value|). State/control magnitude >10,000, nonfinite growth, excessive work or unresolved refinement withholds results. Some valid models/controllers need a shorter horizon to fit this explicit work bound.
- Overshoot is sampled relative to 1; IAE uses trapezoidal integration over the observation window. Ending error is not steady-state error. Observed 2% entry requires staying in [0.98,1.02] through the horizon with at least max(τ,2L) of observed tail. It is unresolved otherwise. No finite trace or refinement comparison proves asymptotic stability or future settling. Drawn paths preserve bucket extrema; metrics use the full trace.

## Source provenance and independent fixtures

Inspected repository evidence: TASK, atlas CD07, SLIDE_REVIEW's discrepancy note,
development/contribution/design/equation guides and current implementation.
Original course slides/images remain outside this checkout and were **not inspected**.
The default plant is documented metadata, not newly inspected slide evidence.

Separately inspected on 30 October 2026: [KU Leuven, Control Systems and Applications,
§5.8.1](https://modeling-and-simulation-book-fet-edu-em-control--aa8411c2554302.pages.gitlab.kuleuven.be/Content/Control/4_Ziegler-Nichols.html).
Its unity-gain reaction-curve table supplies P/PI/PID time/gain factors, including
PI Ti=L/0.3. Dividing Kp by K is independently derived by normalizing loop gain.
The original course source's discrepancy remains for the instructor to resolve;
the executable convention and separate reference are visible in the exercise.

Independent mathematical evidence in `math.test.ts`:

- Exact open-loop exponential and baseline P/PI/PID parameters.
- Analytic convolution before the second feedback arrival, including the filtered derivative's exponential reference kick.
- Independently expanded multiple-delay P-loop series, and gain-normalization/output-effort invariants.
- `reference-fixtures.py` is a reproducible Python-stdlib exponential-midpoint calculation with analytic reference kick, filtered **output** and trapezoidal integral, independent of production RK4/error-filter states. Runs at 0.0001 and 0.00005 s agree within 1.4×10⁻⁶ IAE and 8.3×10⁻⁷ at the checked output samples. Baseline PID overshoot ≈81.72486%, entry ≈5.1357 s, IAE ≈1.1756974 and peak effort 52.8; app comparisons use explicit looser numerical tolerances.
- Authored changed-data, mismeasured markers, manual refinement, insufficient horizon, growth/work limits and malformed/boundary inputs. These fixtures are not attributed to course slides.

## Checks actually performed

Windows, Node **24.19.0**, npm **10.9.3** invoked explicitly through that Node
(the initial system npm invocation used unsupported Node 22.20.0; installation
was repeated under 24.19.0 before the recorded validation).

- `npm ci`: passed under Node 24.19.0; no package/lockfile/dependency change.
- `npm run check`: passed.
- `npm test -- src/modules/cd07`: **125 passed in 4 files**.
- `npm test`: **4,817 passed in 223 files**.
- `npm run build`: passed; existing MathLive large-chunk advisory remains.
- `python src/modules/cd07/reference-fixtures.py`: both independent fixture runs completed.
- `git diff --check`: passed.
- `npm run test:agents`: **32 passed, 0 failed**, full rerun completed in 511.1 s under Node 24.19.0. The earlier attempt was manually stopped after 320.8 s/12 passing cases; that interruption was not a pass and is superseded by this completed rerun. No coordination helper was modified.

The first full run exposed eager browser-editor loading in the catalogue test;
the owned deferred wrapper fixed it. The first PID refinement run rejected an
underresolved filtered step kick; a finer filter-based mesh fixed it without
relaxing the numerical screen. These failed iterations are not recorded as passes.

Actual production-build browser checks used a task-owned in-app Chromium tab
against a temporary local Vite preview (no deployment), dark system theme:

- **1280×900 desktop and 390×844 phone:** editable model fields, confirmation, prediction/reveal, P/PI/PID conversions, computed plots/table, marker typing/arrow keys, model-tangent recovery and manual refinement.
- Baseline PID yields about 81.725% overshoot. Manual Kp=2.4, Ti=2 s, Td=0.25 s yields about 1.3862%, observed entry 2.3716 s and peak effort 26.4; baseline fails / manual passes the displayed finite-window requirements. Changed K=2, τ=3, L=1 and PI/P variants also computed.
- Actual shared fraction-button entry of 1/2, incomplete numerator/denominator feedback and recovery; power-button/ordinary-key entry of 2¹ and subsequent computation; direct typing, Tab, Systems keyboard, Escape→preset→solve and keyboard dismissal.
- Unsupported e notation was rejected with no stale plots; native `1e-999` was rejected as nonzero underflow with no stale table. Native `1e-2` and intentional `0e-999` were accepted. Short/weak-controller traces reported unresolved band entry.
- Reset with an open math keyboard restored baseline, unchecked assumptions, PID selection, blank prediction and hidden results. Leave/reopen did the same. Three rapid cached-bundle navigation cycles left zero CD07 roots and zero math fields on the catalogue; no stale view appeared. Deferred-load/failure resource tests separately cover controlled late resolution.
- Phone document client/scroll widths **375/375 px**, no page-wide overflow. Long equations scroll locally. Phone plot labels were enlarged and rechecked. Fractions, powers and controller equations rendered with bundled font assets; captured browser warning/error logs were empty.
- Desktop/phone screenshots are task deliverables outside Git. No mocked-editor test is presented as browser evidence. Light theme, other browsers/OSes and forced slow-network loading were not separately exercised.

## Remaining work and delivery boundary

No known accepted response-curve exercise requirement remains unimplemented.
Maintainer independent technical review is still required before a `verified`
stage. Upstream CI for this fork reports `action_required` (maintainer approval);
the PR stays **draft** while upstream CI remains unconfirmed. Recovery: a
maintainer approves the fork workflow for the exact PR head, lets Web checks
finish (including all coordination tests), reviews this
bounded implementation, then marks this same PR ready if the gates pass. No
workflow approval or remote-CI success is claimed here. The original deck's PI
correction and broader browser/theme coverage remain explicitly unclaimed.
There is no shared API request. No sibling/shared/global files, dependencies,
versions, tags, main, merge or deployment were changed. This contribution ends
with this one PR. Further contributions use separate branches and PRs; this PR
does not include another module, extra agent or scheduled follow-up.
