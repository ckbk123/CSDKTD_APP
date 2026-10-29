/* CR04: Construct and reduce a scalar block diagram.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cr04 = {
    "CR04",
    "Block diagrams",
    "Build and simplify scalar feedback diagrams.",
    "G1 = 1/(s+1); G2 = 1/(s+2); H2 = 2; H1 = 1; negative feedback",
    CSD_CONTINUOUS,
    CSD_REPRESENTATION,
    mount,
    NULL,
    NULL
};
