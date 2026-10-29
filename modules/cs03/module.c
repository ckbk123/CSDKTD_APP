/* CS03: Derive a complete stable parameter region.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cs03 = {
    "CS03",
    "Stable parameter regions",
    "Derive gain intervals and inspect their boundaries.",
    "P(s) = s^3 + 7s^2 + 10s + K; parameter: K",
    CSD_CONTINUOUS,
    CSD_STABILITY,
    mount,
    NULL,
    NULL
};
