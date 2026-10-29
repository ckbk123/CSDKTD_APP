/* DS01: Classify discrete pole/eigenvalue stability.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_ds01 = {
    "DS01",
    "Unit-circle stability",
    "Classify pole radius, boundary and hidden modes.",
    "Modes: 0.8^k and (-0.8)^k; T = 0.1 s",
    CSD_DISCRETE,
    CSD_STABILITY,
    mount,
    NULL,
    NULL
};
