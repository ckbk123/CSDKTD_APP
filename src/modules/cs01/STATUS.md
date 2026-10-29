# CS01 implementation status

- **Stage:** verified
- **Last assessed:** 2026-10-29
- **Starting revision:** `c5d1135ba8b595215dfc7007824d5bd206908152`
- **Pull request:** [#8 — CS01 stability laboratory](https://github.com/ckbk123/CSDKTD_APP/pull/8)
- **Worktree:** `C:/Users/baokh/.codex/worktrees/cs01-pole-stability-01a18701/CSDKTD APP`
- **Worker chat:** `01a18701-1ec8-7073-a23f-e744d40a5355`
- **Ownership:** `src/modules/cs01/**`; claim `worker-cs01-01a18701`; branch `codex/cs01-pole-stability-01a18701`.
- **Contract:** [TASK.md](TASK.md), atlas CS01, continuous source audit S7 and [stage definitions](../../../docs/PROJECT_STATUS.md).

## Requirement-to-evidence audit

| Accepted requirement | Implementation / evidence | Remaining |
| --- | --- | --- |
| Editable exercise, prediction and checked reveal | `workspace.ts`: visual A/B/C/D fields, two predictions, reveal with comparison; changed data invalidates results | None |
| Asymptotic/internal versus zero-state BIBO | `math.ts`: exact trace/determinant signs for two-state internal test; exact reduced denominator for BIBO; separate verdicts and assumptions | None in supported domain |
| Selected pole/eigenvalue and its mode | All-root table, computed complex plane, selectable exponential or cosine component; generalized-mode checkbox for defective repeated root | None |
| Original realization versus reduced scalar transfer | View selector preserves A and all eigenvalues; shows exact numerator, characteristic polynomial, common factor and reduced transfer; free state versus regular impulse traces | None |
| Imaginary-axis multiplicity and Jordan qualifications | Exact discriminant and A=λI test; algebraic multiplicity/eigenspace dimension; simple imaginary pair and semisimple/defective zero examples; explicit resonant/constant forcing qualification | None in supported domain |
| Hidden unstable mode variation | TASK diag(1,-2), B=[0;1], C=[0,1] fixture; original state can grow while scalar transfer is 1/(s+2). Audit B=[1;1] variant also tested | None |
| Changed inputs and failures | `math.test.ts`: near cancellation, ±10⁻⁹ boundary shifts, fractions, dimension/grammar/bounds failures; module feedback clears stale results | None |
| Visual mathematics and readable plot labels | Shared equation input/display; local scoped Indigo/slate CSS; numeric initial states/horizon; units and line patterns | Light theme not separately browser-tested; shared tokens unchanged |
| Mount/reset/cleanup/isolation | Synchronous lazy public mount; abort/disposal guard on editor import; caller-owned drafts; per-result abort controller; no timers/observers/remote calls | None |
| Independent fixtures and production integration | Worker: 35 pure math + 5 lifecycle/flow tests and 82 then-current project tests. Coordinator: 51 CS01 tests and 254 combined application tests, type/build and production-browser checks | None; independent review below |

## Supported mathematical domain and limits

Continuous-time real SISO realizations x'=Ax+Bu, y=Cx+Du. A is 2x2, B 2x1, C 1x2, D scalar. The default canonical realization derives exactly G(s)=1/(s²+3s+2), with poles -1,-2. No feedback sign is implied. State vectors are columns; each matrix row acts on that column. Zero-input traces use selectable x(0); transfer and BIBO statements assume zero initial state. Nonzero initial states do not change a transfer function.

Numeric matrix entries are signed integers, decimals (at most 9 decimal places and 12 digits total) or simple fractions of decimals, with magnitude <=100 and reduced denominator <=10^9. Matrices retain the displayed bmatrix/pmatrix/matrix layout; optional A=, B=, C=, D= labels are accepted. Expressions/functions, complex entries, parameters and higher dimensions are rejected with feedback. Matrix input length is capped at 512 characters and scalar text at 90. Coefficients are stored in ascending powers internally; displayed polynomials use descending powers. BigInt rational arithmetic performs characteristic/numerator derivation, sign tests, polynomial GCD and cancellation exactly. A near pole/zero pair is never silently canceled. No approximate stability strip is used.

Time is in seconds; eigenvalues have units s^-1, imaginary frequencies rad/s. State/input/output units must be chosen consistently. Initial states have magnitude <=100, horizon 0.05–30 s. Numerical roots use a stable low-order quadratic formula. Free and scalar impulse traces are analytic matrix/pole exponentials sampled for display (241–2,049 points, >=24 points per oscillation); a controller sample period is not introduced. Growth beyond exp(40) or excessive oscillation resolution produces a shorter-horizon message while retaining the analytic classification. The finite trace is illustrative, not a stability proof. D delta(t) is stated separately and is not drawn as a finite spike.

Support includes distinct real roots, simple conjugate roots, semisimple repeated zero, defective zero Jordan blocks, repeated negative Jordan blocks, zero channels, finite direct feedthrough and exact hidden modes. Nonzero repeated imaginary Jordan blocks require at least four real states and are outside this two-state domain. No arbitrary-order matrix, general CAS or transfer-only claim about a physical hidden realization is made.

## Mathematical verification and provenance

The source audit identifies Ch4:4–9 and S06:4 for the lesson. Original decks remain outside Git and were not newly inspected by this worker. Hidden-state, oscillator and Jordan variants are **proposed verification fixtures**, not newly transcribed course examples. TASK uses B=[0;1]; the audit's B=[1;1] variation is separately tested.

Independent checks in `math.test.ts` include:

- Baseline characteristic s²+3s+2 and G=1/(s²+3s+2), roots -1,-2. For x(0)=[1,0], x1=2e^-t-e^-2t and x2=-2e^-t+2e^-2t; impulse h=e^-t-e^-2t.
- Hidden state: exact common factor s-1 and reduced G=1/(s+2); free state e^t despite stable scalar BIBO. At t=30, diag(1,-2) with x(0)=[1,1] retains both e^30 and e^-60 numerically. The reduced impulse computes e^-60 without contamination from the canceled unstable mode.
- Oscillator A=[0,1;-4,0]: eigenvalues ±2j, bounded free motion, non-BIBO channel 1/(s²+4); x(π/4)=[0,-2] for x(0)=[1,0].
- Semisimple A=0 versus A=[0,1;0,0]: constant states versus [t,1] from x(0)=[0,1]; the latter has a defective zero eigenvalue. A=[-1,1;0,-1] instead has decaying [t e^-t,e^-t].
- Direct channel: diag(-1,-2), B=[2;3], C=[4,5], D=2 yields (2s²+29s+35)/(s²+3s+2) and regular impulse 8e^-t+15e^-2t. Zero dynamic channels reduce to a constant without discarding internal eigenvalues.
- Exact coordinate permutation invariance, finite-difference initial derivative, a simple zero root, near-repeated exponentials, near cancellation, tiny real roots and conjugate roots at Re=±10^-9, malformed/unsupported/over-limit data and excessive growth/horizon failures.

`workspace.test.ts` adds five mocked-editor tests for prediction/reveal, hidden original/reduced views, invalidation/errors, plot-limit feedback, abort, cleanup/reopen and late imports. These are lifecycle tests and do not certify actual MathLive behavior.

## Actual automated commands

Node **24.22.1** with npm 10.8.2 was used inside the worker worktree. Commands were invoked via the bundled Node executable and installed npm CLI; PATH for child commands points to that Node. Dependencies were installed with locked `npm ci`, zero vulnerabilities, no package changes. An initial invocation of npm.cmd selected the computer's older Node 20 and emitted engine warnings; `npm ci` was rerun successfully under Node 24 before checking.

- `node node_modules/vitest/vitest.mjs run src/modules/cs01`: **40 passed** (35 mathematical + 5 lifecycle/flow).
- `npm run check`: **passed**.
- `npm test`: **82 passed** in 8 files.
- `npm run build`: **passed**; Vite emits the existing MathLive large-chunk advisory and local font assets.
- `git diff --check`: **passed**.

The first global run exposed MathLive's Node server export during catalogue entry imports. The module's synchronous public mount now loads the browser editor only within the visit, guarded against abort/disposal; no shared test/configuration changes were made. Numerical review also fixed cancellation loss between separated growing and decaying exponential components. Both corrections have regression coverage.

## Browser evidence / remaining delivery

Production build inspected in the in-app Chromium browser at http://127.0.0.1:8841/#/module/CS01 on 2026-10-29, approximately 17:05–17:11 ICT. Exclusive CS01 QA reservation acquired 10:04:48 UTC, released 10:10:54 UTC. Primary checkout and preview 8787 were untouched. Only this worker's tab was used and closed; temporary viewport overrides were reset before release.

- Baseline prediction/reveal: both correct predictions match; characteristic s²+3s+2, tr=-3, det=2; roots -2,-1; all state/BIBO verdicts correct. At 6 s, x1=0.00495136, x2=-0.00494522, y=0.00495136 for [1,0].
- TASK hidden fixture: original eigenvalues -2,+1, internal unstable and scalar BIBO stable. Selecting +1 shows exp(t); at 6 s x1=403.429, x2=y=6.144e-6. Switching to reduced view lists only -2 and shows the decaying scalar impulse, while retaining the original internal verdict.
- Oscillator is bounded/non-asymptotic and non-BIBO. Semisimple repeated zero is bounded/non-asymptotic; defective zero is unstable. Generalized-mode checkbox shows t exp(0t), and the free response reaches [6,1], y=6 at 6 s.
- Actual visual typing: clicked first A cell and used ordinary Backspace/1 keys to change A11 from 0 to 1. The computed roots changed to -2.41421 and +0.414214; state and BIBO classifications became unstable. A malformed trailing number outside a matrix was rejected with matrix-entry guidance.
- Actual D fraction-button entry: cleared D, inserted a fraction, typed numerator 1, ArrowDown, denominator 2; reveal accepted it and produced N=(1/2)s²+(3/2)s+2. This was real MathLive entry, not a scripted field-value assignment or mocked editor.
- Empty D and incomplete power boxes get `Complete D and check its equation notation`; pi is rejected as outside the scalar-number grammar. Empty horizon and 31 s get the finite 0.05–30 s guidance. Edits clear old results.
- Systems math keyboard displayed its symbols; Escape and Reset each closed it. Tab from initial x1 moves to initial x2. Matrix brackets, fractions, powers and result equations rendered with the local fonts. Stylesheet links were same-origin generated assets; browser warning/error log was empty.
- Reset returned baseline fields, horizon 6 and [1,0]. Leaving to catalogue removed all math-field elements; reopening restored baseline. Three rapid CS01/CS02 navigation pairs left CS02 with zero old fields and no late CS01 content. Returning to CS01 and revealing worked normally; no console warnings/errors.
- Desktop dark theme inspected at normal size and 1280x900; narrow dark theme at configured 390x844. Narrow document client/scroll width were both 375 px (scrollbar gutter), with no page-wide overflow. Figure widths were 307 px with their own 360/560 px scroll areas. Controls/matrices wrapped and remained readable. Light theme was not separately browser-tested; it uses the unchanged shared light tokens. The available browser controls expose viewport/visibility, not a color-scheme emulation switch.
- Local screenshot: `C:/Users/baokh/.codex/visualizations/2026/10/29/01a18701-1ec8-7073-a23f-e744d40a5355/cs01-browser-evidence.jpg` (untracked evidence outside the repository).

The worker's accepted bounded mathematical and exercise requirements were complete at submission to PR #8. Its final source revision is recorded in the shared claim. The independent coordinator review below supersedes the worker's then-pending review disposition.

No shared dependency/API request was needed for worker delivery. Its stage was implemented before independent review. Checkpoints fd559dc, e614561, a42cbde and 8e8e4f5 preserve the audit and implementation. Branch checkpoints have been pushed for recovery.

Input review also added MathLive's compact fraction serialization (single-digit unbraced arguments such as fraction 1/2) and mixed braced/unbraced forms. They use the same exact bounded rational validation and pass the local tests. The completed actual fraction-button evidence above supersedes the earlier pending browser gate.

Narrow-screen preparation keeps plot labels at a readable minimum scale with scrolling confined to each figure. The completed viewport evidence above supersedes the earlier pending check.

## Delivery checkpoint

Final verification on 2026-10-29 at approximately 17:12 ICT: module tests 40/40, project tests 82/82, `npm run check` and `npm run build` passed after the browser-tested source changes. Browser reservation was released and its tab closed. Final implementation checkpoint `52a36fa91b89ea481c86b3aca9c4f7707c05bd28` is pushed. The final status-only commit records PR #8; the shared claim records its exact final tested tree revision.

PR creation through the connected GitHub integration returned HTTP 403 `Resource not accessible by integration`. No PR was created by that call. The GitHub CLI is not installed in PATH or the usual local install locations. The normal browser fallback required sign-in, so its tab was closed and QA released immediately. PR #8 was then created successfully through the existing Git authentication used for the authorized push (credentials stayed in process memory, with no output or file storage). No app dependency or credential changes were made. The isolated preview was stopped after QA; primary port 8787 was untouched.

## Independent coordinator review — 29 October 2026

Accepted source: `75d3528d20f62d082a3151d6a734a4fe237589bd`, [PR #8](https://github.com/ckbk123/CSDKTD_APP/pull/8). The preserved worker tree was clean at that exact revision. Independent review checked the TASK, full owned-file scope, exact rational trace/determinant and polynomial cancellation, internal versus reduced-channel BIBO statements, semisimple and defective boundaries, changed inputs and visit cleanup. At the earlier mathematical checkpoint `a42cbde`, 560 independent RK4 state-component comparisons had worst scale-adjusted discrepancy 3.06e-14; final source changes were reviewed separately, including compact fractions and rejection of visual e/E notation. No remaining code blocker was found.

The coordinator adapted native initial-state/horizon controls to the shared `readNumericInput` API while retaining local bounds. Eleven added regression cases check nonzero raw underflow, stale-result cleanup, intentional zero, representable exponents and bounds; the changed-exponent fixture independently follows the −2 eigenmode. Exact matrix/fraction parsing is unchanged. The final integration passes **51 CS01 tests, all 254 application tests in 17 files, type checking and production build** under Node 24. The coordination helper's separate **32 tests** pass. The existing MathLive chunk-size advisory remains.

Actual coordinator Chromium checks used the combined production build at `127.0.0.1:8820/#/module/CS01` under the exclusive QA reservation, approximately 11:35–11:39 UTC:

- Baseline predictions matched both verdicts, characteristic s²+3s+2 and the independently known 6 s state. The hidden fixture retained internal instability and stable reduced G=1/(s+2); original free response reached x₁=403.429 and x₂=y=6.144e-6. Switching to the reduced view removed +1 from channel poles while retaining the internal verdict. The defective zero fixture gave x=[6,1], y=6 and the Jordan-chain qualification.
- Native `1e-999` produced explicit underflow feedback and no stale verdict/plot. `0e-999` preserved intentional zero. Initial [1e-2,−2e-2] at horizon 1e-1 produced x₁=0.00818731, x₂=−0.0163746 and y=x₁, matching .01 exp(−.2).
- Real D fraction-button entry of 1/2 gave unreduced numerator (1/2)s²+(3/2)s+2. Reset restored four baseline visual fields and hidden results. Navigation to DS03 removed the old CS01 root; returning created one fresh CS01 root, four fields and initial [1,0], horizon 6.
- At 1280×900 the page client/scroll width was 1265; at 390×844 both were 375. Plot overflow stayed in the 307 px figures with 360/560 px content. Local fonts were loaded; captured warning/error logs were empty. Existing light-theme limitations in worker evidence remain; no new light-theme claim is made.

Evidence outside Git: `C:/Users/baokh/.codex/visualizations/2026/10/28/01a182f7-8bce-7fb3-b79d-2ef1b1cfe8dd/release-0.3.4-desktop.png` and `release-0.3.4-phone.png`. Both were visually inspected. The coordinator reset the viewport, closed its tab and released QA. This review supports the declared two-state domain; it does not certify arbitrary-order stability software or a deployment.
