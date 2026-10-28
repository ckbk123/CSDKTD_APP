# Continuous SISO LTI: exercise audit

Revised 28 October 2026 to support the instructor's requested curriculum hierarchy: **System Representation, Plots, Stability, Performance and Controller Design**. This document identifies exercise families and the interactions needed to explain them. It is supporting evidence, not a second application menu.

## Scope and evidence conventions

The model has one selected scalar input and one scalar output. A state vector with several entries is still allowed: state dimension does not determine whether a system is SISO. A feedback controller may use a state estimate internally while the external reference and output remain scalar. Disturbance/reference comparisons can select one scalar channel at a time and apply superposition; the interface does not need a general MIMO workspace.

The revised core excludes ON/OFF, hysteresis, saturation, windup, nonlinear-model simulation and linearization. In session 04 the ODE/state-space exercises remain relevant, while the nonlinear tank exercise belongs outside the selected scope. General symbolic trigonometric search is not a separate curricular block. Polynomial, rational and selected Laplace operations belong inside representation and the exercises that use them.

Evidence was read from the actual PPTX slide XML, course worksheets, original-slide extracted text and source maps. `SNN:a–b` denotes one-based slides in `Tai_to_chuc_bai_giang/slides/Buoi_NN_CSDKTD.pptx`. `ChN:a–b` denotes the original Vietnamese chapter through the `Unicode_DayDuCongThuc` PPTX variant and `knowledge_base/source_maps/cstd_vi_chNN_slide_map.md`. Worksheet names below are inside `Tai_to_chuc_bai_giang/giao_an/phieu/`. These paths refer to the parent course workspace, not files redistributed in this repository.

Original formulas and block topologies often remain pictures, even in the formula-restored decks. Their extracted captions establish the problem family, but do not certify every numerical formula or wire connection. Exact original numeric instances require visual checking before adoption. Where the audit supplies a new small example to make an interaction testable, it is explicitly labeled **proposed verification fixture**, not attributed to an original slide.

## System Representation

### R1. Physical balance to normalized ODE, transfer polynomial and coefficients

**Evidence:** Ch2:7–9 explicitly gives car-speed, suspension and elevator modeling examples. S02:4–11 provides a mechanical case; S02:14 and `Phieu_ca_nhan_Buoi_02.md` ask for a changed ODE.

**Actual student task:** derive the input–output equation, state the assumptions/units, normalize the leading coefficient and enter the denominator in the correct power order. The individual exercise is `2y''+5y'+3y=u` with zero initial conditions.

**Tool action:** each term in force balance highlights its ODE term, polynomial power and coefficient cell. A normalization step shows the divisions by mass rather than silently changing the model. Students can deliberately reverse a coefficient vector and compare its roots/response before correcting it.

**Check:** the individual exercise gives `G=1/(2s²+5s+3)`, poles `-1,-1.5`, DC gain `1/3`, and normalized state entries `A21=-1.5,A22=-2.5,B2=0.5`. The source model has `m=1,b=3,k=2`, poles `-1,-2` and final displacement `1 m` for a `2 N` step. A useful diagnostic is forgetting to divide the input coefficient by mass.

### R2. Laplace conversion with zero and nonzero initial conditions

**Evidence:** Ch2:12–18; S02:5,13–14; S04:5,9–11; `Phieu_nhom_Buoi_04.md`, tasks 1–2.

**Actual task:** show why the zero-state transfer function is independent of the particular input, while a trajectory with nonzero initial state contains another component.

**Tool action:** let the student apply the derivative transform term by term. Reveal each initial-condition term, then split the result into zero-state and zero-input responses. Plot both components and their sum on the same time axis. Preserve one input while changing the initial state.

**Proposed verification fixture:** for `y''+3y'+2y=u`, `y(0)=1,y'(0)=0`, the zero-input response is `2exp(-t)-exp(-2t)`. A unit-step zero-state response is `0.5-exp(-t)+0.5exp(-2t)`. Their sum is `0.5+exp(-t)-0.5exp(-2t)`. This is an exercise about initial conditions of an LTI system, so it remains in scope.

**Diagnostic:** treating `Y/U` from one nonzero-initial-condition experiment as the system's transfer function.

### R3. ODE to state equations when the input has derivatives

**Evidence:** Ch2:83–85 treats ODEs without input derivatives; Ch2:86–90 explicitly introduces the different state construction when derivatives of the input appear. This distinction is easy to miss in the condensed session 04.

**Actual task family:** choose states and derive a standard state realization without improperly treating `u'` as a second independent input.

**Tool action:** highlight where the naive choice `x1=y,x2=y'` leaves an input derivative. Let students choose modified states or a phase-variable realization, then verify the resulting transfer function. Keep the scalar input `u` explicit.

**Proposed verification fixture:** `y''+3y'+2y=u'+4u` has `G=(s+4)/(s²+3s+2)`. With `x1=y,x2=y'-u`, obtain `A=[[0,1],[-2,-3]],B=[1;1],C=[1,0],D=0`. A second valid realization uses the same `A`, `B=[0;1]`, `C=[4,1]`, `D=0`. Both recover that transfer function exactly. Initial states must be mapped consistently; using a smooth input avoids disguising the derivative term's discontinuity behavior in the derivation.

**Diagnostic:** claiming a standard one-input realization requires a second input channel for `u'`.

### R4. Phase-variable/canonical realization and change of coordinates

**Evidence:** Ch2:91–93 explicitly develops a phase-coordinate method; Ch2:76–77 says one system can have different state choices; S04:4–5,7–8 supplies the small physical-state model.

**Actual task family:** build a realization from a proper rational transfer function, then recognize that different matrices can describe the same SISO input–output behavior.

**Tool action:** generate an integrator chain from the denominator and place numerator coefficients in the output equation. Let students select a supported canonical form and reveal the coordinate transformation. Show state trajectories changing coordinates while the external output stays the same.

**Check:** the two R3 realizations are related by `T=[[4,1],[-2,1]]`, with determinant `6`, using `x=Tξ`. Verify `Ax=T Aξ T^-1`, `Bx=T Bξ`, `Cx=Cξ T^-1`, and `x(0)=Tξ(0)`. A proper transfer function may have a nonzero direct term `D`; an improper function needs separate treatment and cannot silently be forced into an ordinary standard realization.

**Diagnostic:** marking a different but equivalent state realization wrong because its matrix entries do not match the answer key.

### R5. Block-diagram equivalence, pickoff/summer movement and selected channels

**Evidence:** Ch2:38–42 gives series, parallel and signed feedback rules; Ch2:43–62 contains worked reduction sequences; S03:4–5,7–11 and `Phieu_nhom_Buoi_03.md` tasks 1–2 require nested-loop reduction. Original diagrams need visual checking before their exact topology is adopted.

**Actual task:** reduce a structured diagram while preserving the selected external relation, and understand the gain correction required when moving a summer/pickoff across a block.

**Tool action:** select a local transformation, expose its before/after signal equations and allow a student-supplied compensating gain. Cross-highlight an input signal along the affected path. Test the reference channel and, if requested, a separately selected disturbance channel. Keep geometric wire crossings distinct from junctions.

**Check:** the authored course example has `G1=1/(s+1),G2=1/(s+2)`, negative inner feedback `H2=2` and outer feedback `H1=1`. The inner equivalent is `1/(s+4)` and the overall relation is `1/(s²+5s+5)`. The S03 individual task changes `H2` to `3`, yielding inner equivalent `1/(s+5)`.

**Diagnostic:** preserving a reference transfer while accidentally changing another retained signal relation, or confusing positive and negative feedback denominators.

### R6. Block/SFG conversion, path/loop enumeration and Mason cofactors

**Evidence:** Ch2:64–66 defines nodes, forward paths, loops and Mason; Ch2:67–68 is “Thí dụ 1,” Ch2:69–71 “Thí dụ 2,” and Ch2:72–74 “Thí dụ 3.” S03:6–11,14 and both session 03 worksheets make this an explicit exercise.

**Actual task:** convert the diagram, choose valid paths/loops, identify non-touching sets and assemble the determinant/cofactors.

**Tool action:** each original signal/net highlights the equivalent graph node. Students select paths and loops manually, then see checks for repeated nodes, duplicate cycles and missing self-loops. A selected loop set lights up shared nodes; edge crossings alone do not determine touching. Build `Δ` and each `Δk` before simplifying the expression. Support graphs with several forward paths so that different cofactors are exercised, rather than only unity-cofactor examples.

**Check:** the S03 two loops touch, so their product is excluded from `Δ`; the final DC gain is `0.2`. For broader synthetic fixtures, check disjoint pairs/triples and a loop touching one forward path but not another. Solve equations assembled directly from the original structured diagram as an independent route. A scalar input/output graph can have many internal nodes and loops.

**Diagnostic:** knowing the Mason formula but applying “non-touching” to visual line crossings or forgetting the path-specific cofactor.

### R7. Block diagram to state equations through integrator outputs

**Evidence:** Ch2:94–96 is a separate worked example: choose state variables on a block diagram, write intermediate equations and combine them into a state model. It is more specific than generic block-diagram-to-TF conversion.

**Actual task family:** find dynamic storage variables and write each derivative/output equation from the diagram.

**Tool action:** highlight integrators, ask the student to assign their outputs as states, then trace incoming summer/gain signals into the corresponding row of `A` and `B`. Reveal the output equation separately. Offer the reverse operation from a state equation to a scalar-gain/integrator diagram.

**Proposed verification fixture:** a chain representing `x1'=x2`, `x2'=-2x1-3x2+u`, `y=x1` must give the common mechanical state realization. A transfer block of order greater than one must first be realized; one graphical block is not automatically one state. Algebraic direct-feedthrough relations are distinct from dynamic states.

**Diagnostic:** counting summing nodes or transfer-block rectangles as the system's state dimension. The original Ch2:94 topology remains an image-based fixture requiring visual verification.

### R8. State model to transfer function, characteristic polynomial and state response

**Evidence:** Ch2:97–99 is the state-to-TF calculation, Ch2:100 gives state-transition/response concepts, Ch2:101 summarizes the relationships. S04:5,7–11 and `Phieu_nhom_Buoi_04.md` tasks 1–2 require equivalence checking.

**Actual task:** calculate `C(sI-A)^-1B+D`, connect `det(sI-A)` with internal modes, and distinguish the zero-state output from the full state trajectory.

**Tool action:** a small-matrix stepper shows `sI-A`, determinant/inverse or a linear-system solution, then scalar output selection. A second view decomposes `exp(At)x0` and the convolution integral. Offer exact arithmetic for small examples and an independent numerical response check.

**Check:** the common realization recovers `1/(s²+3s+2)` and eigenvalues `-1,-2`. Use R2's initial-condition fixture to compare full responses. `det(sI-A)` may contain hidden modes that cancel from a particular transfer; the app retains the realization instead of claiming the reduced denominator always reveals its full state dimension.

**Diagnostic:** treating a transfer function as a unique state model, or asserting that all eigenvalues must appear as uncanceled poles of every scalar output channel.

## Stability

### S1. Closed-loop characteristic equation and a complete gain interval

**Evidence:** Ch4:9 distinguishes feedback and state characteristic equations; Ch4:18–19 is the original Routh gain-condition example. S06:5–11,14 and the session 06 group/individual worksheets state the numerical tasks.

**Actual task:** form the closed-loop characteristic polynomial, build the Routh table and solve strict inequalities for `K`, including endpoints separately.

**Tool action:** carry the selected diagram/loop from Representation into Stability. Highlight where the feedback term enters the characteristic equation. Each Routh cell expands its arithmetic. An interval strip colors stable, boundary and unstable values while showing all computed roots at a selected `K`.

**Check:** `L=K/[s(s+2)(s+5)]` gives `s³+7s²+10s+K` and first column `1,7,(70-K)/7,K`; strict stability requires `0<K<70`. At `K=70`, factor as `(s+7)(s²+10)`. At `K=0`, a zero root remains. The individual variant `s³+6s²+8s+K` gives `0<K<48`.

**Diagnostic:** doing Routh on the open-loop denominator, accepting positive coefficients as sufficient, or including an imaginary-axis boundary in the asymptotically stable interval.

### S2. Routh zero-leading-entry case

**Evidence:** Ch4:20 states the positive-epsilon rule and Ch4:21 works “Thí dụ 4”; S06:6 identifies the special case but does not develop a full numeric example.

**Actual task family:** continue a Routh table when the first element is zero but the rest of the row is not.

**Tool action:** detect the specific condition and let the student replace that element by symbolic `ε>0`. Reveal signs through the limit `ε→0+`; do not substitute an arbitrary floating number and silently infer a proof.

**Proposed verification fixture:** `s⁴+2s³+3s²+6s+5` has the problematic row `[0,5]`. The next leading element becomes `6-10/ε`; the first-column sign sequence has two changes as `ε→0+`. Numerical roots independently show two RHP roots, approximately `0.300243±1.624811j`. These numbers are synthetic checks, not a transcription of Ch4:21.

**Diagnostic:** interpreting a division-by-zero message as an invalid polynomial or concluding “boundary stability” from one zero table entry.

### S3. Routh all-zero row and auxiliary polynomial

**Evidence:** Ch4:22 gives the auxiliary-polynomial derivative rule; Ch4:23–24 works “Thí dụ 5,” including imaginary-axis roots and a fifth-order root count. S06:6 flags the condition.

**Actual task family:** identify the zero row, form the auxiliary polynomial from the preceding row, differentiate it and continue the table. Then classify the roots of the auxiliary polynomial.

**Tool action:** highlight how row coefficients become powers of `s`, animate differentiation and replace the row. Display the detected symmetry without assuming all symmetric roots lie on the imaginary axis.

**Proposed verification fixture:** `(s²+4)(s+1)³ = s⁵+3s⁴+7s³+13s²+12s+4`. The all-zero `s¹` row follows the `s²` auxiliary polynomial `s²+4`; its derivative gives `2s`. The complete roots include `±2j` and `-1` with multiplicity three. This fixture is independently constructed and not claimed to reproduce the original slide polynomial.

**Diagnostic:** confusing an all-zero row with S2, or reporting strict stability because the continued first column has no sign changes.

### S4. Hurwitz determinants and low-order consequences

**Evidence:** Ch4:25–26 defines the matrix/determinant test, Ch4:27 is its worked “Thí dụ 1,” and Ch4:28 explicitly lists consequences for degrees two, three and four. S06:6 identifies Hurwitz as an alternative check.

**Actual task family:** construct the Hurwitz matrix, select leading principal minors and derive coefficient conditions.

**Tool action:** selecting a polynomial coefficient highlights all its matrix positions. Students choose the leading principal submatrix and calculate each determinant. Connect the resulting inequalities to the same parameter interval shown by Routh.

**Check:** for the S06 cubic with leading coefficient normalized positive, the relevant minors are `Δ1=7`, `Δ2=70-K`, `Δ3=K(70-K)`, yielding `0<K<70`. Explain normalization: a stable polynomial with all coefficients multiplied by `-1` has unchanged roots, so a sign convention must be declared before demanding positivity.

**Diagnostic:** choosing arbitrary minors rather than the required leading principal minors, or treating a zero determinant as strictly positive through rounding.

### S5. Stable gain values located through root locus

**Evidence:** Ch4:30–34 includes gain normalization, real-axis segments, asymptotes, break points, imaginary-axis intersections and departure angles. Ch4:35–49 supplies worked plots. Ch4:50–54 varies `Kp` with `Ki=2.7`; its final question asks about `Kp=270`. S08:4,7–11 connects locus work with design.

**Actual task family:** use a locus to identify admissible gain values and justify boundary crossings algebraically. A varying coefficient is not always already the gain multiplying the original plant.

**Tool action:** normalize the chosen characteristic equation into `1+K L0(s)=0` for the parameter being varied. Let students reveal each construction rule, test a point by angle/magnitude conditions, and cross-check imaginary-axis crossings with Routh or `s=jω`. Selecting an interval highlights all closed-loop poles, not one selected branch.

**Check:** the S06 loop reaches the boundary at `K=70,ω=sqrt(10)`. The original Ch4:50–54 PI example should be transcribed/verified visually before its parameterized diagram is adopted; its captions establish a distinct exercise where `Ki` stays fixed and `Kp` varies.

**Diagnostic:** choosing a gain because one pole lies in a desirable region while another is unstable, or using a parameter's name as proof that it is the scalar locus multiplier.

### S6. Nyquist stability with declared loop and encirclement convention

**Evidence:** Ch4:58 introduces the criterion; Ch4:59–62 asks for decisions from curves with stable open loop; Ch4:63–65 includes unstable open loops; Ch4:66–68 asks for a `K,T` condition; Ch4:71 explicitly replaces `G` by `GH` for nonunit feedback. S09:4,7,9,11 supplies the condensed course treatment.

**Actual task family:** combine the loop's open-RHP pole count with winding information to infer closed-loop RHP roots. The unstable-open-loop examples prevent the incorrect universal rule “no encirclement means stable.”

**Tool action:** trace the complete chosen contour and mapped curve together, label its direction, count windings and show the matching `P,N,Z` equation. Allow a scalar nonunit sensor `H(s)` while keeping the external system SISO. Boundary crossings and poles on the contour require special treatment.

**Check:** start with the S09 simple case `L=4/[(s+1)(s+2)]`, which has no imaginary-axis poles. Use complete curves for the formal winding calculation. The original slides use a positive-frequency presentation and a stated direction convention; their wording must not be mixed with a full-contour convention without derivation. A coarse frequency polyline or two positive margin numbers alone is not a general stability proof.

**Diagnostic:** tracing the closed-loop transfer instead of the loop transfer, ignoring `H`, or forgetting unstable open-loop poles.

### S7. BIBO, internal modes and imaginary-axis multiplicity

**Evidence:** Ch4:5–8 introduces BIBO and pole classification; S06:4 explicitly distinguishes reduced-transfer BIBO from internal eigenmodes and warns against canceling an unstable mode. This is a conceptual exercise even in a SISO-only course.

**Tool action:** compare a scalar transfer's visible poles with a retained state realization and its free response. Offer simple versus repeated imaginary-axis modes. Students select the stability statement they can actually justify and the input/initial-state conditions behind it.

**Proposed verification fixtures:** `A=diag(1,-2),B=[1;1],C=[0,1],D=0` gives the stable transfer `1/(s+2)` while an initial first state grows as `exp(t)`. A simple imaginary pair can have bounded unforced motion yet fail BIBO stability under resonant forcing; a repeated imaginary Jordan mode can grow even without input. An unreduced rational expression alone does not prove a particular physical hidden realization exists.

**Diagnostic:** labeling every imaginary-axis root configuration “stable boundary” without checking multiplicity/realization and without distinguishing BIBO from zero-input behavior.

## Plots, Performance and Controller Design: connected exercise coverage

### P1. Read and construct a plot before judging the system

**Evidence:** S05:4–11,13–14; Ch3 typical-element and Bode examples; Ch4:30–49 root-locus construction.

Treat a plot as a mathematical representation with a particular exercise mode: estimate Bode asymptotes/corners, measure sinusoidal gain/lag, place roots from factors, or construct a root locus. A shared frequency/pole cursor can connect them, while each mode asks for an answer. For `G0=1/[(s+1)(s+2)]` at `ω=1`, check magnitude `0.316228` and phase `-71.565°`. A plot view does not itself decide stability or fulfill a performance requirement; those actions open the corresponding block with the same case.

### P2. Performance specifications, error and measurement conventions

**Evidence:** S07:3–11,13–14 and its worksheets; Ch5:8–32. The exercises switch reference type, calculate error constants, measure transient quality and compare integral indices.

The student selects the actual signal/error channel, reference and measurement convention. The tool highlights the overshoot point, rise interval, settling band and shaded error area. For `T=4/(s²+2s+4)`, check `ζ=0.5,ωn=2`, overshoot about `16.303%`, measured 2% settling about `4.039 s`, and distinguish the `4 s` approximation. For unity-feedback `L=4/[s(s+2)]`, unit-step error is zero and unit-ramp error `0.5`. Final-value conditions and interval-dependent integral costs are part of the exercise, not hidden preconditions.

### D1. Design, verify every pole and explain the remaining error

**Evidence:** S08:5–11 and `Phieu_nhom_Buoi_08.md`; S09:5–11; S10:4–11; S11:4–11,14 and its individual worksheet; original Ch6:21–93.

Use separate exercise modes for lead/lag in the locus, lead/lag in frequency, linear PID, state feedback and a Luenberger observer, all receiving the same case and requirement record. A student must propose parameters and verify the actual full-order model. The S08 lead example has poles `-4,-2±2j`; checking only the requested pair is insufficient. S11 target poles `-2,-4` give `K=[6,3]`, while reference multiplier `N=8` is a separate tracking step. The individual S11 sensor variant `C=[0,1]` remains observable: its observability matrix determinant is `2`. “A different sensor makes it unobservable” must not be an assumed answer. The original nonlinear PID limit/windup material is excluded by the revised LTI scope.

## Consequences for the organized plan

The deepening adds several exercise modes that a flat list concealed: derivative-input ODE realizations, integrator-output state extraction, equivalent state-coordinate checking, state-transition/free-response decomposition, both Routh special cases, low-order Hurwitz inequalities, parameter normalization for root locus, nonunit sensor loop identification and stability definitions after cancellation.

These should appear inside the five continuous blocks as named exercise modes, with synchronized supporting views. They do not require eighteen unrelated applications. Representation owns conversion; Plots owns constructing/reading a view; Stability owns justified classification; Performance owns measuring specifications; Controller Design owns selecting parameters to meet them. A shared case and exercise record carries the model, attempted answer, constraints, reveal settings and verification evidence between blocks.
