/* DP04: Construct a discrete root locus.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dp04 = {
    "DP04",
    "Discrete root locus",
    "Construct gain branches in the z plane.",
    "L(z) = K(z+0.2)/(z(z-1)); K >= 0; T = 0.1 s",
    CSD_DISCRETE,
    CSD_PLOTS,
    mount,
    NULL,
    NULL
};
