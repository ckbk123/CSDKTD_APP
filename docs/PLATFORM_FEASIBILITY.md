# Platform feasibility and release decisions

**Status:** proposal for review, researched 28 October 2026. No application has been built or tested on the platforms below. Every requested Windows version remains a target for investigation; this document records the work required before support can be promised.

## Decision summary

C11 with Raven is a plausible direction for this teaching application. Develop the mathematics as a portable library with no dependency on the window system or graphics API. Prototype Raven presentation separately, then test the resulting executable on representative student machines before committing the full feature catalogue to it.

Windows 10/11 and Linux with X11 are the most direct initial implementation paths. Windows 7/8 need a deliberate compatibility investigation covering the GPU driver, compiled operating-system imports and C runtime. macOS needs a bundled Vulkan-on-Metal implementation and separate Intel/Apple Silicon checks. A generic statement that an operating system supports Vulkan is insufficient evidence that our package runs on a particular machine.

**Recommended early gate:** demonstrate a small window containing Vietnamese text, equations, a slider, a plot and a draggable diagram. Build a clean distributable and run it on the proposed platform matrix. Record measured limitations before approving the complete UI stack.

## Requested platform matrix

These are proposed release targets, not completed compatibility certifications. Initial CPU scope is x86-64 on Windows/Linux and arm64 plus x86-64 on macOS. Windows/Linux ARM64 and 32-bit machines require a separate decision.

| Requested environment | Evidence and likely path | Work required before support is declared |
| --- | --- | --- |
| Windows 7 SP1 x64 | Khronos lists Windows 7 as a Vulkan platform. Raven's MinGW build explicitly sets Windows 7 API target macros. | Audit imported APIs and runtime dependencies; select a compatible toolchain/CRT and loader; run on actual compatible GPU/driver hardware. |
| Windows 8 x64 | Khronos lists Windows 8. Raven uses a Win32 surface. | Test Windows 8 independently rather than assuming a Windows 8.1 result applies; verify driver and runtime availability. |
| Windows 8.1 x64 | Candidate legacy Win32/Vulkan deployment target. | Separate clean-machine smoke test and dependency audit; do not infer support from the OS name alone. |
| Windows 10 x64 | Direct Win32/Vulkan path; also a documented host for the current Windows Vulkan SDK. | Test representative integrated graphics and a clean installation without developer tools. |
| Windows 11 x64 | Direct Win32/Vulkan path. | Verify GPU drivers, DPI scaling, multi-monitor behavior, input and packaging. |
| Linux x86-64, X11 | Raven implements an X11 window backend. | Select a distribution/libc baseline; test loader, driver and X11 dependencies, fonts, dialogs and packaging. |
| Linux x86-64, Wayland session | No native Wayland backend was found in the inspected Raven tree. An X11 application would initially require XWayland. | Label this precisely as XWayland compatibility and test it. Native Wayland support would be additional work. |
| macOS, Intel | Raven has a Cocoa backend. Vulkan functionality can be supplied through MoltenVK over Metal. | Select a minimum macOS/Metal baseline, build matching architectures, bundle runtime libraries and test on Intel hardware. |
| macOS, Apple Silicon | Raven's Cocoa backend is relevant. Current choices include MoltenVK and the newer KosmicKrisp driver, with different OS coverage. | Test arm64 bundles and choose runtime policy according to the OS/hardware baseline. KosmicKrisp requires macOS 26 or later. |

Platform-level Vulkan statements come from the [Khronos platform guide](https://docs.vulkan.org/guide/latest/platforms.html). Raven implementation claims below refer to a pinned source snapshot. macOS runtime requirements come from the [LunarG macOS guide](https://vulkan.lunarg.com/doc/view/latest/mac/getting_started.html).

## What the inspected Raven source establishes

Snapshot: [`2cecc7d8073debbc6509e35188d1b322aa4534c9`](https://github.com/oscar-soirey/Raven/tree/2cecc7d8073debbc6509e35188d1b322aa4534c9), observed on 28 October 2026. The repository reported its last push on 27 October 2026. Pinning a revision makes subsequent source and compatibility reviews reproducible.

- The build uses C11. The macOS platform bridge uses Objective-C and Apple's AppKit, QuartzCore and Metal frameworks; application and mathematical code can remain C. [Build definition](https://github.com/oscar-soirey/Raven/blob/2cecc7d8073debbc6509e35188d1b322aa4534c9/CMakeLists.txt)
- Under `if(MINGW)`, the build sets `_WIN32_WINNT=0x0601` and `WINVER=0x0601`; its comment identifies Windows 7. This indicates intent for that build path. It is not proof of a functioning release on Windows 7. [Windows configuration](https://github.com/oscar-soirey/Raven/blob/2cecc7d8073debbc6509e35188d1b322aa4534c9/CMakeLists.txt#L250)
- Modern DPI calls are resolved dynamically, with older alternatives. DWM/backdrop functions also use dynamic lookup. A complete import/dependency audit remains outstanding. [Win32 implementation](https://github.com/oscar-soirey/Raven/blob/2cecc7d8073debbc6509e35188d1b322aa4534c9/src/platform/win32/win32_platform.c#L675)
- Vulkan initialization requests version 1.1 when the loader supports it, otherwise 1.0. Device suitability still includes surface/presentation and extension requirements. We should avoid adding advanced optional GPU requirements to basic 2D plots. [Vulkan device implementation](https://github.com/oscar-soirey/Raven/blob/2cecc7d8073debbc6509e35188d1b322aa4534c9/src/render/vulkan/vk_device.c#L166)
- Vulkan is loaded at runtime. The loader looks for the conventional platform library names, including `vulkan-1.dll`, `libvulkan.so.1`, and macOS Vulkan/MoltenVK libraries. [Loader implementation](https://github.com/oscar-soirey/Raven/blob/2cecc7d8073debbc6509e35188d1b322aa4534c9/src/render/vulkan/vk_loader.c#L64)

The current public API remains subject to change according to the [Raven development disclaimer](https://github.com/oscar-soirey/Raven#raven). Isolate Raven-specific objects and callbacks in the UI layer and record the selected revision with every release.

## Build tools, runtime and hardware are separate requirements

The development computer runs the compiler, CMake and optional shader/debugging tools. A student's computer runs the final application, its required runtime libraries, graphics loader and GPU driver. The two computers do not need identical operating-system versions or a full SDK installation.

The current [Windows Vulkan SDK guide](https://vulkan.lunarg.com/doc/view/latest/windows/getting_started.html) specifies Windows 10 x64 as the Intel/AMD development host, and Windows 11 ARM64 for ARM64 development. It also states that the SDK does not install GPU drivers and that a newer SDK can target an older Vulkan API. These host requirements must not be presented as the application's minimum deployment OS.

The latest Microsoft v14 redistributable currently lists Windows 10/11. Therefore, choosing the latest MSVC tools and automatically deploying the latest runtime is not a verified Windows 7/8 strategy. The compatibility spike must select and test the complete toolchain/runtime combination. Static CRT linkage can change deployment requirements, but cannot repair an unsupported operating-system function imported by the executable or another library. [Microsoft runtime requirements](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist)

On Linux, choose the oldest intended libc/distribution baseline before packaging. On macOS, choose both the build toolchain and the deployment target for every bundled library. The existence of an SDK or compiler for one machine does not establish support for an older target machine.

## macOS Vulkan choices as of the research date

Apple does not provide native Vulkan. A translation/portability implementation supplies Vulkan functionality through Metal. [Khronos platform guide](https://docs.vulkan.org/guide/latest/platforms.html)

The current [MoltenVK upstream README](https://github.com/KhronosGroup/MoltenVK) includes a deprecation notice and describes community best-effort maintenance. It recommends KosmicKrisp for Apple Silicon while retaining MoltenVK for Intel Macs and iOS. This differs from older advice that treats MoltenVK as the sole Mac option.

KosmicKrisp requires Apple Silicon, Metal 4 and macOS 26 or later, and works through the Vulkan Loader. It does not cover Intel Macs or earlier macOS versions. MoltenVK remains relevant to the installed machines outside that coverage. [LunarG driver description](https://www.lunarg.com/products/kosmickrisp/)

The release package should include the appropriate loader and driver inside its `.app` bundle. Students should not need the Vulkan SDK or development environment variables. Raven's inspected device code conditionally enables portability enumeration when the extension is present, which is consistent with LunarG's advice for handling different drivers, but this has not been executed or validated here. [LunarG packaging and driver guidance](https://vulkan.lunarg.com/doc/view/latest/mac/getting_started.html), [Raven extension selection](https://github.com/oscar-soirey/Raven/blob/2cecc7d8073debbc6509e35188d1b322aa4534c9/src/render/vulkan/vk_device.c#L77)

Minimum supported macOS releases, architectures, signing/notarization and driver-selection policy remain decisions for the first Mac prototype.

## Rendering fallback and its cost

Raven provides a custom backend interface. Its shipped null backend deliberately draws nothing and serves headless runs and tests. It is not a visible software-rendered interface. An example containing an OpenGL viewport does not establish an OpenGL renderer for the whole application. [Backend interface](https://github.com/oscar-soirey/Raven/blob/2cecc7d8073debbc6509e35188d1b322aa4534c9/include/raven/raven_backend.h#L234), [null backend](https://github.com/oscar-soirey/Raven/blob/2cecc7d8073debbc6509e35188d1b322aa4534c9/src/render/null/null_backend.c#L1)

If legacy laboratory computers lack working Vulkan, available project decisions are:

1. Require a tested Vulkan-capable driver/GPU and provide a clear startup diagnosis on incompatible machines.
2. Fund and maintain an additional renderer through Raven's backend interface, then validate its text, clipping, textures, surfaces and capture behavior.
3. Reconsider the presentation library after measuring the compatibility gap while keeping the C mathematics and saved project format independent.

A CPU Vulkan implementation is another experiment, but its deployment size, operating-system compatibility and performance must be measured. It must not be promised as a free, universally available fallback. Prefer a plain solid theme and optional animation; expensive visual effects should not determine whether a lesson is usable.

## Early compatibility experiment

This experiment precedes implementation of the full feature catalogue.

1. Build the pinned Raven revision with a minimal application containing Vietnamese text, mathematical symbols, numeric input, a slider, plot lines and diagram dragging.
2. Produce the intended distributable and launch it on clean target systems without SDKs or compilers installed.
3. Record OS build, CPU architecture, GPU/driver, graphics implementation and required extensions. Inspect dependency and OS import failures.
4. Verify keyboard and mouse input, clipboard, file dialogs, save/load, Unicode paths, image/export capture, resize, minimize/restore, DPI/Retina and multi-monitor scaling.
5. Run a representative linked plot interaction and a moderately sized Mason diagram. Measure cold startup, full installed size, working memory, idle CPU and interaction latency on named machines.
6. Test graphics initialization failure deliberately. Display an actionable diagnosis rather than a blank window or crash.
7. Re-run the same small numerical cases across all builds to confirm that platform changes do not change mathematical results beyond documented tolerances.

Hardware-backed tests matter for graphics compatibility. A virtual machine without an appropriate Vulkan device or passthrough does not establish that the intended student GPU/driver combination works.

## Review decisions

| Decision | Proposed starting position | Evidence needed to close it |
| --- | --- | --- |
| Required Windows versions | Keep 7, 8, 8.1, 10 and 11 in the requested target list. | Executable, CRT and GPU tests for each claimed version. |
| First build architectures | Windows/Linux x64; Mac arm64 and Intel x64 as separate targets. | Instructor's student-device inventory and successful packages. |
| Linux baseline | Name a representative distribution and minimum libc baseline before release. | Clean-system package test and XWayland test where applicable. |
| Mac minimum OS | Leave undecided until driver/bundle prototypes establish actual coverage. | Intel/Apple Silicon hardware tests and dependency deployment targets. |
| Graphics fallback | Evaluate Vulkan availability early; budget extra backend work only if needed. | Hardware survey and measured compatibility failures. |
| Raven revision | Pin a tested revision; update deliberately. | Regression and platform smoke tests after an update. |
| Performance targets | Set explicit budgets after a measured prototype. | Repeatable startup, memory, idle and interaction measurements. |
| Distribution | Consider portable Windows package, Linux package and self-contained Mac bundle. | Instructor preference, clean-machine tests and release/signing process. |

Support status should advance from **requested**, to **prototype passed**, to **release tested**. None of the environments in this document has reached those test stages during this documentation task.
