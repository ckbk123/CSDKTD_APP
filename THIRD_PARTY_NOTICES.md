# Third-party notices

Control Studio is a static TypeScript/HTML/CSS browser scaffold.
Raven, its bundled fonts and the native Vulkan renderer are no longer included
in the active source or browser distribution. The earlier native experiment
is recoverable in Git history at commit `a7302e8`.

The project-authored Control Studio pole/zero vector mark is `public/control-studio.svg`, used in the header and favicon. The HCMUT logo is preserved unchanged for institutional footer credit and retains the provenance described in [docs/ASSETS.md](docs/ASSETS.md).
The application uses installed system fonts for its interface and bundled
KaTeX WOFF2 fonts for mathematical notation. No numerical or symbolic backend
is installed yet; future candidates are in
[docs/MATH_BACKEND_OPTIONS.md](docs/MATH_BACKEND_OPTIONS.md).

**MathLive 0.111.1** is the pinned runtime dependency for visual equation input
and display. It is distributed under the MIT license, preserved in
[`public/licenses/MathLive-LICENSE.txt`](public/licenses/MathLive-LICENSE.txt).
The bundled KaTeX fonts carry the MIT notice preserved in
[`public/licenses/KaTeX-Fonts-LICENSE.txt`](public/licenses/KaTeX-Fonts-LICENSE.txt).
Vite emits the imported font files as same-origin assets; no runtime CDN or
remote mathematical service is required. See the [equation UI guide](docs/EQUATION_INPUT.md)
and upstream [MathLive](https://github.com/arnog/mathlive) and
[KaTeX fonts](https://github.com/KaTeX/katex-fonts) sources.

Development dependencies are pinned in `package-lock.json` and keep their
upstream licenses in their installed packages. Vite's generated module-preload
helper is distributed with the Vite MIT notice in
`public/licenses/Vite-LICENSE.md` (copied to the browser build).

No application-wide software license has been selected. Review the actual
licenses and notices of every newly bundled numerical, plotting or symbolic
dependency before adding it to the browser distribution.
