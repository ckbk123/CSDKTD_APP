# Independent exercise modules

Each of the 56 exercise IDs owns one `module.c` and one independent static-library target, for example `csd_module_cr05`. Targets link only to the shared `csd_module_api` contract. They do not link to or call another exercise module.

The shell registry in `src/module_registry.c` lists immutable descriptors. It lets the entry grid discover titles, domain, category and a baseline example without importing another module's private functions or data. The shell creates one content container in the existing application window and calls the selected descriptor's `mount` function. All mounts are intentionally empty in this interface milestone.

## Adding functionality

1. Add controls only under `host->content` inside your module's `mount` callback.
2. Allocate per-visit state and store it in `host->state`. Keep private types/functions inside that module directory. Do not use mutable global state or retain another module's widgets.
3. Set `unmount` to release module-owned state, timers and resources. The shell owns destruction of its content container and widget subtree.
4. Set `reset` when the module has stateful controls. Restore the descriptor's baseline values. Until then, the shell can recreate the blank module container.
5. Put reusable, independently tested mathematical operations in a shared mathematical library, not in another exercise's private implementation.

`baseline` currently describes the initial educational example; it is not a working solver or a computed result. Several baselines are deliberately small proposed teaching fixtures where the course supplies a family rather than one required example. A module can replace its example after its numerical implementation is validated.

Navigation starts each module visit from its baseline. The interface does not save project files, learning progress or edited examples. All module pages live inside the same top-level window.
