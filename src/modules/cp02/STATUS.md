# CP02 implementation status

- **Stage:** in-progress
- **Assessed:** 2026-10-29; starting primary-main revision `0b199d44b5a83d2c4fbf08e3e7c8dec1117da31d`.
- **Worker chat:** `01a18701-1ec8-7073-a23f-e744d40a5355`.
- **Ownership/branch:** `src/modules/cp02/**`; `codex/cp02-pole-zero-modes-01a18701`; claim `worker-cp02-01a18701`.
- **Worktree:** `C:/Users/baokh/.codex/worktrees/cp02-modes-01a18701/CSDKTD APP`.
- **Contract:** [TASK.md](TASK.md), atlas CP02 and continuous source audit P1.

## Requirement audit before implementation

The current mount is empty and no module-owned tests exist. Metadata, baseline preview and lazy lifecycle are already available and will be preserved.

| Accepted requirement | Missing work / intended evidence |
| --- | --- |
| Match real/repeated/conjugate modes | Editable monic quadratic denominator with analytical roots; mode prediction/check and weighted modal decomposition |
| Same poles, changed zeros | Linear/constant numerator, LHP/RHP zero presets at equal DC gain, held response comparison and explicit rejection of the same-poles/same-response misconception |
| Pole dragging with conjugate pairs | Computed draggable pole plane, conjugate linkage and numeric coordinate alternatives; invalid candidates preserve the previous valid model |
| Denominator lock and zero movement | Lock pole edits while moving the real numerator zero; optional DC-gain preservation and bounded zero drag/numeric entry |
| Initial direction, modal weights, full response | Zero-state unit-step response with y(0+)=0 and y'(0+)=b1; computed constant/exponential/sine/Jordan/polynomial terms and full trace |
| Cancellation and stability qualifications | Exact rational common-factor reduction; retain the explicitly declared original canonical realization; separate original internal and reduced-channel BIBO labels |
| Visual input, validation and limits | Shared visual scalar coefficients, bounded rational parser, current shared native-number guard, explicit roots/zero/horizon/conditioning limits |
| Lifecycle, tests and real browser | Fresh mount state, abortable events/drag resources, local styles, independent fixtures and project/browser checks |

## Chosen bounded domain

G(s)=(b1*s+b0)/(s²+a1*s+a0), real SISO, zero initial state, unit-step input, no feedback. The original realization is explicitly the controllable canonical A=[0,1;-a0,-a1], B=[0;1], C=[b0,b1], D=0; internal stability refers to this retained realization, not to an unspecified physical system. Rational coefficient entries have bounded decimal/simple-fraction grammar. Coefficients are bounded by 100, |a1|<=20, poles have magnitude <=10 s^-1, nonzero pole magnitude >=0.001 s^-1, and distinct poles require separation >=10^-6. Exact zero and repeated roots are supported separately. Finite zeros lie within the displayed +/-10 s^-1 range; a constant numerator has no finite zero. Time horizon is bounded and excessive exponential growth is reported. Numerical modal/step evaluation will be distinct from exact algebraic cancellation.

## Independent fixtures and source distinctions

Baseline G=4/(s²+2s+4) has poles -1 +/- sqrt(3)j and zero-state step y=1-exp(-t)[cos(sqrt(3)t)+sin(sqrt(3)t)/sqrt(3)]. Compare b1=+2 and -2 while b0=4 and the denominator remain fixed: zeros -2/+2, identical DC gain 1, initial slopes +2/-2, different modal sine weights. Other proposed checks: 2/[(s+1)(s+2)] gives (1-exp(-t))²; 1/(s+1)² gives 1-(1+t)exp(-t); 1/[s(s+1)] gives t-1+exp(-t); 1/s² gives t²/2. Exact cancellation (s-1)/[(s-1)(s+2)] gives a stable scalar step despite the retained canonical realization's unstable eigenvalue. Near cancellation must remain uncanceled.

Read current primary coordination guides/diffs, assigned TASK/STATUS/source, contribution/development/design/equation guidance, matching atlas and source audit context. Original decks remain outside Git and were not newly inspected. Additional fixtures above are proposed analytic checks, not claimed slide transcriptions. The shared native-number helper exists in this fresh baseline and will be imported directly. No shared math API/dependency change is required.

## Math checkpoint — 2026-10-29

Private exact-rational algebra and bounded closed-form step/modal evaluation are implemented. The 32 module math checks pass using `node node_modules/vitest/vitest.mjs run src/modules/cp02/math.test.ts` with Node 24.22.1. They cover the independent formulas above, changed zero signs/weights, exact and near cancellation, origin/Jordan modes, paired pole edits, rejection of ill-conditioned traces and finite-domain limits. Visual scalar grammar accepts a single number or simple numeric fraction (including compact/mixed-brace fraction arguments), and rejects mixed-number adjacency, signed/grouped/nested variants and explicit arithmetic rather than interpreting their displayed meaning incorrectly. UI, project-wide and browser checks remain pending. Nonzero individual pole real/imaginary components and finite zero locations are bounded below by 0.001 s⁻¹; this is stricter than just bounding pole magnitude.
