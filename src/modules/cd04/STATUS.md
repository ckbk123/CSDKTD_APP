# CD04 implementation status

- **Stage:** verified
- **Last assessed:** 2026-10-30
- **Assessed upstream main:** `a43989def918052cc969cbee8691ce79d8824ec9`
- **Goal and acceptance contract:** [TASK.md](TASK.md)
- **Stage definitions and evidence rules:** [Project status](../../../docs/PROJECT_STATUS.md)

## Initial audit and ownership

- The reservation audit found immutable plant/C0 metadata and an empty workspace. `index.ts`/`TASK.md` remain unchanged; the shell example stays a notation preview.
- Own only `src/modules/cd04/**`. Public reservation [PR #53](https://github.com/ckbk123/CSDKTD_APP/pull/53) preceded implementation; all-open-PR/issue checks before and immediately after publication found no overlap. Earlier CD07/#50, CD02/#51 and CD06/#52 contributions are preserved separately.
- Branch: `codex/cd04-lead-lag-allocation-20261030`; exact final SHA is recorded in the PR/private ledger and local submitted claim. Tokens are outside Git.

## Requirement-to-evidence assessment

| Accepted requirement | Delivered behavior | Evidence |
| --- | --- | --- |
| Transient and steady-error constraints | Editable plant, direct-pole or approximate time-spec target, constructed lead and chosen/derived accuracy lag | `math.ts` and staged `view.ts`; exact lead factors and combined fixtures below |
| Explain and stage the allocation | Optional gain/ratio predictions, typeset angle/magnitude/coefficient reasoning, lead-only check, lag placement and corner refinement | Mocked-control tests plus actual fraction/power/native-input and changed-data browser cases |
| Full characteristic roots, error and response | Complete degree 2/3/4 polynomials, all modes, Routh and numerical poles, full-state step response, stable-only analytic ramp error | `engine.ts`, `math.ts`, independent modal/physical-cascade fixtures and failure tests |
| Improvement/degradation and next action | Common response axes, equal-scale angle/locus plots, desired versus actual poles, requirement table and specific guidance | Default lag fails overshoot; slower equal-ratio lag passes. Changed plant passes overshoot/error but fails entry deadline. |
| Independent and changed data | Authored baselines/variations, exact algebra, separate physical-state references and bounded work/stability checks | 106 module tests; commands and provenance below |
| Visual/numeric/keyboard/narrow interaction | Shared visual scalar inputs, private bounded parser, native controls/slider, local equation/table scrolling, transient-detail window | Actual 1280×900 and 390×844 QA; table region is keyboard focusable |
| Lifecycle and reset | Synchronous loading host, deferred owned child signal, idempotent cleanup, baseline on reset/reopen | Late/rejected/partial mount and reentrant abort tests; actual open-keyboard reset and rapid cached navigation |

## Mathematical domain and conventions

Continuous SISO `G=g/[s(s+a)]`, baseline C0, lead `K(s+zD)/(s+pD)`, then lag `(s+zL)/(s+pL)`. Negative unity feedback, normalized input/output, zero initial states, unit step and unit-slope ramp. `g` has units s⁻²; `a`, real pole distances and corners use s⁻¹/rad/s; gains are dimensionless, `Kv` is s⁻¹. Coefficients are descending powers; every original mode is retained. No arbitrary plant, symbolic CAS, canceled-mode stability shortcut or guaranteed second-order approximation is claimed.

- Plant: `g=0.05…20`, `a=0.2…20`, baseline `C0=0.05…50`. Target `σ=0.1…10`, `ω=0.1…20`, chosen lead pole `pD=0.2…50`; derived `K=0.001…5000`, `zD=0.01…50`, `pD−zD≥0.0001`, remaining pole distance `r≥0.02`.
- Pair specs: overshoot `0.1…40%`, approximate Ts `0.4…40 s`; `σ≈4/Ts`, `ω=−πσ/ln(Mp/100)` must also fit the supported target bounds. In spec mode, full-model limits use the stricter requested/additional overshoot and entry deadline; nominal pair success is not substituted for the complete response.
- Lag `zL=0.002…10`, `pL=0.00004…10`, `1≤zL/pL≤50`. Ramp-error target `0.0001…1000`. Optional gain prediction `0.001…5000`, required-ratio prediction `1…10¹²`, agreement tolerance 2%; a correct but infeasible required ratio is distinguished from a supported controller.
- Model fields accept decimals, fractions, explicit arithmetic, visible parentheses and integer powers −6…6. Parser limits: 512 characters, nesting12, 128 operations, intermediate nonzero magnitudes 10⁻⁸…10⁸. Reject variables, e/E, mixed numbers, hidden grouping and TeX spacing arguments before normalization. Required native numbers use the shared finite/underflow reader; optional `badInput` drafts are not mistaken for blanks.
- Matching `(s+r)(s²+2σs+q)` gives `q=σ²+ω²`, `r=a+pD−2σ`, `Kg=q+2σr−apD`, `zD=qr/(Kg)`. Independent angle and magnitude checks at `−σ+jω` verify the construction. Baseline C0 remains a separate comparison controller.
- Lead `Kv=gKzD/(apD)` and required `β=max(1,eLead/eTarget)` are computed only from a strictly stable lead-only model. Lag multiplies Kv by its actual chosen ratio. Adding lag re-forms the complete quartic; it does not retain the target pair by assumption.
- Full stability checks all polynomial coefficients and Routh determinants `AB−C`, `ABC−C²−A²D`. Relative margins within 10⁻⁹ are unresolved. Numerical poles use scaling, at most two × 500 iterations, residual<10⁻⁹ and reconstructed-coefficient consistency<10⁻⁷ of product/coefficient scale, plus exact quadratic/binomial/squared-quadratic identities where applicable. Clustered roots have limited positional accuracy; unresolved cases fail usefully.
- Root locus is a finite illustration of all three/four branches at≤242 gains, including K, with minimum-travel permutation matching. Requested maximum `0.01…10,000` extends to≥1.2K if needed. Each sampled full polynomial is checked; sample nonconvergence is reported separately from selected-model checks. Curves do not prove a continuous stable-gain interval. Both angle and locus axes use equal complex-plane units per pixel.
- Full-state RK4 uses scaled companion states, retains every mode and requires no simple-pole residue assumption. Compare h/h2 at all coarse nodes, tolerance0.001×max(1, peak|y|); fine run≤60,000 steps, two runs/model, ≤3 models. Output>1,000, numerical state>10¹², excess work or nonconvergence is unresolved.
- Observation horizon and plotted window each support0.5…200 s; plot uses the shorter, default first12s while metrics use the full80s. Up to901 displayed points are sampled from the appropriate fine-grid window; a final endpoint can be interpolated. Overshoot, IAE and ending error use every full-horizon fine sample. Changing the plotted window preserves every metric (tested independently and in-browser).
- Observed 2% entry requires all later samples inside0.98…1.02 and at least `1/min(−Re pole)` of remaining observed tail. A short horizon is unresolved; unstable/boundary loops have no settled-entry or final ramp-error claim. All transient values remain finite-window observations.

## Independent fixtures and provenance

Original Ch6/S08 slides were unavailable and were not inspected. The separately inspected [KU Leuven §5.7.2](https://modeling-and-simulation-book-fet-edu-em-control--aa8411c2554302.pages.gitlab.kuleuven.be/Content/Control/3_Root_locus.html) supplies the angle/magnitude conditions, not this tool's numerical answer. The default target, limits, combined examples and variations are independently authored. Metadata's plant/C0 fixture remains distinguishable from these additions.

`reference-fixtures.py` is a supplementary stdlib reference with physical `[y, velocity, lag-filter, lead-filter]` cascade states, RK4 dt0.0005s, six cases through80s. Browser calculations instead use scaled companion states. No Python/application dependency is added.

| Authored case | Stable analytic ramp error | Reference overshoot | Reference observed band entry |
| --- | --- | --- | --- |
| Baseline C0=4 | 0.5 | 16.30335217% | 4.0385s |
| Target−2±2j, lead p6 | 0.375 | 7.92493967% | 2.067s |
| Add lag z=.1, p=.1/3.75 | 0.1 | 11.05519147% | 2.68s |
| Refine lag z=.02, same ratio | 0.1 | 8.56836667% | 2.1545s |
| Changed lead p8 | 1/3 | 8.24656752% | 1.994s |
| g2,a3,p8,K6,zD14/3; lag .1/(7/600) | 0.05 | 9.19540793% | 7.1255s |

Exact baseline step: `1−exp(−t)[cos(√3t)+sin(√3t)/√3]`. Lead p6: `K=12,zD=8/3`; `[1,8,24,32]=(s+4)(s²+4s+8)`, all three poles−4,−2±2j. Its complete step is `1+0.5exp(−4t)+exp(−2t)[−1.5cos2t−0.5sin2t]`. Changed p8 gives K16,z3 and `(s+6)(s²+4s+8)`. Changed g2,a3,p8 gives K6,z14/3 and `(s+7)(s²+4s+8)`. Independent tests check full traces, coefficients, root residuals, DC ratios and bounds; repeated baseline poles match `1−(1+t)exp(−t)`.

Default lead passes 10%/4s transient limits but fails tracking. Lag ratio3.75 fixes tracking and pushes overshoot above10%; the equal-ratio slower-corner trial meets all displayed limits. Changed plant meets overshoot/error after lag but misses the4s deadline. Proper positive individual sections can also yield an unstable combined model (lag10/.2); final-value claims are withheld. Guidance identifies the actual failed role/observation, rather than grading coefficients against an answer key.

## Executed checks

Supported Node **24.19.0**, npm **10.9.3**; no package/lockfile change.

- `npm ci`: passed, no new dependencies.
- `npm run check`: passed; final build also type-checked.
- `npm test -- src/modules/cd04`: **106 passed in 5 files**.
- `npm test`: **4,798 passed in 224 files** on the final implementation tree.
- `npm run build`: passed; existing MathLive large-chunk advisory only.
- Bundled Python **3.12.14** ran `src/modules/cd04/reference-fixtures.py`; all six authored physical-cascade cases completed and were independently cross-checked above/in tests.
- `git diff --check`: passed before submission.
- Coordination tests were not separately rerun for CD04. Prior CD07 execution completed **32 passed,0failed,511.1s**. Helper/test blobs are identical here: `64bd6ba343a7e0e4c8c2837539e6fd278c95de07`, `3f0ee4448a38d39d8d0c9661d0047e03e1fca6f2`. This is reused evidence; exact-head upstream CI must still run its full configured suite.

An initial hand-derived modal test used incorrect residue coefficients; independent transfer/residue algebra corrected the expected A=.5,B=−1.5,D=−.5 (the numerical implementation was unchanged). Subsequent tests passed. Real-browser QA exposed early-transient compression from the required long horizon and crowded complex-plane/axis presentation. Separate plot-window sampling, equal-scale taller complex planes, larger/separated phone labels and a concise marker key corrected those issues; metric invariance and final browser rendering were rechecked.

## Actual production-browser evidence

Own Chromium production preview, **1280×900** and **390×844**, dark system theme; no deployment.

- Lead K12,z8/3, third pole−4; 7.92493% overshoot/2.0675s observed entry but ramp error0.375. Adding default lag gives11.0552% overshoot and explicit refinement feedback. Slower equal-ratio lag gives **8.56835%,2.15602s,ramp error0.1**, all four roots including slow−0.0201108; all displayed limits pass.
- Actual changed g2,a3,p8,target.05 produced0.05 ramp error,9.19541% overshoot and7.12677s entry; deadline-specific feedback correctly failed4s. Time-spec mode retained full4.32139%/2s requirements and reported the actual lead overshoot failure. Unstable lag10/.2 reported instability, unavailable final error and bounded-growth failure. Horizon0.5s reported unresolved entry.
- Actual fraction-button entry1/2 changed the required lead gain to24 and baseline ramp error to1; actual C0 power3¹ changed the baseline error to1.33333. Incomplete fraction and visible unsupported `s` were rejected with no checked table. Tab, Numeric→Systems keyboard, Escape→baseline→solve and slider ArrowRight were exercised; slider changed z to0.1025722768 and removed the prior checked combined column.
- Optional lead `e` with empty native value was rejected, removing the table/disabling verification. Optional ratio `e` removed only the stale combined model while retaining the valid lead; native lag `1e-999` was rejected as nonzero underflow. Target σ4 rejected a remaining pole at0 even though the desired pair itself lies left of the axis.
- Plotted window12→1 left the entire80s metric table **identical**, with a clearly labeled first1s chart; restored12s detail. Requested locus max1 extended to14.4 and retained242 samples/designK12. Equal-axis geometry has a separate quantitative45° test.
- Reset with math keyboard open restored pD6, window12,horizon80, blank predictions, no table, disabled verification and closed keyboard. Leave/reopen restored σ2 and pD6. Three rapid cached navigation cycles left **zero CD04 roots/math fields** on the catalogue. Mocked controlled-late-load/failure tests are separate evidence, not simulated browser claims.
- Phone document client/scroll widths **375/375px**. Equations scroll locally; named keyboard-focusable comparison region has client277, content552, rightmost offset275, with readable fixed label/model columns. Taller equal-axis geometry and offset axis labels were visually checked. Captured warning/error logs were empty.
- Desktop, phone-detail and phone-locus screenshots are local task outputs outside Git. Own tab closed, viewport override reset and own preview stopped. Light theme, other browsers/OSes and forced slow-network loading were not separately tested.

## Delivery state

The checked implementation reuses PR #53. Stage is `implemented`, not independently `verified`; upstream fork workflow approval, full CI (including coordination suite) and maintainer review remain pending. No merge, version/release/global change or deployment is included. The user's explicit repeating goal permits the next separately reserved feature after this submission while preserving this worktree/claim.


## Independent coordinator acceptance — 0.3.15 / 30 October 2026

Accepted [PR #53](https://github.com/ckbk123/CSDKTD_APP/pull/53) at frozen source `e2decbf570dfd3bf5311d7ec7d9cfa1f75cd0e3e`, with original contribution history preserved. The current verified stage supersedes earlier pending/partial snapshots in this record; those snapshots remain dated evidence.

1600 independent pole checks and80 response checks support complete combined-model analysis. Module tests: 106. The combined corrected candidate passes **5,562 application tests in 257 files**, TypeScript and production build. The unchanged coordination helper suite passed **32 tests** in this resumed integration. Exact original fork-head CI is green; the release commit receives its own main CI run after publication.

Coordinator production-browser checks: Baseline combined lag overshoot11.0552percent fails10percent while ramp error.1 passes; lag zero.02 preserves ramp.1 and reduces overshoot8.56835percent. Desktop/390px and reset. Browser warning/error logs are checked separately at final integration. These checks supplement the contributor's attributed browser evidence; they do not establish every input, engine, theme, future settling or uninspected course-source answer.

Retain all declared mathematical/input/work bounds and numerical qualifications. Source and authored-fixture distinctions remain. Busy initial controls and optional-detail improvements are tracked in [INTERFACE_REFINEMENT](../../../docs/INTERFACE_REFINEMENT.md); this acceptance does not certify that interface refinement is finished. No deployment occurred.
