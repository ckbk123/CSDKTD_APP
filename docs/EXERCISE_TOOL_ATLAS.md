# Exercise tools inside the ten course blocks

**Revision 2, 28 October 2026.** Read the [course architecture](FUNCTIONAL_SPECIFICATION.md) first. The entries below are modes of its ten workspaces, not 56 unrelated applications. Shared diagrams, plots and equations follow the selected SISO LTI case between workspaces.

Every entry specifies a problem students can attempt, an interaction that exposes the concept, and an answer/verification contract. The instructor can adapt the notation, reveal order and problem data in the [review sheet](FEATURE_REVIEW.md). Implementation priorities remain pending.

## Source and fixture notation

- `Snn:a–b`: one-based slides of the reorganized session `Buoi_nn_CSDKTD.pptx`.
- `Chn:a–b`: original Vietnamese source chapter slides, indexed in the [slide review](research/SLIDE_REVIEW.md).
- `Wnn`: session worksheets in the parent course's `Tai_to_chuc_bai_giang/giao_an/phieu/`; the audits identify group/individual files and actual tasks.
- `E01`–`E12`: verified external exercise patterns in [external research](research/EXTERNAL_EXERCISE_REFERENCES.md).

The existing mechanical plant, nested-loop and session examples below are authored course cases. Additional small examples marked **proposed fixture** were constructed to make a mode checkable; they are not transcriptions of an original slide. Source-caption evidence does not certify an image-only equation/topology. The [continuous](research/CONTINUOUS_EXERCISE_AUDIT.md) and [discrete](research/DISCRETE_EXERCISE_AUDIT.md) audits record that distinction and selected visual inspections.

## Continuous / System Representation

<a id="cr01"></a>
### CR01 — Expand, factor and interpret polynomials

**Exercise:** expand products, recover coefficients, factor a denominator, locate roots and compare rational expressions. **Evidence:** S02:5–9,14; S03:4–8; S06:7–9; the earlier algebra discussion.

**Tool:** editable factor/coefficient/pole views; highlight which products contribute to a coefficient; show exact factoring domain, numerical roots and multiplicity. A quadratic discriminant explains real versus conjugate roots. An optional Bairstow display shows remainder reduction.

**Check/variation:** the proposed quartic `s^4+7s^3+27s^2+47s+26` factors as `(s+1)(s+2)(s^2+4s+13)`. Re-expand exactly and verify all roots. Change one coefficient and compare exact versus numerical output. Never label rounded-root reconstruction exact or silently cancel a near pole/zero pair.

<a id="cr02"></a>
### CR02 — Derive a linear ODE and apply Laplace correctly

**Exercise:** derive/normalize a verified linear force/circuit balance, transform derivatives, retain initial terms and separate zero-input from zero-state response. **Evidence:** Ch2:7–9,12–18,83–90; S02:4–11,13–14; W02/W04.

**Tool:** linked physical term, ODE term, Laplace term and coefficient cell. Change mass or initial displacement and see precisely which terms change. Input derivatives receive a separate construction step rather than an invented second input.

**Check/variation:** W02's `2y''+5y'+3y=u` gives poles `-1,-1.5` and DC gain `1/3`. In the proposed initial-condition fixture `y''+3y'+2y=u`, `y(0)=1,y'(0)=0`, the free response is `2e^-t-e^-2t`. A nonzero-initial-condition output divided by one particular input is not the system TF.

<a id="cr03"></a>
### CR03 — Convert TF/ODE/state descriptions and canonical coordinates

**Exercise:** construct a proper SISO realization, treat numerator/input derivatives, recover its TF and compare different state coordinates. **Evidence:** Ch2:76–77,83–93,97–101; S04:4–5,7–11.

**Tool:** build rows of `A,B,C,D`; place numerator coefficients in the output equation; show a physical-state and canonical realization side by side. A chosen invertible coordinate change maps states and initial conditions while retaining output.

**Check/variation:** the proposed `G=(s+4)/(s^2+3s+2)` can use `A=[[0,1],[-2,-3]], B=[0;1], C=[4,1]`. A modified-state realization in the continuous audit gives the same TF. Accept equivalent matrices rather than string/matrix equality. Add a biproper example to expose `D`; explain why an improper TF cannot silently become an ordinary standard realization.

<a id="cr04"></a>
### CR04 — Construct and reduce a scalar block diagram

**Exercise:** series/parallel/feedback reduction, compensated summer/pickoff movement and selection of the reference or disturbance transfer. **Evidence:** Ch2:38–62; S03:4–5,7–11; W03.

**Tool:** structured blocks/ports/signed summers, explicit junctions, selectable local reduction and before/after equations. Highlight which downstream signals a move changes. Undo and numeric entry accompany dragging.

**Check/variation:** the course nested-loop example `G1=1/(s+1),G2=1/(s+2),H2=2,H1=1` gives inner block `1/(s+4)` and overall `1/(s^2+5s+5)`. Changing inner `H2` to `3` changes the inner block to `1/(s+5)`. Retained scalar channels must remain equivalent; screen crossings do not imply connectivity.

<a id="cr05"></a>
### CR05 — Convert to SFG and apply Mason step by step

**Exercise:** choose signal nodes, forward paths, elementary loops, non-touching sets and path cofactors. **Evidence:** Ch2:64–74; S03:6–11,14; W03.

**Tool:** cross-highlight block nets and graph nodes; students draw/select paths and loops before revealing enumeration. Shared nodes light up when an invalid non-touching pair is selected. Build `Δ` and each `Δk` before simplifying.

**Check/variation:** the course two loops touch, so their product is excluded and final DC gain is `0.2`. Add proposed fixtures with two paths, disjoint loop triples, self-loops and distinct cofactors. Solve equations from the original block data independently. Cycles are allowed; singular equations or an enumeration resource limit need explicit feedback.

<a id="cr06"></a>
### CR06 — Choose dynamic states and explain state response

**Exercise:** pick integrator outputs as states, trace their derivatives/output, and decompose the state solution. **Evidence:** Ch2:94–100; S04:7–11.

**Tool:** selecting an integrator highlights its state and incoming derivative equation. A state-transition view separates `exp(At)x0` from forced response. Build a diagram in reverse from small matrices.

**Check/variation:** the chain `x1'=x2, x2'=-2x1-3x2+u, y=x1` yields the common mechanical realization. One graphical block need not equal one state; a higher-order transfer block must be realized first. Compare two initial states with unchanged input and preserve the zero-state response. Hidden state modes remain visible even when absent from a reduced TF.

## Continuous / Plots

<a id="cp01"></a>
### CP01 — Construct a time response

**Exercise:** sketch/predict a unit-step, ramp, impulse interpretation or free response, then compute it from a supported model. **Evidence:** Ch3 time-response sections; S05:3–11; S02/S04 initial-condition exercises.

**Tool:** input/output/initial-condition controls, free/forced overlays, analytic terms and a time cursor. For a pulse approximation to an impulse, show pulse width and area.

**Check/variation:** `G=1/[(s+1)(s+2)]` gives step `0.5-e^-t+0.5e^-2t`, hence `y(1)≈0.199788`. Preserve initial conditions across representations. Integrators may not settle; direct feedthrough/ideal differentiation may include impulses that cannot be shown as ordinary finite peaks without a declared approximation.

<a id="cp02"></a>
### CP02 — Explain pole modes and zero effects

**Exercise:** match real/repeated/conjugate modes to a response and compare systems with the same poles but different zeros. **Evidence:** S05/S07; Ch6:9–10; E01.

**Tool:** drag poles in conjugate pairs; decompose a response into modal terms; lock the denominator and move a numerator zero. Highlight initial direction, modal weights and full response.

**Check/variation:** contrast a left-half-plane and a right-half-plane zero without changing poles. The checker rejects “same poles means same response.” Keep original and reduced forms when cancellation occurs. Stability of a selected reduced channel and internal stability receive separate labels.

<a id="cp03"></a>
### CP03 — Measure sinusoidal gain and phase

**Exercise:** infer `|G(jω)|` and phase from stable steady sinusoidal traces. **Evidence:** S05:4–11,13–14; Ch3 frequency response.

**Tool:** frequency/amplitude entry, transient reveal, paired time markers, and one linked Bode/Nyquist cursor. Let students place phase/amplitude markers before revealing the calculation.

**Check/variation:** at `ω=1 rad/s`, the shared plant has magnitude `0.316228` and phase `-71.565°`. Distinguish phase sign and degrees/radians. A time-domain measurement before transient decay is not a steady-state frequency result. Stable-frequency experiments and analytic evaluation on an unstable model must be labeled differently.

<a id="cp04"></a>
### CP04 — Build a Bode plot from factors

**Exercise:** normalize factors, identify gain/corners, add slopes and phase contributions, and compare with exact response. **Evidence:** Ch3 Bode sections; S05; E04.

**Tool:** select a factor to reveal its contribution, draw expected asymptotes and place corner markers. Preserve the normalization gain. Add explicit pure delay in phase without altering magnitude.

**Check/variation:** a correct shape with the wrong vertical offset is diagnosed as a gain-normalization issue. Toggle rad/s/Hz and dB/linear units. Selecting one frequency exposes exact/asymptotic error. A delay stays an explicit LTI element; any Padé approximation is a named separate case.

<a id="cp05"></a>
### CP05 — Construct a Nyquist curve

**Exercise:** map a frequency/contour path into the complex plane; relate magnitude/phase to its coordinates. **Evidence:** Ch3 and Ch4:55–57; S09; E05.

**Tool:** simultaneous source-contour and mapped markers, Bode cursor, arrow direction, positive/negative-frequency traces and limiting arcs. Students place selected mapped points before showing the curve.

**Check/variation:** use the simple `L=4/[(s+1)(s+2)]` first. Mark any contour pole, indent and omitted limit. This mode constructs the curve; CS04 supplies the formal stability count. A positive-frequency sketch alone is never labeled the complete criterion.

<a id="cp06"></a>
### CP06 — Construct a root locus and test its rules

**Exercise:** sketch segments/asymptotes, locate break/crossing/departure points and test candidate roots. **Evidence:** Ch4:30–54; S08:4,7–11.

**Tool:** reveal vectors from open-loop poles/zeros, angle residual, candidate gain and branch rules independently. Select the actual varying parameter and derive `1+K L0(s)=0` when normalization is needed.

**Check/variation:** original Ch4:50–54 keeps `Ki` fixed while varying `Kp`; it is not automatically the original plant's proportional-gain locus. Check every candidate against the full characteristic polynomial. Track branches across gain changes using a suitable matching/continuation method rather than sorting root real parts.

## Continuous / Stability

<a id="cs01"></a>
### CS01 — Classify poles, eigenmodes and boundaries

**Exercise:** decide asymptotic/BIBO/internal stability and explain boundary multiplicity. **Evidence:** Ch4:4–9; S06:4.

**Tool:** select a pole/eigenvalue and see its mode. Toggle original realization and reduced scalar transfer. An interval-free classification panel distinguishes strict stability from boundary cases.

**Check/variation:** proposed `diag(1,-2), B=[0;1], C=[0,1]` has an unstable hidden state mode while its selected zero-state TF is `1/(s+2)`. Imaginary-axis eigenvalues require multiplicity/Jordan and input/output qualifications; one ambiguous “stable” badge is insufficient.

<a id="cs02"></a>
### CS02 — Work through Routh and Hurwitz, including special cases

**Exercise:** fill cells/minors, count RHP roots, choose epsilon versus auxiliary-polynomial treatment. **Evidence:** Ch4:10–28; S06:5–11; E02/E03.

**Tool:** coefficient-to-cell highlighting; symbolic positive-epsilon limits; all-zero-row detection and derivative of the auxiliary polynomial; selectable leading principal minors for Hurwitz. Keep special cases as explicit submodes.

**Check/variation:** proposed epsilon fixture `s^4+2s^3+3s^2+6s+5` has two RHP roots. Proposed all-zero-row fixture `(s^2+4)(s+1)^3` includes `±2j`. A zero first entry is not the same event as an all-zero row. A Hurwitz sign convention follows normalization of the leading coefficient.

<a id="cs03"></a>
### CS03 — Derive a complete stable parameter region

**Exercise:** form the feedback characteristic polynomial, solve inequalities and classify endpoints. **Evidence:** S06:7–11,14; W06; Ch4:18–19; E02.

**Tool:** every inequality marks a region on the same parameter axis; intersect them and show full roots at selected interior/exterior/boundary points. Give a student an interval answer field with open/closed endpoints.

**Check/variation:** `s^3+7s^2+10s+K` gives `0<K<70`; at `70`, `(s+7)(s^2+10)`. W06 changes the cubic to `s^3+6s^2+8s+K`, giving `0<K<48`. Sampling K values cannot establish a complete symbolic interval.

<a id="cs04"></a>
### CS04 — Apply Nyquist with the correct loop and pole count

**Exercise:** combine open-loop RHP poles and mapped-contour windings to count closed-loop RHP roots. **Evidence:** Ch4:58–71, including unstable-open-loop and nonunit-sensor cases; S09; E05.

**Tool:** reuse CP05's curve with `P,N,Z`, explicit clockwise/counterclockwise convention, selected `L=CGH` and computed closed-loop roots. Make a wrong open-loop count visible before giving the answer.

**Check/variation:** include an unstable-open-loop fixture and a scalar `H≠1`. No encirclement is not universally sufficient for stability. Imaginary-axis poles require the documented contour procedure. Boundary hits at `-1` are distinct from a strict-stability conclusion.

<a id="cs05"></a>
### CS05 — Find stable gains on a root locus

**Exercise:** identify all K intervals where every closed-loop pole is in the left half-plane. **Evidence:** Ch4:30–54; S08 and the S06 boundary case.

**Tool:** locus branches, interval strip, full root list and boundary derivation through Routh or `s=jω`. A selected branch cannot hide other unstable poles.

**Check/variation:** the S06 loop crosses at `K=70,ω=sqrt(10)`. Cross-check the interval against CS03. State the sign/range of gain. If several stable intervals exist, report the set rather than forcing a single “maximum K.”

## Continuous / Performance

<a id="cf01"></a>
### CF01 — Measure transient requirements and test pole predictions

**Exercise:** derive damping/natural frequency from requirements, place a target region and measure actual rise/peak/settling/overshoot. **Evidence:** Ch5:14–27; S07:5–11; S08; E01/E06.

**Tool:** selectable bands and rise definitions, response markers and target pole regions; overlay standard second-order prediction and full-order simulation. Add a pole/zero without changing the target pair.

**Check/variation:** `4/(s^2+2s+4)` gives `ζ=.5,ωn=2`, overshoot `16.303%`, approximate 2% settling `4 s`, measured about `4.039 s`. Extra modes/zeros can invalidate that approximation. Insufficient horizon yields “not established,” not the final time as settling.

<a id="cf02"></a>
### CF02 — Derive steady-state error and system type

**Exercise:** step/ramp/parabolic limits, type/error constants and scalar reference/disturbance/sensor effects. **Evidence:** Ch5:8–13; S07; S03:5,13.

**Tool:** highlight integrators and relevant limit factors, show `E/R` before a table lookup, and compare predicted limit with a trace. Select one scalar excitation/channel at a time.

**Check/variation:** `L=4/[s(s+2)]` has zero step error and unit-ramp error `.5` under unity negative feedback. Verify final-value conditions. For `H≠1`, comparator error and physical `r-y` may differ; derive the appropriate signal rather than applying a unity-feedback type table automatically.

<a id="cf03"></a>
### CF03 — Compare integral error criteria and control effort

**Exercise:** compute IAE/ISE/ITAE/ITSE and explain why two controller rankings differ. **Evidence:** Ch5:28–32; S07:6,9–11.

**Tool:** shade incremental error contributions, choose a common horizon and overlay error with `u(t)`. Save baseline/variant runs and display units.

**Check/variation:** verify a selected sum/integral independently at a finer tolerance. Time-weighted criteria emphasize later error. A short horizon or truncation must not allow an unstable design to be described as optimal. Controller effort is a comparison measure within the LTI scope; no saturation model is introduced.

<a id="cf04"></a>
### CF04 — Read margins, crossovers, resonance and bandwidth

**Exercise:** locate the correct frequency and transfer channel for each specification. **Evidence:** Ch5:33–42; S09:5–9,11,13.

**Tool:** Bode/Nyquist cursor, selectable crossings, gain/phase margin construction and closed-loop resonance/bandwidth markers. Label `G,L,T` explicitly.

**Check/variation:** compare the S09 `C0=4` and given lead `C1`; PM changes about `51.827°→64.471°`, while `Kv=2` remains. Display all relevant crossovers and distinguish infinite/undefined margins. Open-loop margins are not read from a closed-loop response curve.

<a id="cf05"></a>
### CF05 — Test time/frequency performance relationships

**Exercise:** predict settling from crossover/bandwidth or overshoot from PM, then evaluate the actual response. **Evidence:** Ch5:33–42, specifically worked examples39–42; S09:6,13; E06/E07.

**Tool:** keep the estimate and full result simultaneously visible. Add a slow pole, change a zero or shift gain while preserving other features; explain the observed difference.

**Check/variation:** identify assumptions of each heuristic. The S08 design retains poles `-4,-2±2j` and a controller zero; its complete response, not just the desired pair, determines the metrics. The answer checker can require an explanation of which neglected factor caused a discrepancy.

## Continuous / Controller Design

<a id="cd01"></a>
### CD01 — Choose and tune an LTI P/PI/PD/PID structure

**Exercise:** turn a performance requirement into a controller structure, tune gains and derive coefficients analytically when the chosen order permits. **Evidence:** Ch6:14–20,71–73; S10:4–11; W10.

**Tool:** gain/filter controls, individual controller terms, characteristic coefficient matching and actual response/effort checks. Record a reason before each change.

**Check/variation:** the course compares `4`, `4+2/s` and `4+2/s+s/(.05s+1)` on `1/[(s+1)(s+2)]`. Integral action improves steady tracking here but these PI/PID choices need not improve settling. Keep parallel/standard notation and derivative filter explicit. Exclude nonlinear actuator/saturation/anti-windup controls.

<a id="cd02"></a>
### CD02 — Design lead compensation using root locus

**Exercise:** translate time specifications into target poles, find angle deficiency, place a compensator and calculate gain. **Evidence:** Ch6:22–30; S08:5–11,13–14; W08.

**Tool:** angle vectors and residuals, chosen pole/zero positions, full compensated locus and requirement checklist.

**Check/variation:** for `G=1/[s(s+2)]`, the given `C=12(s+8/3)/(s+6)` gives `(s+4)(s^2+4s+8)`. Retain all poles and the zero; course full-order overshoot is about `7.925%`, ramp error `.375`. Let students change the chosen compensator pole and verify the result rather than copying fixed coefficients.

<a id="cd03"></a>
### CD03 — Design lag compensation using root locus

**Exercise:** meet a stated error constant while retaining acceptable transient behavior. **Evidence:** Ch6:31–37; S08 lag role; E06.

**Tool:** a magnified low-frequency pole/zero placement, error-constant ratio, angle perturbation and full response. Keep the original transient requirements visible.

**Check/variation:** improved low-frequency gain does not prove that the added slow pole is harmless. Require complete closed-loop roots and measured settling. The external motor-speed task motivates checking an extra slow mode; adopt a verified course model or a separately validated fixture instead of copying source sketches.

<a id="cd04"></a>
### CD04 — Allocate requirements between lead and lag

**Exercise:** satisfy transient and steady-error constraints with two sections, explaining each section's role. **Evidence:** Ch6:38–45; S08 source extension.

**Tool:** a staged design: transient target/lead, accuracy ratio/lag, combined full-loop validation. Changes show which requirement improves or degrades.

**Check/variation:** multiplying individually plausible sections does not guarantee the combined design. Recompute actual characteristic roots, error limits and response. Give feedback on which unmet requirement should guide the next iteration, not merely whether coefficients match one answer key.

<a id="cd05"></a>
### CD05 — Design lead using frequency response

**Exercise:** select crossover and needed phase, choose corners and gain, then check the actual compensated loop. **Evidence:** Ch6:47–55; S09:5–11; E07.

**Tool:** required/available phase, geometric corner placement, exact Bode curve, margin construction and response checklist.

**Check/variation:** use S09's `4(1+.7071067812s)/(1+.3535533906s)` with the integrating plant. New crossover is `2 rad/s`, PM about `64.471°`. Added phase at one frequency is not identical to final margin improvement because crossover moves. Recheck the full response and error constant.

<a id="cd06"></a>
### CD06 — Design lag or lead–lag using frequency response

**Exercise:** improve low-frequency accuracy while controlling crossover and phase change, adding lead when required. **Evidence:** Ch6:56–63; Ch5 time/frequency examples; E07.

**Tool:** low-frequency error target and corner-placement handles share a Bode plot; preserve crossover/phase requirements and show the final response.

**Check/variation:** verify actual crossovers and full closed-loop stability after adding each section. A corner chosen far below crossover still has finite effects. An external worked sheet contains an inconsistent numerical target; its interaction pattern is useful but its numbers are not an approved fixture.

<a id="cd07"></a>
### CD07 — Apply and evaluate a named PID tuning rule

**Exercise:** estimate response-curve parameters or ultimate gain/period, apply a named rule and test the suggested controller. **Evidence:** Ch6:65–70; S10:5,9; source discrepancy in slide review.

**Tool:** move tangent/measurement markers or run a bounded linear gain experiment; reveal the exact rule, parameter units and controller-form conversion.

**Check/variation:** confirm assumptions before enabling a rule. The original PI table discrepancy must be reconciled against an approved reference. Compare the rule's result against requirements and manual refinement. No physical destabilization experiment or nonlinear sustained-oscillation model is implied.

<a id="cd08"></a>
### CD08 — Design SISO state feedback and reference tracking

**Exercise:** form controllability, place poles, derive `K`, then correct reference gain. **Evidence:** Ch6:75–82; S11:4–5,7–11,14; W11.

**Tool:** column-by-column rank construction, coefficient matching for a small model, actual `eig(A-BK)`, state/output/effort and scalar prefilter comparison.

**Check/variation:** the common mechanical realization targets `-2,-4`, giving `K=[6,3]` and `N=8`. Correct poles alone do not imply unity reference tracking. Numerical rank uses declared scaling/tolerance. A state vector with two or more entries remains SISO.

<a id="cd09"></a>
### CD09 — Design a Luenberger observer and combine feedback

**Exercise:** check observability, choose observer poles, derive `L`, and test estimation from one output. **Evidence:** Ch6:83–93; S11:6–11,13–14; E08.

**Tool:** row-by-row observability, measured output separate from simulated state truth, innovation and error trajectories; then connect estimated-state feedback.

**Check/variation:** `L=[10;10]` gives `-6,-7` for the course model. W11's changed `C=[0,1]` is still observable, so a sensor change is not automatically rank loss. Verify the actual `A-LC` and consistent initial estimates. Explore linear noise input/filter effects without adding nonlinear hardware.

## Discrete / System Representation

<a id="dr01"></a>
### DR01 — Connect sequences with Z transforms

**Exercise:** derive/invert supported sequence transforms and account for initial values. **Evidence:** Ch7:9–14; S12:5; E09.

**Tool:** select sequence terms, delay/shift identities and transform factors; reveal a first-samples table and the assumptions/causal convention. Let students identify a sequence from an expression before plotting it.

**Check/variation:** a rational expression alone can require a region-of-convergence/causality convention to identify a sequence. Verify reconstructed first samples and the recurrence. A finite moving sum and normalized moving average differ in DC gain; do not silently normalize them.

<a id="dr02"></a>
### DR02 — Derive and execute a difference equation

**Exercise:** convert TF to recurrence/delay diagram and compute samples with specified history. **Evidence:** Ch7 discrete TF/sai-phân sections; S12:5–10; S14:7–11; E09.

**Tool:** linked `z` and `z^-1` forms, each coefficient's memory slot, old-value highlight, arithmetic and commit-update step.

**Check/variation:** `y[k+1]=.90483742y[k]+.09516258u[k]` starts near `.095163,.181269,.259182` from zero under a held unit input. Change initial memory without changing the zero-state TF. Future-input/improper forms need a causality explanation rather than an incorrect ordinary recurrence.

<a id="dr03"></a>
### DR03 — Construct discrete state models and delay states

**Exercise:** difference/TF/state conversion, choose delay outputs as states, compare canonical realizations and recover TF. **Evidence:** Ch7: state-space/canonical sections; S12:6–11.

**Tool:** delay register becomes state vector; highlight each row of the `x[k+1]` equation and scalar output equation. Derive `C(zI-A)^-1B+D`.

**Check/variation:** compare a generated realization with independently stepped recurrence under identical history. An integer delay adds storage states where appropriate. One delay block carries one scalar sample; direct feedthrough is separate. Coordinate changes must map initial history/state consistently.

<a id="dr04"></a>
### DR04 — Reduce sampled diagrams and apply discrete Mason

**Exercise:** derive a scalar pulse TF from blocks, summers, delays and declared sampling boundaries. **Evidence:** Ch7:22–29 and diagram examples; S12.

**Tool:** shared block/SFG editor labels continuous versus discrete subparts and sample/hold boundaries during conversion. Once the discrete model is established, CR05's structural Mason workflow operates with `z` gains.

**Check/variation:** the source delayed plant uses `5 exp(-.2s)/s^2`, `T=.2`, `H=.1` and controller `u[k]=10e[k]-2e[k-1]`. Confirm its exact topology before adopting an answer. The pulse transform of a continuous cascade is generally not the product of separately discretized blocks without intervening sampling.

<a id="dr05"></a>
### DR05 — Derive a sampled model using a declared hold

**Exercise:** compute exact ZOH and compare with selected approximations; handle integer delays. **Evidence:** Ch7:4–8,22–29,43–49; S12:4–11,13–14.

**Tool:** continuous trajectory, sample clock and held input; show `Ad=exp(AT)`, the input integral and resulting recurrence. Mark source/target models and approximation method.

**Check/variation:** `1/(s+1),T=.1` gives the DR02 recurrence. The matrix method must handle singular `A`; do not rely solely on `A^-1(Ad-I)B`. Exact equality is at sample instants for the declared hold/input, not for arbitrary intersample interpolation. A delay equal to `mT` maps to an integer sample delay under the stated timing convention.

## Discrete / Plots

<a id="dp01"></a>
### DP01 — Plot sequences and interpret modal behavior

**Exercise:** draw step/impulse/ramp/free sequences and match poles to decay, alternation and oscillation. **Evidence:** Ch8:41–44,46–62; S13.

**Tool:** stems, sample/time axes, modal decomposition and selectable initial history. A held or interpolated line is labeled separately.

**Check/variation:** proposed single modes `.8^k` and `(-.8)^k` both decay, with the latter alternating. Compare conjugate modes at equal radius but different angles. Controller sample time is not plot resolution. Without a continuous plant/hold, the curve between points does not establish an intersample peak.

<a id="dp02"></a>
### DP02 — Map continuous poles and discrete modes

**Exercise:** map a pole using `z=exp(sT)` and interpret radius/angle as sampled decay/oscillation. **Evidence:** Ch8 stability/quality sections; S13:2,4,6,13–14.

**Tool:** linked planes and sequence, adjustable T, radius/angle annotations and selected inverse-log branch. Students predict inward/outward movement before reveal.

**Check/variation:** different continuous frequencies separated by `2π/T` can map to the same z location. Do not claim a unique inverse frequency without a branch restriction. A pole inside the unit circle can have negative real part or a complex angle; stability depends on radius.

<a id="dp03"></a>
### DP03 — Construct discrete Bode/Nyquist and W-plane views

**Exercise:** evaluate on the unit circle, build a frequency plot and compare a bilinear approximation. **Evidence:** Ch8:33–40, including source34/39; E10.

**Tool:** unit-circle cursor drives exact magnitude/phase and Nyquist; display normalized and physical frequency. A W-plane panel exposes its transform and warping relation.

**Check/variation:** the source displays `(.0544z+.0493)/(z^2-1.741z+.741)` for frequency tasks; coefficients are rounded source inputs. Compare direct evaluation with the declared transformed construction, not with an assumed identical linear frequency axis. Frequencies beyond Nyquist repeat/alias rather than supplying new independent discrete response information.

<a id="dp04"></a>
### DP04 — Construct a discrete root locus

**Exercise:** apply locus construction in the z plane before selecting stable gains/designs. **Evidence:** Ch8:20–31; E10.

**Tool:** angle vectors, real-axis segments, asymptotes/break points, branch tracking and a visible unit circle. Test candidate points through the magnitude/angle conditions.

**Check/variation:** students identify the entire selected characteristic root set, then hand it to DS04 for stability. Continuous locus algebraic rules can be shared where applicable, but stability regions and time interpretation are discrete. Respect the sign/range of the varying parameter.

## Discrete / Stability

<a id="ds01"></a>
### DS01 — Classify discrete pole/eigenvalue stability

**Exercise:** distinguish strict disk stability from boundary/repeated cases and reduced-channel versus internal behavior. **Evidence:** Ch8:4–13; S13:4.

**Tool:** selectable poles and `z^k` modes, eigenvalue versus reduced-TF view, boundary multiplicity explanation.

**Check/variation:** compare `.8`, `-.8`, `1`, `-1` and a repeated unit-circle mode. A negative real pole need not be unstable. A bounded free response and BIBO stability are not interchangeable at a boundary. Retain hidden realization modes when reporting internal stability.

<a id="ds02"></a>
### DS02 — Apply Jury conditions and build the table

**Exercise:** fill applicable conditions/rows and solve a parameter interval, including changed coefficients. **Evidence:** Ch8:14–19; S13:5,7–11,14; W13.

**Tool:** mirrored coefficient rows, determinant/arithmetic highlights, inequality intersection and root/unit-circle check. Use a documented table convention and distinguish quadratic conditions from full high-order procedure.

**Check/variation:** `z^2+(K-1)z+.2K` gives `0<K<2.5`; endpoint roots `-1,-.5` exclude `2.5`. W13's `.1K` variant gives `0<K<20/9`. Root sweeps illustrate but do not prove the full interval.

<a id="ds03"></a>
### DS03 — Transform the disk and apply Routh

**Exercise:** derive the transformed polynomial and use a continuous half-plane test for a discrete stability question. **Evidence:** Ch8 extended-Routh/bilinear sections; deeper discrete audit.

**Tool:** map the disk boundary, substitute `z=(1+w)/(1-w)`, clear denominators with degree displayed, and reuse the Routh stepper on the resulting polynomial.

**Check/variation:** DS02's polynomial becomes `(2-.8K)w^2+(2-.4K)w+1.2K` after multiplication by `(1-w)^2`. Recover the same strict interval. Handle `z=-1` and a vanishing highest coefficient explicitly; do not discard a boundary through degree reduction.

<a id="ds04"></a>
### DS04 — Derive stable gain intervals on a discrete locus

**Exercise:** locate all unit-circle crossings and stable K regions. **Evidence:** Ch8:20–31; S13; E10.

**Tool:** share DP04's graph with a gain-interval bar, full root list, boundary equations and Jury/transformed-Routh checks where applicable.

**Check/variation:** inspect crossings at `+1`, `-1` and complex unit-circle points. A selected attractive branch cannot conceal another outside the disk. Report disconnected stable sets if present rather than a forced single maximum. Keep numerical searches distinct from exact gain-region derivation.

<a id="ds05"></a>
### DS05 — Explain discrete Nyquist stability

**Exercise:** connect a unit-circle mapping with closed-loop root count. **Evidence:** Ch8 frequency analysis and E10; a complete guided contour lesson is an instructor-review extension.

**Tool:** DP03 curve with contour orientation, inside/outside pole accounting, open-loop unstable-pole count and an explicit convention. Compare the predicted closed-loop count with the actual polynomial.

**Check/variation:** define the discrete contour and sign convention rather than copying a continuous positive-frequency shortcut. Poles on the contour and strict-stability boundaries need separate handling. Do not claim that the local slides contain a complete worked contour exercise when they establish only the broader frequency-analysis relevance.

## Discrete / Performance

<a id="df01"></a>
### DF01 — Measure sampled transient specifications

**Exercise:** identify peak/settling samples manually, then express results in samples and seconds. **Evidence:** Ch8:41–44,46–62; S13:6–11.

**Tool:** stems, peak/final-value markers and selectable band, optional verified intersample reconstruction if the continuous plant/hold exists.

**Check/variation:** `t_s=k_sT` must be shown with its convention. Require all subsequent samples in the band and a sufficiently established horizon. A sample-grid peak is not automatically the true continuous intersample peak. Compare state and recurrence results with identical initialization.

<a id="df02"></a>
### DF02 — Derive discrete error constants with physical time

**Exercise:** derive `E(z)` and use the discrete final value for step/ramp/parabolic references. **Evidence:** Ch8:45–62; Ch9:21–22; E12.

**Tool:** reference/output/error stems, limit factor highlighting and selectable `r[k]=k` versus `r[k]=kT`. Show which assumptions make a type/error-constant formula applicable.

**Check/variation:** for a suitable unity-feedback physical unit ramp, define `Kv,d=lim(z→1)(z-1)L(z)/T`, so `ess=1/Kv,d` when the limit conditions hold. Nonunit sensor gain changes the comparator relation. Source lag target `Kv*=100` must preserve its normalization, not silently use the continuous definition.

<a id="df03"></a>
### DF03 — Read sampled-loop frequency requirements

**Exercise:** measure crossovers/margins/bandwidth and relate them cautiously to sampled transient targets. **Evidence:** Ch8:33–45; Ch9 design sections; E10/E11.

**Tool:** exact unit-circle cursor, physical/warped axes, full-loop poles and sampled response. Show all relevant crossings and undefined/infinite cases.

**Check/variation:** a continuous PM/overshoot rule is not an exact discrete identity. Check a target's meaning relative to Nyquist frequency and the actual sampling period. Controller emulation must be evaluated on the actual discrete loop, not only its continuous precursor.

<a id="df04"></a>
### DF04 — Compare sample periods and discrete quality indices

**Exercise:** compare the same physical task at several T values and explain the difference between fixed-controller and redesigned-controller runs. **Evidence:** S12–15 sample-period tasks; Ch8 quality; this comparison interface is a proposed synthesis.

**Tool:** baseline snapshots with T/control policy visible, common seconds horizon and sample-weighted error/effort accumulation.

**Check/variation:** an ISE approximation uses `T sum(e[k]^2)` under a stated quadrature convention; a raw sample sum changes scale with T. Keep gains fixed only when the experiment says so. More plot points do not imply a faster controller, and discrete samples alone do not establish intersample behavior.

## Discrete / Controller Design

<a id="dd01"></a>
### DD01 — Emulate a continuous LTI controller

**Exercise:** apply selected Euler/Tustin mappings, derive a realizable discrete controller and test its actual loop. **Evidence:** S14:4–11; Ch9:6–9; E11.

**Tool:** named substitution, algebra steps, selected T, optional prewarping frequency, recurrence and actual sampled response/margins.

**Check/variation:** at `T=.1 s`, the course continuous lead maps by Tustin to `(136z-104)/(13z-7)`. Change T and rederive. Plant ZOH conversion and controller approximation are different operations. Retain a derivative filter if the original controller has one. Emulation does not guarantee identical original performance.

<a id="dd02"></a>
### DD02 — Design lead and lag directly in the z plane

**Exercise:** separate lead and lag submodes: map transient targets, solve angle/magnitude conditions, or meet a defined velocity constant. **Evidence:** Ch9:11–27, especially14 and22; S14 broader source.

**Tool:** target pair `exp(sT)`, angle vectors, gain residual, complete locus and a magnified neighborhood of `z=1` for lag placement. Preserve the original hold/plant model.

**Check/variation:** source lead inputs are `50/[s(s+5)]`, `T=.1`, `ζ=.707,ωn=10`; source lag uses the same plant/T and target `Kv*=100`. Verify source normalization/topology before freezing a numeric answer. Lag placement near `+1`, not automatically near the continuous origin, is a key concept.

<a id="dd03"></a>
### DD03 — Design using discrete frequency and W-plane methods

**Exercise:** use course bilinear/frequency constructions to choose compensation, then verify on the exact sampled loop. **Evidence:** Ch8:33–40 supports the representation; continuous frequency-design methods and E10/E11 provide related tasks. A full standalone discrete frequency-design sequence remains an instructor-review synthesis.

**Tool:** transformed-plane construction, physical-frequency mapping, controller corners and exact unit-circle recheck. Keep emulation and direct design routes separate.

**Check/variation:** map frequency requirements using the declared transform and T; do not treat W frequency as linearly identical to physical frequency. Verify full poles, margins, tracking and sampled response. Label this mode's evidence level honestly rather than inventing a worked source chapter9 Bode design.

<a id="dd04"></a>
### DD04 — Derive and single-step a digital PID

**Exercise:** derive position/incremental equations and compute outputs under specified memory. **Evidence:** Ch9:6–9; S14:4–11,14; W14.

**Tool:** integration/derivative rule selectors, `C(z)`, recurrence coefficient derivation, history reads and final update commit. Optional linear filter has its own states.

**Check/variation:** at `Kp=4,Ki=2,Kd=1,T=.1`, trapezoidal integral/backward derivative gives increments `14.1,-23.9,10`. With zero prior history and `e[1]=e[2]=1`, obtain `u[1]=14.1,u[2]=4.3`. At `T=.2`, coefficients become `9.2,-13.8,5`. The S14 unfiltered and S10 filtered designs are different LTI controllers.

<a id="dd05"></a>
### DD05 — Design a digital PID analytically

**Exercise:** choose target discrete roots and tracking constraints, form the actual characteristic polynomial and match controller coefficients. **Evidence:** Ch9:28–32.

**Tool:** desired/actual coefficient columns, parameter unknowns and residuals, then complete roots and sampled performance.

**Check/variation:** verified source inputs are `G=10/(10s+1)`, `H=.05`, `T=2 s`, targets `ζ=.707,ωn=2` and zero step error under the source's signal convention. Verify exact topology before adopting an answer. Extra modes, sensor-scaled error, realizability and incompatible constraints must be checked; matching a target pair alone is insufficient.

<a id="dd06"></a>
### DD06 — Place discrete state poles and set tracking gain

**Exercise:** test scalar-input controllability, calculate feedback and reference multiplier, and evaluate sampled output/effort. **Evidence:** Ch9:34–48; S15:4,7–11; W15.

**Tool:** controllability columns, coefficient matching or a selected algorithm, actual `eig(Ad-BdKd)` and tracking gain with T visible.

**Check/variation:** for the shared ZOH model at `.1 s`, targets `.7,.8` give displayed `Kd≈[4.956502,2.335770]`, `Nd≈6.956502`. Recompute from exact matrices, not rounded displays. Original problems37/41 add target pairs specified through continuous damping/frequency. A sample-period change requires a declared model/redesign policy.

<a id="dd07"></a>
### DD07 — Design a sampled Luenberger observer

**Exercise:** check observability, derive an observer, verify actual error modes and combine estimated-state feedback. **Evidence:** Ch9:49–61; S15:5,7–11; W15.

**Tool:** measured scalar output separate from state truth; display `x[k],xhat[k]`, innovation, read/update order and estimation error in samples/seconds.

**Check/variation:** the common sampled case targets `.3,.4` and displays `Ld≈[1.023568;1.498984]`; verify from the full-precision model. A rounded source observer example may not reproduce its target roots exactly, so retain rounding evidence. Choose/display predictor versus current-estimate timing; copying continuous L or mixing update conventions is incorrect.

## Linked exercise paths for review

| Path | Sequence of tools | What the student must explain |
|---|---|---|
| A scalar diagram problem | CR04 → CR05 → CP02 → CS01/CS03 → CF02 | Why different derivations agree, which loops touch and what the selected channel means |
| A gain-stability problem | CP06 → CS03/CS05 → CF01/CF02 | Complete stable interval versus a chosen gain's actual quality |
| A lead/lag design problem | CF01/CF02/CF04 → CD02–CD06 → CS01/CS04 → CF05 | How each design step meets a requirement and why full-order checks matter |
| A state/observer problem | CR03/CR06 → CD08/CD09 → CS01 → CF01 | Multiple states within SISO, reachable/observable modes, poles versus tracking gain |
| A sampled plant problem | DR05 → DR02/DR03 → DP02/DP03 → DS02/DS03 → DF01/DF02 | Timing/hold assumptions, stable parameter range and units in error/response |
| A digital controller problem | DD01 or DD02/DD05 → DD04 → DS04 → DF03/DF04 | Emulation versus direct design, correct recurrence and actual sampled-loop behavior |

These are guided paths through the adopted hierarchy. Saving, comparison, keyboard entry, lesson reveal and export are shared workspace services. They do not need separate curricular tool entries.
