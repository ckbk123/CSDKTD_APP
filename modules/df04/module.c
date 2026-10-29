/* DF04: Compare sample periods and discrete quality indices.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_df04 = {
    "DF04",
    "Sample-period tradeoffs",
    "Compare fixed and redesigned sampled controllers.",
    "G(s) = 1/(s+1); C = 2; zero-order hold; T = 0.1 s",
    CSD_DISCRETE,
    CSD_PERFORMANCE,
    mount,
    NULL,
    NULL
};
