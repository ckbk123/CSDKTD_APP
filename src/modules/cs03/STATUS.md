# CS03 implementation status

- **Stage:** implemented
- **Last assessed:** 2026-10-29
- **Worker chat:** `01a186d2-2175-7122-ad9f-c01694059c6c`
- **Contract / ownership:** [TASK.md](TASK.md), `src/modules/cs03/**` only
- **Branch:** `codex/cs03-parameter-regions-2175`
- **Worktree:** `C:/Users/baokh/.codex/worktrees/cs03-parameter-regions-2175/CSDKTD APP`
- **Baseline primary main:** `0c6f038e37c321169cbbac9961c3c3ebd125d25a` (v0.3.2)
- **PR / submission:** implementation and checks complete; PR URL and exact clean submission are recorded below when created

## Scope and accepted requirements

Initial inspection found immutable metadata, an empty synchronous mount and no local tests. No working module feature was replaced. The current primary coordination guides govern this preserved worktree. Source/audit anchors confirm the cubic gain exercise and W06 variation; original slides were not inspected. Extra fixtures below are independently derived, not newly attributed slide examples.

The complete bounded exercise is implemented and checked in the production browser:

| Accepted requirement | Implemented evidence | Remaining gate |
|---|---|---|
| Form the feedback characteristic polynomial | Editable visual D(s), native scalar g; derive P=D+Kg | Passed actual fraction/power entry |
| Derive the complete gain region | Exact rational affine Routh conditions, finite open/all-real/empty sets | Passed changed-data browser checks |
| Mark every inequality on one parameter axis | Four condition strips plus intersection, open equality markers and selected K | Desktop and phone checked |
| Student interval and endpoint inclusion | Two visual endpoint fields, finite/all/empty selection, open/closed controls and independent grading/reveal | Exact long fractions and closed-endpoint feedback passed |
| All roots at interior/exterior/boundary gains | Exact inspection gains, full numerical cubic modes, Routh table, factors, counts/residuals | Every source boundary/interior/exterior checked |
| Required baseline and W06 variation | Independent 0<K<70 and 0<K<48 tests and computed changed-data presets | Passed browser/reset verification |
| Lifecycle and readable input | Three caller-owned equation editors, scoped styles, cold-load status, child-signal abort/failure cleanup | Keyboard, fast navigation and narrow viewport passed |
| Delivery | Clean pushed checkpoints and current claim | One attached PR and final exact submission are the remaining bookkeeping |

## Mathematical domain and reasoning

Negative unity SISO feedback uses L(s)=Kg/D(s), D(s)=s³+a s²+b s+d and P(s,K)=D(s)+Kg. The editable coefficients and g are real. No factors are cancelled, including g=0: all characteristic D modes remain. K is dimensionless; time is in seconds and s has units s⁻¹. Coefficients a,b,d have units s⁻¹,s⁻²,s⁻³, and gK has units s⁻³. There is no sample period.

With c(K)=d+gK, strict cubic Hurwitz stability is exactly a>0, b>0, c(K)>0 and ab−c(K)>0. Each condition is constant or affine in K. Their exact intersection is the complete real-gain set, rather than a sampled proof. For a,b>0 and g≠0 the open endpoints are the sorted values −d/g and (ab−d)/g. Nonpositive a/b gives the empty set; g=0 gives all real gains only when the gain-independent D is strictly Hurwitz.

The interface shows P, both affine inequalities, all condition values, the common parameter axis and the Routh table. For nonzero a the first column is 1,a,(ab−c)/a,c. Zero entries receive explicit special-treatment feedback rather than a fabricated sign-change count; a=0 never divides by zero. Endpoint identities P=s(s²+as+b) at c=0 and P=(s+a)(s²+b) at c=ab remain exact. For a,b>0 these exclude the zero mode and ±j√b boundary pair from strict stability; frequency is √b rad/s.

Exact buttons select both equality gains, midpoint and exterior points one quarter-interval width beyond the endpoints. Fractional K is retained in the selected polynomial, root calculation and displayed reasoning. Global inspection may lie outside the manual/window bounds. The diagram is clipped to its chosen window; the exact global answer remains visible. All three roots including multiplicities are listed; overlapping plotted crosses are explained.

Cubic roots use exact c=0/c=ab factorizations, exact discriminant sign, real Cardano/trigonometric branches and repeated/triple-root cases. The conjugate imaginary part avoids subtraction cancellation. Root coordinates are numerical, distinct from exact stability decisions. Each calculation checks the complex polynomial residual normalized by the sum of term magnitudes or1, maximum1e-8. Axis tolerance is1e-8 times max(1,largest root magnitude). Exact inequalities/Routh signs retain the decision when a numerical mode is within axis tolerance. Nonfinite roots, excessive exact precision and failed residual checks produce useful errors.

## Input and computation bounds

- D(s) is exactly monic cubic after expansion; internal coefficient order is ascending [d,b,a,1]. Supported: sums/products, constant division, visible parentheses, powers0..3 and signed numeric visual fractions. Compact MathLive one-token fraction forms are accepted. Nested visual fractions, invisible generic brace grouping, visual e notation and K inside D are unsupported.
- Mixed whole-number/fraction adjacency is rejected with explicit +/× guidance before expansion. Pure lexical preflight protects supported numeric fraction arguments and powers, then checks grouping/adjacency. Explicit sums/products, visible parenthesized products, ordinary adjacent fractions and power-followed-by-fraction products preserve their displayed meaning. An earlier MathML diagnostic prototype was replaced; final math has no MathLive renderer import.
- D limits:300characters,160symbols,12groups; literals9digits/6decimal places; final nonzero coefficient magnitudes1e-8..100 and reduced coefficient parts≤1e12. Exactly zero coefficients are supported.
- g is zero or has magnitude1e-8..100. Manual K and axis endpoints are finite in[−1000,1000], with minimum<maximum. Native finite exponents are accepted; empty/nonfinite text and nonzero raw underflow are rejected. Intentional0e-999 remains zero.
- Exact fraction arithmetic caps components at2048bits before reduction; sign comparisons can form temporary4096bit products. Some extreme equivalent expressions can conservatively hit this declared limit.
- Student endpoints use separate constant-only visual arithmetic: signed numeric fractions, decimals, sums, explicit products/divisions and visible parentheses; no variables/powers/e notation/nested visual fractions. Limits300characters,80symbols,12groups,80digits/50decimal places per literal, magnitude≤1e13 and the same precision cap.
- Endpoint comparison uses rational arithmetic, with tolerance capped by BOTH1e-6*max(1,abs(endpoint)) and1e-4*interval width. Very narrow intervals require exact fractions or sufficient decimal precision. Missing/incomplete notation, unsupported expressions, wrong values, wrong set kind and closed endpoints have separate feedback. Editing a checked answer marks its feedback stale.
- No higher-order region or arbitrary K-dependence in a/b is claimed. No remote solver, persistence, API, dependency or shared-file change is included.

The equivalent local native-number reader is an explicitly approved carry-forward because this baseline predates shared readNumericInput. The coordinator owns adaptation to the shared helper during integration; do not add unowned shared files or rebase this branch to obtain it.

## Independent verification

Source baseline D=s(s+2)(s+5) gives0<K<70; K=0 has{0,−2,−5}, and K=70 has{−7,±j√10}. W06 D=s³+6s²+8s gives0<K<48 and boundary{−6,±j√8}. These factor identities are independent root oracles.

Proposed independent variations cover g=−1 giving−70<K<0; d=1 translating to−1<K<69; d=1,g=−2 giving−69/2<K<1/2; d=.1,g=.3 giving−1/3<K<3; gain-independent stable/all-real, unstable/empty and boundary/empty cases; nonpositive a/b and a zero Routh pivot. Known factored cubics supply distinct real, conjugate, repeated and triple roots. Forty-eight changed triples pass independently evaluated residuals and Vieta sums. Tiny conjugate parts near a triple root, balanced huge rational conversion, exact K=±1e-100 decisions and a global K=1e10 boundary are covered.

Grading regressions reject a false1e-7-wide interval for the true width1e-18 and accept exact −100<K<−999999999999999999/10000000000000000 even when direct binary endpoint conversion collapses both to−100. Parser tests cover signed/compact fractions, mixed-number/grouping semantics, malformed/unsupported input and bounded work.

Workspace tests use a mocked editor only for caller state/lifecycle, not browser functionality. They verify changed data, exact fractional selection, prediction/error recovery, intentional zero/finite exponent/nonzero-underflow distinctions, fresh reopen, immediate abort and cold-load status. A partial-mount failure creates a button and document listener before throwing; both are removed/aborted immediately while the parent remains active. The wrapper owns its child signal/container, ignores late imports and provides a recoverable Reset message.

Actual Node24 checks after the final browser-discovered root-plot correction:

- `npm test -- src/modules/cs03`:63/63 passed (51math/parser,12workspace).
- `npm run check`:passed.
- `npm test`:197/197 passed across13files on the recorded v0.3.2 baseline.
- `npm run build`:passed; existing MathLive large-chunk warning only.
- `git diff --check`:passed; owned files only, metadata unchanged, generated output untracked/ignored.

## Actual production-browser evidence

The coordinator proved private IAB tab/viewport isolation with CD08, then explicitly authorized parallel private-chat QA without the old global lock. Before proceeding, this worker rechecked inventory: browser2 codexSessionId matched this chat01a186d2-2175-7122-ad9f-c01694059c6c, with no tabs. All following checks used only own background tab5 at own production preview8825. Primary8787 and other workers' tabs/resources were untouched. The obsolete release watcher88157 had already terminated without acquiring; no reservation was held or released.

Actual in-app Chromium checks on Windows, system dark theme, desktop1280×720/1000 and phone390×844:

- Cold load showed the working exercise without a stale Implementation pending label. Three visual fields, readable fraction/power glyphs and the Systems keyboard rendered; error/warning logs were empty.
- Entered baseline endpoints0 and70, activated Check through Tab/Enter, and received agreement. Closed upper endpoint received strict-boundary feedback. Exact K=0 roots were0,−5,−2; K=70 roots were−7,±j3.1622777. Above K=175/2 had two numerical RHP roots; below K=−35/2 had one; midpoint35 was strictly stable.
- W06 recomputed0<K<48 and boundary−6,±j2.8284271. Reverse polarity recomputed−70<K<0. Gain-independent D=(s+1)(s+2)(s+3),g=0 graded all real K, hid unused bounds and retained all modes−1,−2,−3. D=s³+4s+1 gave an empty set with explicit zero-pivot feedback.
- Used real power/fraction buttons to enter s³+s²+s+1/10, nativeg=.3 and actual negative compact fraction−1/3 in the lower answer. Grading returned−1/3<K<3. Exact inspection preserved K=−1/3 with roots0,−.5±j.8660254 and K=3 with−1,±j1.
- Actual mixed2(1/2) adjacency was rejected in BOTH D and a student endpoint, with explicit +/× guidance and no result plots. Systems-keyboard multiplication produced2×(1/2); after committing the editor draft with Enter, the shifted D=s(s+2)(s+5)−1 graded1<K<71 correctly. Escape dismissed the keyboard; an uncommitted editor draft received completion feedback instead of a solved answer.
- Entered s³+s²/100000000+s/100000000+100 using actual fraction/power buttons and the exact long upper answer−999999999999999999/10000000000000000. It graded the interval from−100 correctly despite collapsed native endpoint conversion. Exact upper inspection retained c=1e-16 and roots−1e-8,±j1e-4. Long headings/buttons and fraction fields stayed inside the phone page.
- Browser review found the root plot's former minimum±1 range visually compressed tiny modes. The final plot fits nonzero computed modes, retaining a finite default for all-zero modes, with short ×10/superscript tick labels. After rebuilding/reloading, the phone plot visibly separated ±j1e-4; labels and all three listed modes were readable. Coefficient/result equations and the five-row condition diagram scroll within their own areas.
- Native K=1e-999 gave a finite-input error and zero computed SVGs;0e-999 selected0 and1e-2 selected exact1/100. Native g underflow also cleared results, intentional zero gave an all-real set, and g=1e-2 recomputed−10<K<90. Reversed/equal axis endpoints, visual e notation and an incomplete fraction produced useful distinct feedback and cleared stale results.
- Reset with the keyboard open restored g=1,K=10,window[−10,80], finite/open answer controls and empty attempt/results; reveal returned0<K<70. Rapid CS03→CR01→CS03→CR01 navigation left zero CS03 roots, zero mathfields and no old keyboard. Reopening CS03 restored three fresh editors and the baseline. Phone keyboard and native controls remained usable; document clientWidth=scrollWidth=375.

Evidence screenshots are outside Git under C:/Users/baokh/.codex/visualizations/2026/10/29/01a186d2-2175-7122-ad9f-c01694059c6c/: cs03-browser.png (exact fractional inequalities), cs03-phone.png (final fitted tiny-root plot) and cs03-keyboard.png (phone editor/Systems keyboard). Screenshots were inspected and representative images displayed in the worker chat. Light theme and other browser engines were not separately tested; no all-browser or offline guarantee is claimed.

Own viewport override was reset, tab5 closed, and preview process72504 on port8825 stopped. No browser reservation/waiter remains. The earlier Firefox fallback launch exposed ambiguous concurrent windows; no native page input/focus/close was sent, unknown windows were preserved, and that unsupported route was stopped after the coordinator's instruction. No Firefox module evidence is claimed.

## Remaining integration work

The accepted bounded exercise and required worker checks are complete. Independent coordinator review and the approved native-reader adaptation remain integration responsibilities. PR attachment/URL and exact clean checked branch submission are recorded next. No merge, version change or deployment is performed by this worker. Intermediate checkpoint history remains recoverable in this branch's Git commits.
