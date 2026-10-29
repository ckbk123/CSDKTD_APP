# Control Studio changelog

Versions identify accepted application integrations, not worker checkpoints or hosting deployments. The coordinator assigns patch releases serially under [the version policy](docs/COORDINATION.md#version-policy).

## 0.3.10 — 29 October 2026

- CF02: predict and derive steady-state error for reference, plant-input disturbance and sensor noise, distinguish comparator and physical tracking errors, and compare exact limits or polynomial asymptotes with a qualified numerical trace.
- Accept [PR #18](https://github.com/ckbk123/CSDKTD_APP/pull/18), source `c7ab0f85a0dcb2eb074fe87826b6116145d214bd`, with independently checked channel mathematics, bounded visual entry and initialization cleanup. All 877 application tests, 32 coordination tests, type checking, production build and desktop/phone browser checks pass.
- Fix shared equation-editor Escape handling so a later preset remains editable and parseable. Seven focused regressions and actual Escape→preset/fraction-entry checks pass.
- Record the human's stop-after-current amendment for the ten workers and provide a finite, portable contribution prompt for outside contributors. Unmerged submissions and known review findings remain explicit handoffs.

## 0.3.9 — 29 October 2026

- Correct deferred workspace cleanup in DS03, DP01, DS02 and DP02. Each visit owns a child abort signal; partial mounting failures and explicit disposal immediately release listeners/editor resources, including a disposer returned during an abort.
- Add 19 lifecycle regressions. All 660 application tests, 32 coordination tests, type checking and production build pass. Actual browser checks cover default results, changed examples, reset and navigation in all four tools.
- Remove the unnecessary global QA queue for verified private per-chat browser sessions. A controlled two-chat check confirmed disjoint tab inventories and independent viewport sizes. The worker goal/guides now allow parallel testing in those contexts and reserve only genuinely shared controls; the observed Firefox control limitation remains documented.

## 0.3.8 — 29 October 2026

- DD04: derive a digital PID from integration/differentiation rules, compare positional and incremental arithmetic, predict outputs, and explicitly commit each memory update. Includes separate initial/filter memory, changed sampling periods and causal-rule feedback.
- Accept [PR #9](https://github.com/ckbk123/CSDKTD_APP/pull/9), source `6e1434aaf1b6c292bb6df409ac04fa2da6403c41`, with [independent mathematical and browser evidence](src/modules/dd04/STATUS.md). The coordinator applied the shared native-number reader, preserving optional prediction and disabled-field semantics, with 16 added UI regressions.
- All 641 application tests, 32 coordination tests, type checking and production build pass. Production checks cover baseline/changed-period outputs, filtered derivative memory, actual fraction entry, underflow recovery, explicit commit timing, narrow keyboard scrolling and fresh visits. This tool executes a supplied error sequence; it does not simulate a plant or certify closed-loop performance.

## 0.3.7 — 29 October 2026

- DP02: map a continuous pole/conjugate pair into the z plane, predict period-dependent radius changes, inspect modal samples and choose inverse-log branches to understand frequency aliasing.
- Accept [PR #3](https://github.com/ckbk123/CSDKTD_APP/pull/3), source `f6c7b7414e5990bca9a573f58337f9a0ee9c0f5e`, with [independent mathematical and browser evidence](src/modules/dp02/STATUS.md). The coordinator applied the shared native-number reader while preserving decimal visual entry and bounds.
- All 529 application tests, type checking and production build pass. Fifteen added UI regressions cover native inputs; production checks confirm changed-period geometry, branch selection, aliasing, alternating decay, narrow layout and fresh visits.
- Agent guidance now makes exponent token boundaries and synchronous loading-node ownership explicit, following independent review and actual browser findings.

## 0.3.6 — 29 October 2026

- DS01: edit discrete poles, predict internal and channel stability, inspect geometric/Jordan sequences and real state blocks, and compare semisimple boundary modes with hidden unstable states.
- Accept [PR #10](https://github.com/ckbk123/CSDKTD_APP/pull/10), source `c88acd370dd27f527f5478a048a6c908321f7177`, within its declared one-to-four pole-row / 24-real-state bounds. [Independent mathematical and browser review](src/modules/ds01/STATUS.md) records the distinction between bounded free motion and BIBO stability.
- All 440 application tests, type checking and production build pass. The coordinator's native period/horizon adaptation adds four regressions; actual editor controls, changed examples, narrow keyboard scrolling and cross-module cleanup passed production checks.

## 0.3.5 — 29 October 2026

- Correct visual notation in DP01, DS02 and DS03. Ambiguous mixed numbers and hidden brace arithmetic receive guidance to use explicit operations or visible parentheses. Supported ordinary fractions, powers and explicit arithmetic retain their meaning.
- Independent controls distinguish 2+1/2 from 2×1/2: the Jury family z²+bKz+.2 has bounds ±12/25 for b=5/2 and ±6/5 for b=1. Actual equation-editor checks confirm the distinction; desktop/narrow layout and cleanup checks pass.
- All 344 application tests, type checking and production build pass, with 69 additional independent parser probes. The unchanged coordination helper's 32 tests passed in 0.3.4. [Review evidence and pending worker returns](docs/COORDINATOR_REVIEW_LOG.md#visual-notation-correction--035) remain separate from accepted releases.

## 0.3.4 — 29 October 2026

- CS01: edit a two-state continuous realization, predict internal and scalar BIBO stability, inspect exact transfer cancellation and eigenmodes, and compare hidden unstable states, imaginary-axis pairs and Jordan boundaries.
- Accept [PR #8](https://github.com/ckbk123/CSDKTD_APP/pull/8), source `75d3528d20f62d082a3151d6a734a4fe237589bd`, with [independent review and production-browser evidence](src/modules/cs01/STATUS.md). All 254 application tests, type checking and production build pass. Native state/horizon controls use the shared underflow guard with 11 new regressions.
- Final worker submissions must identify the clean exact worktree HEAD; older checkpoints and dirty corrections cannot be submitted as finished. Active checkpoints/partial handoffs remain recoverable. The helper has 32 passing coordination tests. Continuous workers still open one PR per module and immediately claim their next eligible task within their configured budgets.

## 0.3.3 — 29 October 2026

- DS02: build mirrored Jury rows, check a predicted strict gain interval, inspect the exact inequality intersection and boundary roots, and compare the .2K/.1K worksheet families. The supported domain is explicitly monic quadratics affine in K.
- Accept [PR #4](https://github.com/ckbk123/CSDKTD_APP/pull/4), source `d394a81d46ae3602284e8f6f4d2a9e4dd2d8c964`, with [independent review evidence](src/modules/ds02/STATUS.md). All 203 combined application tests, type checking and the production build pass; the unchanged coordination helper has 28 passing tests.
- Add a shared native-number reader and apply it to DP01/DS03. Nonzero entries such as `1e-999` receive feedback instead of becoming zero; intentional zero and representable numeric exponent entry remain valid. Independent review and real-browser regressions cover the change without altering visual-equation parsing or mathematical bounds.

## 0.3.2 — 29 October 2026

- DP01: edit first- or second-order discrete transfer functions; compare step, impulse, ramp and free responses with initial history, sample stems, arithmetic and modal reasoning. Equal-radius mode comparisons distinguish alternating and oscillatory sequences.
- Accept [PR #6](https://github.com/ckbk123/CSDKTD_APP/pull/6), source `cccba1dc6f0d0469afd9923d3f058220fa5c2a2c`. Supported domain, timing, numerical bounds and review corrections are recorded in [DP01 status](src/modules/dp01/STATUS.md).
- Independent sequence/convolution fixtures and all 134 combined application tests pass, alongside type checking and the production build. The unchanged coordination helper has 28 passing tests. Release browser evidence is recorded in the module status.
- Clarify that visual parsers must preserve MathLive's displayed meaning, including compact fractions and unary signs; programming-language e/E literals must not silently change a visible expression.

## 0.3.1 — 29 October 2026

- DS03: edit a monic quadratic family affine in K, map the unit disk to a half-plane, follow the bilinear substitution and Routh rows, and derive the complete strict gain interval. Endpoint checks retain z=-1 at infinity and vanishing leading coefficients.
- Accept [PR #2](https://github.com/ckbk123/CSDKTD_APP/pull/2), source `9c39403f72273a65c608f58b134a1a291bc84b38`. Scope is quadratic affine-gain families; coefficient, numerical and plotting limits are documented in [DS03 status](src/modules/ds03/STATUS.md).
- Independent review checked 805 family/boundary cases and 1,680 complex mappings, including the corrected near-minus-one cancellation case. All 83 application tests, 28 coordination tests, type checking and production build pass. Real-browser production evidence and integration results are recorded in the module status.

## 0.3.0 — existing scaffold baseline

- Compact Control Studio interface, version/author identity, 56 independent module routes and fresh per-visit workspaces.
- Shared visual equation input and typeset examples through locally bundled MathLive.
- Atomic local module claims, isolated worker protocol and per-module acceptance/progress records.

This records the baseline before the ten-worker integration batch on 29 October 2026. It does not certify any exercise solver or claim a hosted deployment.
