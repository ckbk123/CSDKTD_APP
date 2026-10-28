# Discrete SISO LTI exercise audit

Revised 28 October 2026 around the instructor's five blocks: **System Representation, Plots, Stability, Performance and Controller Design**. The entries are exercise families and interaction requirements, not independently approved application features.

## Evidence and scope

The audit inspected the actual text and equation nodes in source chapters 7–9, their existing normalized-text corpus and slide maps, current sessions 12–15, and the corresponding individual/group worksheets. Selected original embedded equation images were also inspected, including chapter 7 slide 26, chapter 8 slides 16/34/39, and chapter 9 slides 14/22/28/57. A white background was used to read transparent equation assets. This does not constitute a visual reconstruction of every diagram or equation on every source slide.

All locators below are one-based slide numbers, including covers. `CH7:26` denotes `Tài liệu/Chuong7_CSTD_Unicode_DayDuCongThuc.pptx`, slide 26; similarly for CH8/CH9. `S12:8` denotes `Tai_to_chuc_bai_giang/slides/Buoi_12_CSDKTD.pptx`, slide 8. Worksheet paths are relative to the parent course directory. Source exercise numbers are used only when their text actually identifies one. **Current** means explicitly developed in the 15-session sequence. **Source** means present in the longer original decks but condensed or omitted from the current sessions. **Bridge** denotes a proposed exercise assembled from course concepts rather than an existing worked problem.

The plant/controller under study remains SISO LTI. A vector of internal states does not make a system MIMO: `B` has one column, `C` one row and `D` is scalar. Multiple exogenous signals are analyzed through a selected scalar channel, using superposition where appropriate. Saturation, anti-windup, switching, nonlinear plant linearization, adaptation and general multi-rate interconnections are outside this revised scope.

A continuous plant with sampler and ZOH is not, as a whole, an ordinary continuous-time LTI system. With a fixed sample clock and a declared hold, its sample-to-sample equivalent can be discrete LTI. Sampling/conversion therefore belongs to a controlled **Representation bridge**, with its assumptions attached. Integer delays and pure transport delays need an explicit support policy: SISO LTI alone does not imply a finite-dimensional rational model.

## System Representation

### DR1 — Derive a Z transform and recover a sequence

**Evidence:** CH7:9–14 introduces definition, meaning, properties and basic transforms. S12:5 introduces sequences and consistent `z`/`z^-1` notation. **Current foundation; Source for a broader table exercise.**

**Student task:** form the transform of a causal sequence, use a shift/scale property, or recover the first samples from a rational expression. For a prepared geometric sequence, identify the pole and region of convergence instead of treating the formula alone as the complete transform.

**Visualization:** index slider, sequence stems, the selected transform pair, a delay arrow and highlighted powers of `z^-1`. Students commit to the first few samples before revealing them. A partial-fraction view connects each term to its sequence.

**Check and diagnosis:** for causal `x[k]=a^k`, show `X(z)=z/(z-a)` with `|z|>|a|`. A shift must preserve the declared unilateral/bilateral and initial-condition convention. The same rational expression can represent different sequences under different regions of convergence. A course-focused unilateral zero-state default is acceptable if named consistently.

### DR2 — Convert recurrence, transfer function and delay diagram

**Evidence:** CH7:16–18 contains a worked recurrence-to-transfer task; CH7:32–42 develops state equations from recurrences. S12:5 and S14:5,8,14 explicitly demand sample indexing and old-memory arithmetic. **Current.**

**Student task:** normalize a recurrence, isolate the present output, derive its transfer function under zero initial conditions and draw a realizable unit-delay structure. Recover the recurrence from either `z` or `z^-1` notation.

**Visualization:** equations, delay cells and a sample-history table share highlighting. Each multiplication highlights the old sample used; memory updates happen only after the current result is calculated. A toggle deliberately reverses coefficient order or updates memory early for a debugging exercise.

**Check and diagnosis:** use the S14 recurrence `u[k]=u[k-1]+14.1e[k]-23.9e[k-1]+10e[k-2]`. With `e[0]=0`, `e[1]=e[2]=1`, `u[0]=0` and prior history zero, `u[1]=14.1`, `u[2]=4.3`. Its zero-state transfer function is `(14.1z²-23.9z+10)/(z²-z)`. Nonzero initial memory adds a separate response; multiplying both numerator and denominator by a power of `z` changes notation, not the physical system.

### DR3 — Derive a fixed-period ZOH equivalent

**Evidence:** CH7:7–8,19–29,43–49; S12:4,6–11,14; `giao_an/phieu/Phieu_ca_nhan_Buoi_12.md`. **Current.**

**Student task:** discretize `G(s)=1/(s+1)` first at `T=0.1 s`, then solve the worksheet variant `T=0.2 s`. Extend the same method to the common two-state mechanical plant. Compare the exact samples, not just two continuous-looking lines.

**Visualization:** hold staircase, continuous output, sample markers, `A_d=e^(AT)` and `B_d=∫exp(Aτ)B dτ`, plus first-sample arithmetic. Changing plot density must leave sample instants unchanged.

**Check and diagnosis:** the scalar recurrence is `y[k+1]=a y[k]+b u[k]`, `a=e^-T`, `b=1-a`. At `T=.2`, `a≈.818730753`, `b≈.181269247`, and the first unit-step sample equals `b`. The original/current `T=.1` samples are approximately `.095163,.181269,.259182`. Use a matrix-exponential construction that works for singular `A`, rather than relying solely on `A^-1(A_d-I)B`.

### DR4 — Reduce sampled block diagrams with explicit sample locations

**Evidence:** CH7:19–29 has three named block-diagram examples. CH7:26–29 adds a discrete controller, hold, continuous plant, feedback and transport delay. **Source, building on current S12.**

**Student task:** identify which continuous cascades lie between sample/hold boundaries, obtain the correct pulse transfer function, derive the controller transfer from a recurrence, then close the scalar loop. Convert the resulting discrete diagram to a signal-flow graph and apply the same structural Mason logic used in the continuous branch.

**Visualization:** sample/hold boundaries are first-class objects, with units and signal domains on each wire. Selecting an aggregation highlights the continuous group being discretized. A delay marker moves the sequence by an integer number of samples.

**Verified original inputs:** CH7:26 contains `G(s)=5 exp(-0.2s)/s²`, `H(s)=0.1`, `T=.2 s`, and `u[k]=10e[k]-2e[k-1]`. For the separately declared ZOH plant path, one sample of delay gives `G_d(z)=.1(z+1)/[z(z-1)²]`; the controller is `10-2z^-1`. Check the original diagram's exact sampler arrangement before adopting its full closed-loop answer as a fixture.

**Check and diagnosis:** generally `Z{g*h}` is not the product of separately sampled transforms. The app cannot discretize every visible continuous block independently when no sampler separates them. Noninteger `τ/T` requires an explicit exact augmented model or declared approximation; it is not automatic rounding to the nearest sample. Same-clock rational discrete diagrams can reuse the structural converter, but their semantics differ from an arbitrary hybrid diagram.

### DR5 — Construct a SISO discrete state realization and recover its transfer function

**Evidence:** CH7:30–42 and 50–51; S12:6–11; S15:7–8. **Current for state model, Source for more realization variants.**

**Student task:** choose states from delays, fill `A_d,B_d,C_d,D_d`, and verify `G_d(z)=C_d(zI-A_d)^-1B_d+D_d`. Compare two valid coordinate choices or a recurrence and state simulation under matched initial conditions.

**Visualization:** drag a delay signal into a state slot, highlight the corresponding matrix row, and animate one simultaneous state update. A realization with the same transfer function can have different state coordinates or hidden modes.

**Check and diagnosis:** enforce scalar input and output while allowing multiple states. Verify dimensions, causality, direct feedthrough and initial-state mapping. A transfer-function conversion preserves zero-state input–output behavior; it does not prove that two arbitrarily initialized realizations have identical trajectories. CH7:32–39 distinguishes recurrence right-hand sides with and without delayed input terms, so a single naive state-choice recipe is insufficient.

## Plots

### DP1 — Read discrete modes and relate them to physical time

**Evidence:** S13:2,4,6,13–14; the individual S13 worksheet asks specifically about `z=-.8`. CH8:4–6 and 43–44. **Current.**

**Student task:** predict decay/growth, sign alternation and oscillation from a pole, then predict samples. Change `T` and distinguish samples needed from seconds elapsed. Map a stated continuous target with `z=e^(sT)`.

**Visualization:** a pole marker and radial/angular guides are synchronized with the mode stems, envelope and a time axis. A conjugate pair moves together for a real model.

**Check and diagnosis:** `(-.8)^k` decays and alternates sign even though the pole is on the negative real axis. For `z=r e^(jθ)`, decay is controlled by `r`, while frequency depends on `θ/T` with alias branches. The inverse logarithm has no unique continuous frequency without a branch restriction. A point on the circle requires multiplicity and stability-definition qualifications.

### DP2 — Construct exact discrete Bode and Nyquist representations

**Evidence:** CH8:32–35 gives exact frequency response; CH8:36–40 gives the bilinear mapping and approximate Bode example. S13:6 notes broader discrete analysis. **Source with Current introduction.**

**Student task:** evaluate the same `G_d(e^(jωT))` at selected frequencies, plot magnitude/phase, and compare the exact curve with the transformed-plane approximation. Explain the frequency range and units before sketching.

**Verified original expression:** selected equation assets on CH8:34 and 39 show `G_d(z)=(.0544z+.0493)/(z²-1.741z+.741)`. These are rounded display coefficients; locate the exact plant/period before using them as a high-precision fixture.

**Visualization:** a marker travels on the unit circle and simultaneously on the complex response and Bode axes. Switching among rad/sample, rad/s and Hz preserves the represented physical frequency. Overlay the transformed frequency with its nonlinear warping.

**Check and diagnosis:** evaluate complex frequency directly as the reference route. For real coefficients, use conjugacy and a declared unique-frequency interval; a positive-frequency trace is not the full discrete Nyquist stability contour. DC or a frequency pole may be undefined/infinite. The example denominator has a root at `z=1` at its printed precision, making a fabricated finite DC gain especially misleading.

### DP3 — Build and read the discrete root locus

**Evidence:** CH8:20–31, especially rules at 22–24 and the worked sketch/gain-boundary task beginning at 25. CH9:20 and 27 compare before/after compensated loci. **Source.**

**Student task:** locate open-loop poles/zeros, select real-axis segments, asymptotes and candidate break points, then derive/trace roots of the closed-loop characteristic polynomial as `K` changes. Place the unit circle on the same plot.

**Visualization:** staged construction overlays and angle/magnitude vectors precede the final locus. A gain cursor shows all roots and their corresponding modes/response. This is the plotting home; deriving the stable gain set belongs to Stability and reuses the same plot.

**Check and diagnosis:** the polynomial construction and angle/magnitude rules resemble continuous root locus, but the stability boundary is the unit circle. The original CH8:24 explicitly changes the boundary-crossing rule. Track branches by continuity, not independent sorting. A negative real part is not a discrete stability test.

## Stability

### DS1 — Derive a Jury gain interval and test every endpoint

**Evidence:** CH8:14–19; S13:5,7–11,14; `giao_an/phieu/Phieu_ca_nhan_Buoi_13.md`. **Current for quadratic, Source for full table.**

**Student task:** enter all quadratic Jury conditions, simplify their intersection and explain each excluded endpoint. Then change the worksheet coefficient from `.2K` to `.1K`. A full-table mode should expose the chosen ordering convention and every row operation for higher degrees.

**Visualization:** inequality intervals and a pole plot share a `K` marker. Hovering an inequality shows the roots approaching its associated boundary. Students enter an interval before using the sweep.

**Check and diagnosis:** `z²+(K-1)z+.2K` gives `0<K<2.5`, with roots `-1,-.5` at the upper endpoint. The worksheet variant `z²+(K-1)z+.1K` gives `0<K<20/9`. At `K=0` there is a root at `+1`; strict endpoints are excluded. A finite sweep does not establish an entire interval. CH8:16's embedded worked table has row `[5,2,3,1]`; coefficient direction must be established from the original equation before interpreting it. The independently checked leading-to-constant polynomial `5z³+2z²+3z+1` is a useful stable cubic variant, not a transcription claimed without that check.

### DS2 — Apply Routh after mapping the unit disk to a half-plane

**Evidence:** CH8:8–13, including the named extended Routh–Hurwitz example. **Source, not merely an optional generic method imported from elsewhere.**

**Student task:** declare a bilinear convention, substitute it into `p(z)`, clear denominators and build a Routh table in the transformed variable. Compare its gain interval with Jury and roots of the original polynomial.

**Visualization:** synchronized `z` and transformed planes, colored stability regions, substitution steps and the table. The mapping pole and its exceptional boundary point remain visible.

**Independent bridge fixture:** with `z=(1+w)/(1-w)` and `p=z²+(K-1)z+.2K`, the cleared polynomial is `(2-.8K)w²+(2-.4K)w+1.2K`. Its strict left-half-plane stability conditions recover `0<K<2.5`. At `K=2.5`, its leading coefficient vanishes, corresponding to the original root at `z=-1` mapped to infinity. This endpoint must be checked in the original polynomial rather than lost through degree reduction.

**Check and diagnosis:** conventions such as scaling by `2/T` alter coefficient values. Keep the chosen mapping visible and consistent. Do not run the continuous Routh algorithm directly on the coefficients of `p(z)`.

### DS3 — Find the stable feedback-gain range from unit-circle crossings

**Evidence:** CH8:24–31 asks for `K_gh`; S13:7–11 supplies a current parameter interval. **Source plus Current cross-check.**

**Student task:** use `z=e^(jθ)` or `z=a+jb, a²+b²=1` in the characteristic equation to find candidate boundary gains, partition the real gain line and check an interior point of every interval. Compare with Jury/extended Routh.

**Visualization:** unit-circle crossing markers, a complete gain-interval bar and all closed-loop poles. Clicking a boundary reveals the algebra that produced it. Distinguish a locus sketch from the stability conclusion.

**Check and diagnosis:** include `z=+1`, `z=-1`, complex crossings, multiple crossings and the declared sign/range of gain. A single “maximum stable K” field is insufficient if the stable set has several intervals. Cross-check all selected roots and do not infer a global result from one visually convenient branch.

## Performance

### DF1 — Compute sampled transient metrics from TF and state models

**Evidence:** CH8:41–44; the worked task CH8:46–54 requests closed TF, unit-step response, overshoot, settling and steady error. CH8:55–62 repeats the task through state equations at `T=.1`. S13:6–11. **Current with deeper Source variants.**

**Student task:** produce a response using both recurrence/state updates and a transfer representation, then locate peak and settling indices manually before checking. Compare the result in samples and seconds.

**Visualization:** stems, peak marker, final-value level and selectable 2%/5% band. An optional held or interpolated display is labeled as such. If the original continuous plant and hold are present, intersample reconstruction can be a separate view.

**Check and diagnosis:** report `k_s` and `t_s=k_sT` separately, state the band reference, and require remaining in the band. The last plotted sample is not proof of the final value. A higher plotting resolution does not change controller sample period. Without a continuous hold/plant model, an interpolated line does not establish the true intersample peak.

### DF2 — Derive discrete steady-state error and system type

**Evidence:** CH8:45 and 46–62; CH9:21–22 designs for a velocity-error constant. **Source with Current tracking comparisons.**

**Student task:** choose a reference sequence, derive `E(z)` for the declared loop/sensor and apply the discrete final-value theorem only after checking its conditions. Compare a sample-index ramp with a physical-time unit ramp.

**Visualization:** separate reference/output/error stems, highlighted factors at `z=1`, a limit calculation and measured long-run comparison. Keep the selected reference channel visible.

**Check and diagnosis:** `r[k]=k` and `r[k]=kT` are different inputs. For a physical unit ramp and an appropriate unity-feedback loop, define `K_v,d=lim_(z→1)(z-1)L(z)/T` to obtain `e_ss=1/K_v,d` under the relevant limit conditions. The lag example's printed target `K_v*=100` must use the source's normalization. A sensor gain changes the comparator error relation. Stable plant poles alone do not establish that the final-value theorem applies to the error.

### DF3 — Relate discrete frequency specifications to sampled responses

**Evidence:** CH8:33–40 and 43–45; CH9:12–13 and 28–32 connect desired transient parameters to discrete poles. **Source/Bridge.**

**Student task:** find bandwidth/resonance/margins for a selected scalar discrete loop and compare them with the sampled transient response; change `T` under a declared policy. Build a frequency-domain target while checking that it remains meaningful below Nyquist frequency.

**Visualization:** linked exact Bode/Nyquist cursor, sampled response, poles and requirement overlays. Show warped frequency alongside physical frequency when a bilinear design method is selected.

**Check and diagnosis:** changing `T` while keeping a discrete controller fixed is a different experiment from redesigning the controller at every `T`. Do not copy a continuous PM-to-overshoot approximation as an exact discrete relation. Display all relevant crossovers and undefined/infinite margins distinctly. Full discrete Nyquist stability mapping is a proposed companion exercise to course frequency analysis, not a claim that the original slides contain a complete worked discrete contour lesson.

## Controller Design

### DD1 — Design a discrete lead compensator by root-locus conditions

**Evidence:** CH9:11–20, especially the problem beginning at 14 and before/after locus at 20. S14:4,7 introduces an alternative route by controller discretization. **Source; distinct from simply applying Tustin to a continuous design.**

**Student task:** map a desired continuous-time transient pair into `z`, calculate angle deficiency at the desired point, place compensator zero/pole and determine gain from the magnitude condition. Verify every full closed-loop pole and the sampled response.

**Verified source inputs:** `G(s)=50/[s(s+5)]`, `T=.1 s`, target `ζ=.707`, `ω_n=10 rad/s`. The target pair is `z=exp[(-ζω_n±jω_n sqrt(1-ζ²))T]`. The app can compute these values rather than reading rounded diagram pixels.

**Visualization/check:** draggable target pair, angle vectors and a magnitude residual share the compensated locus. Verify the actual characteristic equation at the selected target. The real part of the target alone does not determine discrete stability. Keep the sampler/ZOH model and sample period attached to the plant.

### DD2 — Design a discrete lag compensator for a tracking requirement

**Evidence:** CH9:21–27. The source explicitly places a lag zero near `z=+1`, then derives the pole and gain. **Source.**

**Student task:** compute the required change in the defined velocity constant, choose a zero near `+1`, place the pole using the selected ratio and check angle/magnitude conditions and the full response. Compare steady error before/after against changes in transient behavior.

**Verified source inputs:** same `50/[s(s+5)]` plant and `T=.1 s`; target printed as `K_v*=100`. Preserve its units/normalization and verify the exact source formula before adopting a canonical worked answer.

**Visualization/check:** magnified neighborhood of `+1`, error-constant calculation, complete locus and transient comparison. “Near the origin” is the wrong continuous-to-discrete translation here; the relevant low-frequency point is `z=1`. An improved DC/ramp limit does not guarantee preserved transient quality or robustness.

### DD3 — Discretize an LTI controller and execute digital PID

**Evidence:** CH9:6–9; S14:4–11,14 and its individual worksheet. **Current.**

**Student task:** choose forward/backward Euler or Tustin for the relevant controller terms, derive `C(z)`, choose positional/incremental representation and compute the first outputs from a given error sequence. Change `T` and rederive coefficients.

**Visualization/check:** one panel names integration/differentiation rules; another shows the algebra, while the delay-memory stepper explains execution. For `Kp=4,Ki=2,Kd=1,T=.1`, trapezoidal integral and backward derivative give increments `14.1,-23.9,10`. At `T=.2`, those become `9.2,-13.8,5` under the same rules. The existing continuous lead maps through Tustin at `T=.1` to `(136z-104)/(13z-7)`. Retain the derivative filter if the continuous design contains one; the S14 unfiltered PID and S10 filtered PID are different LTI structures.

Saturation and anti-windup are excluded from this strict LTI tool. A predefined measurement-noise sequence can still be used as an input to a linear filtered controller; no nonlinear actuator model is implied.

### DD4 — Solve an analytic digital PID design by coefficient matching

**Evidence:** CH9:28–32. **Source.**

**Student task:** translate transient requirements into desired discrete poles, enforce the specified step-tracking property, form an actual closed-loop characteristic polynomial and match coefficients to the desired one. Detect inconsistent controller-order/target constraints instead of always producing numbers.

**Verified source inputs:** `G(s)=10/(10s+1)`, sensor `H(s)=.05`, sample period `T=2 s`, target `ζ=.707`, `ω_n=2 rad/s`, zero steady error for a unit step. Derive the actual loop/sensor error expression from the diagram; comparator error and physical output tracking are not automatically identical when `H≠1`.

**Visualization/check:** desired/actual coefficient columns, unknown controller parameters and residuals, followed by the complete pole set and sampled response. Mapping the desired pair is only the first step. Additional closed-loop modes, direct terms and the exact PID structure must be retained. This is a different exercise from manual tuning or continuous-controller emulation.

### DD5 — Test controllability, place discrete state poles and set tracking gain

**Evidence:** CH9:34–48; S15:4,7–11 and individual worksheet. **Current, with richer Source problems.**

**Student task:** construct the controllability matrix, check rank, calculate scalar-input feedback gain by coefficient matching for a small state model, then compute a reference multiplier and verify performance.

**Verified current fixture:** the common mechanical plant discretized at `T=.1` targets controller poles `.7,.8`, with displayed `K_d≈[4.956502,2.335770]`, `N_d≈6.956502`. Recompute from the exact discrete matrices. **Deeper original variants:** CH9:37 asks for targets defined by `ζ=.707,ω_n=10`; CH9:41 asks for a continuous-to-discrete state model at `T=.1`, feedback targets `ζ=.5,ω_n=8`, and subsequent unit-step response/overshoot/settling. Diagram matrices need final visual reconstruction before numeric fixture adoption.

**Visualization/check:** highlight coefficient matching, actual `eig(A_d-B_dK_d)`, state trajectories and scalar output/control. Several internal states remain SISO. Pole placement does not automatically give unity tracking, and a reference multiplier is an ideal-model tracking result. Numerical rank needs a tolerance/scaling explanation. Updating `T` requires revisiting both model and design.

### DD6 — Test observability and design a discrete Luenberger observer

**Evidence:** CH9:49–61, particularly the procedure at 56 and worked example at 57–59; S15:5,7–10. **Current.**

**Student task:** form the observability matrix, derive `det(zI-(A_d-L_dC_d))`, match observer-polynomial coefficients and compare true versus estimated state trajectories from different initial states.

**Verified source inputs:** selected images at CH9:57 give `A_d=[[.967,.148],[-.297,.522]]`, `B_d=[.231;.264]`, `C_d=[1,3]`; target observer poles are `.13,.36`. From these printed rounded matrices, independent coefficient matching gives `L≈[-.83745424;.61215141]`. This is a computed check for the rounded data, not an asserted transcription of the later solution slides. The current S15 fixture instead targets `.3,.4` and quotes `L_d≈[1.023568;1.498984]` for a different state model.

**Visualization/check:** measured scalar output, inferred vector state, innovation and estimation error are distinct. Show `eig(A_d-L_dC_d)` and error convergence in samples and seconds. The observer does not create additional sensor channels, and changing target poles requires recomputation. Fixed-gain Luenberger estimation remains within the LTI scope; Kalman design is mentioned in CH9:55 as advanced theory and is not implied by this catalog.

## Consequences for the reorganized plan

- Discrete mode deserves its own five blocks, not a renamed copy of the continuous menu. The original course contains independent recurrence, sample-boundary, Jury, transformed-plane, digital lead/lag and observer exercises.
- Representation and Plots provide reusable objects. Stability asks for a conclusion/parameter region. Performance measures whether requirements are met. Controller Design changes a controller to satisfy them. Shared visuals should reopen with the same model and a different exercise prompt, rather than become disconnected calculators.
- Add original-slide families that the old 15-session summary obscured: sampled-block aggregation with delay, full Jury rows, bilinear Routh, unit-circle locus crossings, exact versus warped discrete Bode, direct discrete lead/lag and analytic PID matching.
- Keep explicit lineage on every exercise: original source problem, current authored exercise, or a newly proposed bridge. A new example inspired by a source topic should not be labeled as the original slide's exact numerical problem.
- Select concrete acceptance exercises before implementation. Formula images and rounded coefficients cannot substitute for independent derivation. No exercise family here establishes support for every possible SISO LTI model, unbounded polynomial order or arbitrary time-delay interconnection.
