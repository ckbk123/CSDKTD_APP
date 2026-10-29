# CF04 implementation status

- **Stage:** in-progress
- **Worker chat:** `01a18701-1ec8-7073-a23f-e744d40a5355` (local)
- **Worktree:** `C:\Users\baokh\.codex\worktrees\cf04-frequency-specs-01a18701\CSDKTD APP`
- **Branch:** `codex/cf04-frequency-specs-01a18701`
- **Claim baseline:** `9d923d2f9a3728bdfd6516dd68aa06c93d9e7f86` (primary v0.3.9)
- **Contract:** [TASK.md](TASK.md), read in full; no implementation/browser verification claimed yet.

## Requirement-to-evidence audit

At claim, index.ts was metadata-only and workspace.ts was blank, with no module tests. The shared example banner is a separate preview. Preserve metadata and all unrelated files.

| Accepted requirement | Missing work / planned evidence |
|---|---|
| Editable mathematical data and revealable exercise | Bounded G(s)=g/[s(s+a)], C(s)=K(1+τz s)/(1+τp s); visual scalar coefficients, channel/frequency predictions and feedback |
| Bode/Nyquist cursor and selectable crossings | Explicit G,L,T selection, frequency cursor and marker selection; physical rad/s units, phase and magnitude constructions on computed curves |
| All relevant margin crossings, infinite/undefined distinction | Complete bounded crossover equations, root-count/isolation and numerical residuals; proper scalar/lead/lag family, no sampled-search completeness claims; singular/DC cases clear |
| Closed-loop resonance/bandwidth markers | Stable closed-loop channel only; enumerate all relevant stationary and −3dB crossings, explain DC-relative bandwidth, compare against open-loop specifications |
| Course C0/C1 variation, Kv invariant | C0=4, C1=4(1+.7071067812s)/(1+.3535533906s), PM≈51.827→64.471deg and Kv=2; independent analytic fixtures |
| Scope, lifecycle, failure and browser checks | Stateless local math; shared visual equation API and native-number reader; owned child-signal failure cleanup tests; project and real private-browser checks |

Source provenance: TASK/atlas and repository audits were inspected; original decks outside Git were not. The explicit C1 coefficients are recorded in the atlas CD05 check and are rounded course values, not newly claimed exact irrational coefficients. Proposed lag/degeneracy cases will be labeled independently derived fixtures.

Planned scope retains the full accepted frequency exercise within a real proper first-order compensator and an integrating second-order plant. Positive bounded g,a,K; nonnegative bounded time constants, with static compensation allowed. Algebraic crossing/root methods must distinguish complete counts from ill-conditioned approximations. Default/reset stays the course C0 fixture. Shared libraries, shell, dependencies, version and deployment are outside this contribution. No shared math service exists beyond README; local private helpers can support this bounded contract without a dependency request.

## Setup and next action

Atomic own claim and fresh managed worktree at exact primary baseline; unique branch recorded in the claim/private ledger. Locked dependencies installed with bundled Node24. Next: derive/test complete bounded crossover, closed-loop and resonance/bandwidth mathematics, then implement the student flow and verify the actual browser. This early checkpoint is recoverable planning, not completion.

## Mathematical checkpoint (29 October 2026, 15:56UTC)

Private `algebra.ts`, `roots.ts`, `math.ts` and local tests now implement the bounded frequency calculations. Exact rational Sturm sequences first remove repeated factors, then count/isolate all distinct positive roots of degree≤3 equations. DC roots are separate. Isolation has220-step/depth and1500-work bounds; distinct numerical markers closer than relative10^-10 or insufficient residual/precision receive explicit errors. Curve samples do not establish crossing completeness. The scalar grammar now permits12 decimal places, preserving the atlas C1 coefficients; reduced denominators remain≤10^18 and numeric magnitudes≤100.

The backend derives gain/phase equations, exact closed-loop Routh classification, Kv, all stationary points and −3dB candidates, and G/L/T frequency values. Stable performance markers are withheld for unstable/boundary models and near-pole conditioning. Exact static compensator cancellation is distinguished from near equality. Baseline PM51.82729237deg, resonance sqrt2 with peak2/sqrt3, bandwidth sqrt(2+2sqrt5), lead PM64.47122063deg atω2, sameKv2, and independent finite-GM lag stable/boundary/unstable fixtures pass.

Checks: `node node_modules/vitest/vitest.mjs run src/modules/cf04`36 tests pass; `npm run check`passes. These are private math checks only. The workspace remains a scaffold: student inputs/plots/cursors/attempt/reveal, lifecycle/flow checks, full project test/build and actual browser QA still remain. This checkpoint does not mark the accepted exercise implemented.

## Exercise implementation checkpoint (16:07UTC)

The owned view now has five actual visual scalar fields, course/proposed presets, channel/Kv predictions and reveal, rational model/stability equations, all L margin rows and constructions, stable T peak and all bandwidth contacts with direction, held comparison, G/L/T selection, computed marker selection and linked numeric/clickable Bode/Nyquist cursor. Curves use241 logarithmic samples plus specification/cursor points; exact root isolation determines specifications. Nyquist has equal axis scales, unit circle/−1 reference for L, separate negative-frequency and held styles, clipping/gaps at supported singularities, and no formal winding claim. Native bounds/underflow feedback uses the shared reader; result listeners are aborted on replacement. Scoped grid/local scroll containers and synchronous child-signal lazy mount are in place.

Updated checks:51 module tests pass (37 math/root/parser,8 exercise flow,6 deferred lifecycle including partial resource-then-throw cleanup). `npm test`711 tests/30 files pass; `npm run check`, `npm run build` and `git diff --check`pass. Existing MathLive chunk advisory only. Browser QA still remains; mock-editor flow tests are not browser evidence. Current stage stays in-progress until real equation/keyboard/fonts, changing data, reset/navigation, pointer cursor and narrow-screen checks pass. No PR or final submission yet.
