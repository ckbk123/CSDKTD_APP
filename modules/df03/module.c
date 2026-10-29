/* DF03: Read sampled-loop frequency requirements.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_df03 = {
    "DF03",
    "Discrete frequency quality",
    "Read sampled-loop crossovers, margins and bandwidth.",
    "L(z) = 0.5/(z-0.8); negative unity feedback; T = 0.1 s",
    CSD_DISCRETE,
    CSD_PERFORMANCE,
    mount,
    NULL,
    NULL
};
