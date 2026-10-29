# Visual equations and input

Use the shared equation UI in `src/shared/equations/input.ts` for textbook-style fractions, powers, roots, subscripts, matrices and symbols. Students can edit the displayed mathematics directly, use the symbol buttons, or open the math keyboard. Visual mathematics is the primary interface: students must not need MATLAB syntax or knowledge of LaTeX to use a teaching tool. LaTeX is an internal interchange format for developers.

The implementation uses **MathLive 0.111.1**, pinned in the package files. This is a presentation and editing dependency; no CAS or general control-system expression parser is installed. A well-typeset expression is not evidence that it is complete, mathematically valid, supported by a solver, or a valid SISO LTI system.

The math keyboard starts with a **Systems** layout containing `s`, `z`, `K`, `j`, frequency/damping symbols, digits, fraction/power templates, trigonometric functions and cursor controls. Standard numeric, symbol, alphabetic and Greek layouts remain available. The keyboard button toggles visibility; Escape and leaving/resetting the module also close it.

## Existing example preview

All 56 module banners have curated equation parts in `src/shared/equations/examples.ts`. Prose remains prose; equations use explicit LaTeX rather than automatic conversion of arbitrary strings. The original `manifest.defaultExample` text is retained and checked against each curated source.

The banner's **Edit equations** action opens shared visual inputs. **Done editing** returns to a typeset view of those temporary edits. This is an equation preview: edits do not update the module workspace or a mathematical model. Reset, leaving the tool and reopening start from the baseline again. There is no persistence.

When implementing a module, build its actual exercise inputs inside its own workspace with the shared component below. Do not treat the shell preview as a solver input channel, and do not couple modules through it.

## Input contract

`createEquationInput({ label, value, signal, onChange? })` returns:

| Member | Purpose |
|---|---|
| `element` | Append this wrapper to the workspace; it includes the field, symbol buttons and notation feedback. |
| `getValue()` | Read the current `EquationDraft`. |
| `setValue(latex)` | Update the field without calling `onChange`; synchronize caller state explicitly if needed. |
| `focus()` | Focus the field. |
| `destroy()` | Idempotently release listeners, release this field's keyboard focus and remove this input. |

The `input` event and symbol tools deliver `onChange(draft)`. A draft contains `latex`, `empty`, `hasPlaceholders` and `syntaxIssues` (LaTeX syntax error codes). These are editing signals, not mathematical validation. There is no initial `onChange` notification: append the element, then call `getValue()` for the initial draft. The caller's abort signal destroys the input automatically; return `destroy()` from cleanup as well when appropriate. Discard the instance after destruction.

Each instance and its draft belong to one mount. This example shows notation feedback only; its final message deliberately requires the module's mathematical validation before computation:

```ts
import type { ModuleMount } from '../../core/module';
import {
  createEquationInput,
  type EquationDraft,
} from '../../shared/equations/input';

export const mount: ModuleMount = ({ container, signal }) => {
  let draft: EquationDraft;
  const status = document.createElement('p');
  status.setAttribute('role', 'status');

  const showStatus = () => {
    status.textContent = draft.empty ? 'Enter a plant transfer function.'
      : draft.hasPlaceholders ? 'Complete the highlighted boxes.'
      : draft.syntaxIssues.length ? 'Check the equation notation.'
      : 'Ready for module-specific validation.';
  };
  const plant = createEquationInput({
    label: 'Plant transfer function',
    value: String.raw`G(s)=\frac{1}{s(s+2)}`,
    signal,
    onChange: next => { draft = next; showStatus(); },
  });

  container.append(plant.element, status);
  draft = plant.getValue();
  showStatus();
  return () => plant.destroy();
};
```

`createEquationDisplay(latex, label)` returns a read-only typeset element for results, intermediate equations and other mathematical explanations. Append it where needed and replace/remove it with the caller's result view. It has an accessible spoken label. Give it deliberate mathematical markup; do not interpolate raw user text into HTML.

## Goal for module agents

1. Read the assigned tool's `TASK.md` and use the shared visual input for its mathematical expressions. Keep all mutable drafts and validated models inside `mount`.
2. Define the accepted mathematical grammar and conventions: for example, rational polynomials in `s` or `z`, whether the field includes `G(s)=`, supported parameters, coefficient order, feedback sign and sample time. Make unsupported forms understandable to the student.
3. Add a bounded parser/validation step before calling the numerical or symbolic algorithm. Reject incomplete drafts, unsupported variables/functions, nonfinite values, invalid dimensions and excessive size/order. Never use `eval`, an LLM, canned answers, or LaTeX appearance as a substitute for this step.
4. Test parsing and mathematics against independent expected results, changed inputs and failure cases. Coordinate a reusable parser or dependency with the integration owner rather than implementing conflicting shared APIs in parallel.
5. Show results through `createEquationDisplay`, plots and the module's teaching explanation. Keep useful numeric controls alongside visual inputs where the exercise benefits from them.

The editor does not define a universal mathematical grammar for all 56 tools. A differential equation, transfer function, matrix and design constraint need different validated models even though they share one input interface.

### Preserve the meaning of the displayed equation

Parse what the student sees, rather than borrowing a programming-language number grammar. For example, MathLive renders `1e-2` as the mathematical expression **1·e − 2**; interpreting that string as the JavaScript scientific literal 0.01 silently solves a different problem. Reject unsupported e/E symbols in a bounded rational-expression parser, or explicitly support textbook powers such as `10^{-2}` with the displayed meaning. A native HTML numeric control has a separate grammar and can legitimately accept exponent notation. Scientific **result formatting** should still use a typeset multiplication/power of ten.

Check actual editor serialization. MathLive may emit `\frac12`, `\frac{1}2` or `\frac1{2}` for the same visible fraction. Accept these forms where fractions are supported, preserving TeX's one-token argument rule. Test outer grouping and unary signs too: a supported negative ratio must preserve its meaning whether its minus is outside the fraction or in its numerator. Nested numeric fractions need equivalent tests when included in the declared grammar. A malformed draft, an unsupported complete expression and a valid supported expression require distinct feedback. Include a real fraction-button exercise in browser evidence rather than testing only developer-authored braced strings.

Numeric/fraction adjacency needs its own check **before** normalization discards its notation. Pinned MathLive displays `2\frac12` as the mixed number 2+1/2, with an invisible plus in MathML; silently treating it as 2×1/2 solves the wrong problem. Either preserve its displayed meaning or reject the ambiguous adjacency with guidance to enter explicit + or ×. Cover signed/grouped and nested cases, alongside valid `2+\frac12`, `2\times\frac12` and ordinary compact fractions. Editor syntax feedback alone does not catch this semantic mismatch.

Distinguish TeX argument braces from visible parentheses. Fraction arguments and exponents need their proper grouping, but standalone formatting braces in `1{+2}` or `{z+2}z` do not show the student parentheses. Do not silently replace them with visible algebraic grouping. Preserve the displayed meaning when unambiguous, or reject unsupported hidden grouping and request visible parentheses. Test these cases separately from ordinary fraction arguments, numeric wrappers and explicit parenthesized expressions.

### Native numeric controls

Use `readNumericInput(input, label)` from `src/shared/numeric-input.ts` when reading native number controls. It preserves representable exponent syntax and intentional zero, but rejects empty/nonfinite values and a nonzero raw mantissa that the browser rounds to zero, such as `1e-999`. The helper is stateless and does not change the control. Bounds, integer requirements, units and subsequent numerical conditioning remain the module's responsibility.

Catch its error in the module's normal feedback path; clear or hide stale computed results, and preserve a prior valid map point when a new candidate is invalid. Test genuine zero (`0` and `0e-999`), a normal native exponent (`1e-2`), a nonzero underflow and the module's range/integer boundaries. Text controls accepting exact fractions and visual equation fields have their own parsers and must not be routed through this native-number helper.

An older preserved branch may lack this helper. With an explicit coordinator disposition, an independently tested equivalent local reader can be carried forward to a functional submission; record the coordinator-owned API adaptation in STATUS. The integration owner applies and verifies that adaptation before accepting the release. Keep submitted history intact and create later module worktrees from current main.

## Local assets and lifecycle

The wrapper imports `mathlive/fonts.css` and `mathlive/static.css`. Vite emits all 20 referenced WOFF2 fonts as local hashed assets. The build disables asset inlining so even the smallest font remains a same-origin file, compatible with `font-src 'self'`. `MathfieldElement.fontsDirectory = null` disables MathLive's separate automatic font lookup; the imported CSS supplies the fonts. No runtime CDN is required. Keep the CSS import, build setting and font lookup setting together.

The wrapper sets `soundsDirectory = null`, `computeEngine = null` and `speechEngine = 'local'`. It does not load a remote solver or speech service. The math keyboard is shared by MathLive, but exercise values are not shared. Our cleanup hides the keyboard and removes the field; MathLive disposes its internal field when disconnected. Do not call private disposal methods or preserve a field across module visits.

The existing CSP allows the generated inline styles MathLive needs, while scripts and fonts remain same-origin. Link/HTML-style macros are overridden as display-only by the wrapper, and stock menu actions are hidden. Keep untrusted input out of application-authored `innerHTML`; the display helper inserts MathLive-generated markup. Bundled notices are in `public/licenses/MathLive-LICENSE.txt` and `public/licenses/KaTeX-Fonts-LICENSE.txt`.

## Browser verification

MathLive's Node export is a server-rendering build, not the interactive editor. Unit tests or a mocked component in jsdom do not prove that the visual field, fonts or keyboard work in a browser. Keep pure parser/math tests separate and check the actual production build in a real browser:

- Fractions, powers, roots, matrices and symbols render with local fonts and no blocked or remote asset requests.
- Direct typing, symbol buttons, selection, tab navigation and the math keyboard work; leaving an input does not trigger unintended shell navigation.
- Empty fields, incomplete boxes and syntax feedback are understandable; unsupported mathematical forms get separate module feedback.
- Reset and leave/reopen restore the baseline, rapid navigation causes no late updates, and no old keyboard remains visible.
- Light/dark themes and narrow screens remain usable without page-wide horizontal overflow.

Record the browser and checks actually performed. A successful build is not a claim of support for every browser or operating system.

### Verification at v0.3.0 (29 October 2026)

Type checking, 42 Vitest tests and the production build pass. `wrangler deploy --dry-run` accepts the static package; this does not publish it. Tests cover all 56 baseline sources, LaTeX syntax and fraction/matrix structure, independent preview drafts, reset/abort/disposal and shell integration.

The production build was inspected in the in-app Chromium browser at 1280 px and 390 px viewport settings using the system dark theme. Checks included CD02 typing and symbol insertion, empty/incomplete input feedback, the Systems keyboard, Done/reset keyboard dismissal, edit/display round trips, leave/reopen, CR03 matrix fields, DD01 nested fractions and page-width overflow. Light-theme colors use the shared tokens but were not separately browser-tested in this check.

All 20 fonts are emitted as local files, and the math assets run under the existing CSP. The shared editor/example JavaScript chunk is about 225 kB gzipped in this build, plus styles and fonts; it loads on module pages rather than the catalogue grid. Vite reports its normal large-chunk warning for this dependency. No solver or all-browser compatibility claim follows from these checks.

## Upstream references

- [MathLive integration and assets](https://mathlive.io/mathlive/guides/integration/)
- [Mathfield API](https://mathlive.io/mathfield/api/)
- [Virtual keyboard](https://mathlive.io/mathfield/guides/virtual-keyboard/)
- [Web component lifecycle](https://mathlive.io/mathfield/lifecycle/)
- [Security and CSP](https://mathlive.io/mathfield/guides/security/)
- [MathLive package and license](https://www.npmjs.com/package/mathlive)
- [KaTeX font license](https://github.com/KaTeX/katex-fonts/blob/master/LICENSE)
