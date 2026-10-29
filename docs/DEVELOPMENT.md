# Development and build guide

**Initial shell milestone, 29 October 2026.** This guide describes the implemented C/Raven entry GUI and blank module containers. The exercise mathematics in the atlas is future work.

## Layout and lifecycle

| Location | Responsibility |
|---|---|
| `src/main.c` | Startup, theme, developer command-line options and event loop |
| `src/shell.c` | One native window, domain/topic navigation, grid/search and module page containers |
| `include/csdktd/module.h` | Narrow immutable descriptor and module lifecycle contract |
| `src/module_registry.c` | Registry of the 56 module descriptors |
| `modules/<id>/module.c` | One independent subapplication implementation |
| `modules/CMakeLists.txt` | Independent `csd_module_<id>` static targets and aggregate link target |
| `assets/` | Existing HCMUT logo, Windows icon/resource and provenance |
| `tests/catalog_test.c` | Catalogue identity, grouping, baseline and blank-mount checks |
| `tests/lifecycle_test.c` | Stateful mount/reset/unmount and window-close cleanup checks |

The flow is **grid → module page → grid**, with content replacement inside the same top-level window. Each visit starts from that module's baseline. The descriptor's `baseline` is currently explanatory text, not a computed result.

A module mounts controls under `host->content` and owns its private `host->state`. It should release state, timers and resources during unmount before the shell destroys its widget subtree. Reset restores the local baseline; returning after leaving begins a new visit. The shell also releases the active module when the application closes.

Do not call another module's private functions or retain its widgets/state. Reusable numerical or drawing helpers may share code, with explicit caller-owned inputs/workspaces/results. Separate static libraries do not isolate memory faults: all linked modules run in one process. There is no dynamic-plugin/DLL loader or per-module process requirement.

No save/load, session restoration, project-file or student export workflow is implemented or required. The developer screenshot option below writes an inspection image only.

## Dependency pin

CMake fetches Raven at:

```text
c4410662723bf0eec633a36a7c2e4d69490325cf
```

Its [pinned build instructions](https://github.com/oscar-soirey/Raven/blob/c4410662723bf0eec633a36a7c2e4d69490325cf/README.md) are the source for the platform prerequisites below. Raven examples, tests, designer and web support are disabled for this application. Its development SDK and unused build tools are excluded from the application installation/default build. Raven is linked statically. Vulkan headers may be downloaded at configure time if no SDK/header path is available.

An existing checkout can be used instead:

```powershell
cmake -S . -B build/windows -G "Visual Studio 17 2022" -A x64 `
  -DCSDKTD_RAVEN_SOURCE_DIR="C:/path/to/Raven"
```

A local override bypasses the default source fetch. Use the pinned revision for reproducibility and record deliberate deviations. Keep compiler/runtime and architecture consistent across the application and Raven build.

## Windows x64: build, test and install

Prerequisites: Visual Studio 2022 with **Desktop development with C++**, CMake 3.24+, Git, and a Vulkan-capable driver for the normal GUI. The application and Raven request the static MSVC runtime in this configuration. That choice alone does not establish legacy Windows compatibility.

From Developer PowerShell at the repository root:

```powershell
cmake -S . -B build/windows -G "Visual Studio 17 2022" -A x64
cmake --build build/windows --config Release --parallel
ctest --test-dir build/windows -C Release --output-on-failure
cmake --install build/windows --config Release --prefix out/windows
```

Run the installed application:

```powershell
& ".\out\windows\bin\CSDKTD APP.exe"
```

The uninstalled build is `build/windows/Release/CSDKTD APP.exe`; the installed executable is `out/windows/bin/CSDKTD APP.exe`. Keep the installation's notices/license files with the distributable. The HCMUT PNG is embedded by the build and the Windows executable includes its icon resource. A normal Release build is a desktop application; Debug retains a console.

Build output is ignored by Git. Do not commit `build/`, `out/` or generated executables.

## Developer entry points

Examples below use the Windows Release build. Quote the executable name because it contains a space.

```powershell
& ".\build\windows\Release\CSDKTD APP.exe" --list
& ".\build\windows\Release\CSDKTD APP.exe" --open CR05
& ".\build\windows\Release\CSDKTD APP.exe" --discrete
& ".\build\windows\Release\CSDKTD APP.exe" --discrete --category 2
& ".\build\windows\Release\CSDKTD APP.exe" --smoke-test
& ".\build\windows\Release\CSDKTD APP.exe" --gui-smoke-test
& ".\build\windows\Release\CSDKTD APP.exe" --open CR05 --capture build/module-cr05.ppm --frames 6
```

| Option | Behavior |
|---|---|
| `--list` | Print module IDs, domains, groups and names without initializing the GUI |
| `--open ID` | Open one module page, e.g. `CR05` or `DD07` |
| `--discrete` | Start in the Discrete section |
| `--category 0..4` | Select Representation, Plots, Stability, Performance or Controller Design, respectively |
| `--smoke-test` | Exercise routes/reset/lifecycle using Raven's headless/null backend; does not verify Vulkan rendering |
| `--gui-smoke-test` | Run the navigation check through the real Vulkan backend; requires a usable renderer |
| `--capture path.ppm` | Capture the rendered window as a P6 PPM inspection image |
| `--frames N` | Render a finite number of frames, then exit; a capture defaults to six frames when omitted |

The normal shell also supports `Ctrl+F` for search, `Esc` to return from a module, and `Ctrl+Home` for the selected domain's overview. The window supports resizing; the module/topic grid adjusts its column count.

The default CTest run covers catalogue metadata, headless navigation and a stateful lifecycle fixture, including reset and native-window close cleanup. Headless success checks routing/ownership, not font layout, mouse/keyboard behavior or GPU compatibility. Pair it with a real renderer smoke run and visual/manual navigation checks. Configure with `-DCSDKTD_GUI_TESTS=ON` to include the real Vulkan navigation smoke run in CTest on a machine with a usable driver. Future module tests should ensure reset/unmount releases their resources while the host widgets remain valid.

## Linux: tentative build path

This application has not been built or tested on Linux during the shell milestone. The pinned Raven instructions call for a C compiler, Git, CMake and X11 development headers. For a Debian/Ubuntu-style environment, their suggested prerequisites are `build-essential`, `cmake`, `git`, `libx11-dev` and optionally `ninja-build`. A working Vulkan loader/driver is required for the visible GUI. The implemented Raven Linux backend is X11; use in a Wayland session initially depends on XWayland.

An intended build sequence is:

```sh
cmake -S . -B build/linux -DCMAKE_BUILD_TYPE=Release
cmake --build build/linux --parallel
ctest --test-dir build/linux --output-on-failure
cmake --install build/linux --prefix out/linux
"./out/linux/bin/CSDKTD APP"
```

These commands are a starting point for a port test, not a statement of a verified distribution, libc baseline or package. Confirm both the headless and rendered path on the actual target.

## macOS: tentative build path

This application has not been built or tested on macOS during the shell milestone. The pinned Raven README calls for Xcode command-line tools, CMake and Vulkan-on-Metal support such as MoltenVK. Raven's Cocoa bridge uses Objective-C while the application/modules remain C. Current Vulkan portability choices and OS/architecture differences are discussed in [platform feasibility](PLATFORM_FEASIBILITY.md).

An intended native-architecture build sequence is:

```sh
cmake -S . -B build/macos -DCMAKE_BUILD_TYPE=Release
cmake --build build/macos --parallel
ctest --test-dir build/macos --output-on-failure
cmake --install build/macos --prefix out/macos
```

CMake marks the application as a macOS bundle. Distribution still requires a tested Vulkan loader/driver arrangement inside the bundle, architecture-compatible libraries, a selected deployment baseline and appropriate release/signing work. The current generic install rules do not claim to produce a complete portable Mac package. Intel and Apple Silicon must be tested separately.

## Support and future math

Only the local Windows x64 shell build/run has been tested so far. Linux/macOS, Windows 7/8/8.1 and the complete Windows target matrix remain unverified. The normal GUI currently has no software-rendered or OpenGL fallback. A headless/null test backend draws no visible interface and cannot substitute for one.

No numerical or symbolic library is linked into the shell. [MATH_BACKEND_OPTIONS.md](MATH_BACKEND_OPTIONS.md) compares C-callable matrix, control and exact-algebra candidates for later work. Keep each module's mutable exercise state independent even when it calls shared numerical services.

No application-wide software license has been selected. Preserve Raven's Apache-2.0 license/notices and the separately identified logo provenance; see [third-party notices](../THIRD_PARTY_NOTICES.md).
