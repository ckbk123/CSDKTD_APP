/* CF04: Read margins, crossovers, resonance and bandwidth.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cf04 = {
    "CF04",
    "Frequency specifications",
    "Read margins, bandwidth and resonant behavior.",
    "G(s) = 1/(s(s+2)); C(s) = 4; L(s) = C(s)G(s)",
    CSD_CONTINUOUS,
    CSD_PERFORMANCE,
    mount,
    NULL,
    NULL
};
