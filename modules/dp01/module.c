/* DP01: Plot sequences and interpret modal behavior.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dp01 = {
    "DP01",
    "Sequence response",
    "Inspect sampled steps, ramps and modal sequences.",
    "G(z) = 0.2/(z-0.8); unit-step input; T = 0.1 s",
    CSD_DISCRETE,
    CSD_PLOTS,
    mount,
    NULL,
    NULL
};
