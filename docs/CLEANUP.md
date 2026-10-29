# Browser migration cleanup

29 October 2026. The active checkout now contains the browser application,
course research, module task briefs and Cloudflare configuration.

Removed from the active checkout and current Git tree:

- Native C/Raven source, static-library stubs, C headers/tests and CMake setup.
- Raven's downloaded source, MSVC output, native executables/packages and PPM captures.
- Windows-only icon/resource files, obsolete native run instructions and native screenshots.
- Temporary application-specific slide extraction/media and temporary npm setup files.

The native implementation remains recoverable from Git commit `a7302e8`.
Local obsolete files were moved into a recoverable `CSDKTD-native-archive-2026-10-29`
folder under the machine's temporary directory, outside the course workspace.
They are not copied to GitHub or included in the web build. No recursive purge
of the course workspace was performed.

The native platform study is retained under `docs/history/` and marked historical.
Course source decks, textbooks, worksheets, lecture-production tools and unrelated
course outputs remain in their original locations. Research audits and all 56
mathematical exercise contracts remain in the repository. The HCMUT PNG moved
to `public/hcmut.png` with its provenance in `docs/ASSETS.md`.

`node_modules/`, `dist/`, `.wrangler/` and local caches remain generated/ignored.
Only source, the package lockfile, required public assets, configuration and
documentation are synchronized to GitHub. Do not commit dependencies, credentials,
local preview output or deployment archives.
