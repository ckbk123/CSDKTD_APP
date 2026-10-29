# CS01 implementation status

- **Stage:** implemented (accepted bounded exercise and project/browser checks complete; independent review pending)
- **Last assessed:** 2026-10-29
- **Starting revision:** `c5d1135ba8b595215dfc7007824d5bd206908152`
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
| Independent fixtures and production integration | 35 pure math tests + 5 mocked-editor lifecycle/flow tests; all 82 project tests, type check and build pass | PR / claim submission pending below |

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

The accepted bounded mathematical and exercise requirements are complete. Remaining delivery steps are the final commit/push, one PR and exact claim submission. Independent technical review is deferred to integration; no verified stage is claimed.

No shared dependency/API request is needed. No independent review has been claimed; the final worker stage will be implemented rather than verified. Checkpoints fd559dc, e614561, a42cbde and 8e8e4f5 preserve the audit and implementation. Branch checkpoints have been pushed for recovery.

Input review also added MathLive's compact fraction serialization (single-digit unbraced arguments such as fraction 1/2) and mixed braced/unbraced forms. They use the same exact bounded rational validation and pass the local tests. Browser checks remain pending until the shared QA resource is released.

Narrow-screen preparation keeps plot labels at a readable minimum scale with scrolling confined to each figure (rather than shrinking axes with the whole SVG). The production build still passes; actual viewport evidence remains pending.

