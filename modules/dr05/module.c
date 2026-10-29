/* DR05: Derive a sampled model using a declared hold.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dr05 = {
    "DR05",
    "Sampling and ZOH",
    "Derive a sampled model under a declared hold.",
    "G(s) = 1/(s+1); zero-order hold; T = 0.1 s",
    CSD_DISCRETE,
    CSD_REPRESENTATION,
    mount,
    NULL,
    NULL
};
