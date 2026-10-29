/* CF05: Test time/frequency performance relationships.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cf05 = {
    "CF05",
    "Time-frequency tradeoffs",
    "Compare performance predictions with full responses.",
    "G(s) = 1/(s(s+2)); C(s) = 12(s+8/3)/(s+6)",
    CSD_CONTINUOUS,
    CSD_PERFORMANCE,
    mount,
    NULL,
    NULL
};
