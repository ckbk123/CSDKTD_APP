# DF04 implementation status

- **Stage:** in-progress (initial requirement audit; implementation and verification pending)
- **Assessed:** 2026-10-29, starting primary main `c45512eb7cd4f52f5f4d5f1ed5e96f546c447a6e`
- **Owned scope:** `src/modules/df04/**`; [accepted contract](TASK.md)
- **Worker chat:** `01a186d1-a367-78f1-98f5-e1cf147ef306`
- **Branch:** `codex/df04-sample-period-01a186d1`
- **Worktree:** `C:\Users\baokh\.codex\worktrees\df04-sample-period-01a186d1\CSDKTD APP`
- **PR:** not opened yet

## Initial inspection and bounded exercise

The owned folder has metadata and a blank synchronous mount, with no module calculations, controls or tests. Primary was clean in DF04 when atomically claimed. This fresh worktree starts from current committed main at the claim, excluding preceding unmerged worker contributions. Metadata, shell, identity and unrelated modules will be preserved. Locked npm ci with supported Node24.22.1 completed with zero vulnerabilities. No shared helper/API or dependency change is required: use the existing stateless native-number reader and shared visual equation components directly.

Implement the complete comparison exercise for a declared physical SISO first-order family G(s)=g/(tau*s+1), g>0,tau>0, proportional negative unity feedback and zero-order-held control u[k]=K*(R-y[k]). The same plant, output initial value, reference step and seconds horizon apply to every compared case. Several T values have visibly distinct fixed-K and redesigned-K policies. Redesign maps a chosen physical decay rate lambda to q_target=exp(-lambda*T), then derives K_T=(a-q_target)/b from a=exp(-T/tau), b=g*(1-a). This changes K and generally the steady tracking bias; it must not claim identical final value or generic optimal design. Lambda must permit nonnegative K. The sample-to-sample model is discrete LTI; the whole clocked sampled/held system is not called ordinary continuous-time LTI.

| Accepted requirement | Current evidence | Required implementation/check |
|---|---|---|
| Edit physical model/task | Metadata only | Shared visual first-order plant input; native reference/initial state/common horizon/gain/rate/three T values; bounded parser |
| Compare several T values | None | Temporary cases sharing one physical task; label T, fixed/redesigned policy, actual K, complete scalar pole and validity |
| Student attempt/reveal | None | Predict unit-disk stability and appropriate error accumulation before checked computations |
| Fixed versus redesign reasoning | None | Show a,b,q,target,K equation and actual trajectory/steady-error changes; no silent gain reuse |
| Common seconds horizon | None | Exact physical hold updates and terminal observation at common H; explicit partial final interval |
| Weighted error/effort | None | Left-rectangle ISE/IAE/ITAE using actual interval weights; raw error sum alongside ISE; ZOH control energy; no terminal double count |
| Visual reasoning | None | Common-time output/control plots, sampled/held/reconstructed distinctions, case legends and per-interval numerical contributions |
| Changed data/failures | None | Changed plant/K/T/initial/reference/rate, impossible redesign, near-boundary/unstable, finite growth and input/resource feedback |
| Lifecycle/accessibility | Shell only | Mount-local cases/drafts, synchronous loading/guarded deferred view and abort cleanup; actual keyboard/reset/reopen/fast navigation/fonts/phone |
| Delivery | None | Independent fixtures, module/type/full/build checks, reserved actual browser gate, one attached PR and exact clean tested pushed claim |

## Conventions and proposed limits

Time is seconds; R,y,e use normalized output units, u normalized input units. g maps input to output, tau is seconds and K maps output error to input. A step is applied at t=0 with common y(0). Each tick reads y[k], computes e[k]=R-y[k] and holds u[k]=K e[k] until the next tick. The physical update over delta seconds is y_next=exp(-delta/tau)*y+g*(1-exp(-delta/tau))*u. There is no extra input/state delay, saturation, integral controller, hidden memory or cross-module handoff.

Intervals cover [0,H) exactly with delta=min(T,H-t_k). Left-rectangle ISE=sum(delta*e_k^2), IAE=sum(delta*abs(e_k)), ITAE=sum(delta*t_k*abs(e_k)). If H is a multiple of T, ISE=T*sum(e_k^2). Show the differently scaled raw sum for diagnosis. Control energy sum(delta*u_k^2) is exact for the declared held control up to floating arithmetic. Error indices approximate the physical error integral and are not called exact. H is a terminal observation, not an extra weighted control interval. Samples alone do not establish intersample motion; any optional reconstruction must explicitly use the continuous plant/hold.

Proposed bounds to validate/freeze: g .05–20,tau .01–10s,K0–100,R .1–10,abs(y0)<=10,lambda .01–100s^-1,T .001–10s,H .01–60s,at most2000 intervals/case and six cases. Require T/tau<=30 and lambda*T<=30 for a redesigned case to retain a resolvable positive exponential. Reject nonnegative-gain redesign when lambda<1/tau. Declare finite trajectory/accumulation limits; a truncated case cannot masquerade as a common-horizon result. This is local numerical computation, not arbitrary-order tuning or a general CAS.

## Independent fixtures and provenance

Read current primary coordination guides, contribution/development/design/equation guidance, atlas DF04 and discrete audit quality/sample-period cautions. Original slides were not reinspected. DF04's interface is explicitly a proposed synthesis based on S12–15 sample-period tasks and Ch8 quality. These fixtures are independently derived, not claimed source-slide answers:

- Baseline g=tau=R=1,K=2,y0=0:a=exp(-T),b=1-a,q=3exp(-T)-2 and stable y_infinity=2/3. AtT=.1 q≈.7145122541;T=.5 is negative/inside;T=1.2 is outside. Strict fixed-gain stability is0<T<ln(3).
- T=ln(2):a=b=.5,q=-.5; y at0,T,2T,3T is0,1,.5,.75 and held controls2,0,1. AtH=3T raw squared error1.25,ISE1.25T,IAE1.5T,ITAE T^2,control energy5T. Terminal y=.75 has zero quadrature weight.
- Same T,H=2.5T:final interval weight.5T,terminal y=1-.5/sqrt(2),ISE1.125T,control energy4.5T,with a genuinely common endpoint.
- Redesign lambda=2,T=ln(2):q_target=.25,K=.5 and y0=0 gives0,.25,.3125,.328125. Steady output1/3 differs from fixed-gain2/3. Over3T,ISE2.03515625T and control energy.5087890625T.
- K=0,y0=0,R=1,H=1:output/control remain0;ISE=IAE=1 forT=.1,.2,.3 (last includes partial interval),while raw squared-error sums are10,5,4.
- g=2,tau=.5,K=1,T=.5ln(2) preserves q=-.5 and baseline y samples but halves controls and quarters squared effort. Reference/initial changes must match independent closed form y_n=y_infinity+(y0-y_infinity)*q^n when finite.

## Next work and verification state

Initial audit/setup only. Implement pure mathematics and bounded visual parsing, check independent fixtures/failures, then finish prediction/comparison UI and actual browser gate. No module tests, type check, full tests, build or browser behavior is claimed yet. Earlier submitted DD04/DP04 branches/worktrees remain frozen; coordinator corrections take priority. DP02 has been independently accepted as0.3.7 with its source history preserved. No browser slot/tab/preview/viewport override is held.

## Mathematical checkpoint

`math.ts` now validates the first-order physical model/task, derives exact ZOH coefficients and the complete scalar closed-loop pole, matches a physical-rate target with a cancellation-resistant exponential difference, and simulates each held interval through a common terminal H. Raw/ISE/IAE/ITAE/effort sums use compensated accumulation; terminal observations receive no extra weight. Physical reconstruction evaluates the declared plant/hold analytically instead of interpolating samples. Boundary/unstable cases do not claim a steady limit.

The proposed scalar/model/time/work limits above are enforced. Output/error/control magnitude is bounded by10^12, accumulated metrics by10^28 and redesigned target-pole relative matching residual by10^-7. A failed/growing case throws without reporting partial common-horizon metrics. Unit-disk classification uses a declared10^-9 boundary band. The UI must expose these limits and handle failures per case.

`npm test -- src/modules/df04` passes10 independently derived fixture/failure groups; `npm run check` passes. This includes every audit fixture, common-horizon partial holds, changed units/reference/initial output, physical intersample values, impossible/redesign conditioning, unstable growth and excessive work. Parser/UI/lifecycle, full-project/build and real-browser checks remain unimplemented/unperformed. The prior paragraph describes the initial audit stage, not the current mathematical checkpoint.

## Visual parser checkpoint

`input.ts` now parses a constant numerator over a linear real polynomial in s, normalizing only its constant denominator scale to obtain g,tau. It supports decimals, compact/signed/nested fractions, visible parentheses, polynomial arithmetic and literal powers0–2 before enforcing the first-order physical family. It does not cancel factors or accept rational sums, e/E symbols, hidden grouping, mixed-fraction adjacency or ambiguous one-atom TeX exponent tails. Semantic checks run independently of editor syntax feedback. The private parser carries forward tested bounded normalization techniques from this worker's earlier work, with no runtime sibling import or shared-file change.

Input limits:512 source characters,128 expanded tokens,eight logical visible grouping/fraction levels, normalized nesting32, intermediate degree4 and coefficient magnitude10^12. Nonzero literal/product/quotient/normalization underflow is rejected; positive g/tau bounds then validate the physical model. `npm test -- src/modules/df04` passes51 cases in2 files (10 math,41 parser); `npm run check` passes. The interface/lifecycle, full-project/build and actual MathLive/browser gates remain unfinished. No browser slot or preview is held.
