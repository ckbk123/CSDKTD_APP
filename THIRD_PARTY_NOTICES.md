# Third-party notices

Control Studio is a static TypeScript/HTML/CSS browser scaffold.
Raven, its bundled fonts and the native Vulkan renderer are no longer included
in the active source or browser distribution. The earlier native experiment
is recoverable in Git history at commit `a7302e8`.

The project-authored Control Studio pole/zero vector mark is `public/control-studio.svg`, used in the header and favicon. The HCMUT logo is preserved unchanged for institutional footer credit and retains the provenance described in [docs/ASSETS.md](docs/ASSETS.md).
The application uses installed system fonts. No numerical or symbolic backend
is installed yet; future candidates are in
[docs/MATH_BACKEND_OPTIONS.md](docs/MATH_BACKEND_OPTIONS.md).

Development dependencies are pinned in `package-lock.json` and keep their
upstream licenses in their installed packages. Vite's generated module-preload
helper is distributed with the Vite MIT notice in
`public/licenses/Vite-LICENSE.md` (copied to the browser build).

No application-wide software license has been selected. Review the actual
licenses and notices of every newly bundled numerical, plotting or symbolic
dependency before adding it to the browser distribution.
