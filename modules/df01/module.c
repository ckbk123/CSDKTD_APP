/* DF01: Measure sampled transient specifications.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_df01 = {
    "DF01",
    "Sampled transient quality",
    "Measure response in sample counts and seconds.",
    "G(z) = 0.2/(z-0.8); unit step; T = 0.1 s; settling band: 2%",
    CSD_DISCRETE,
    CSD_PERFORMANCE,
    mount,
    NULL,
    NULL
};
