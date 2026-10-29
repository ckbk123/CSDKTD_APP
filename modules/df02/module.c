/* DF02: Derive discrete error constants with physical time.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_df02 = {
    "DF02",
    "Discrete tracking error",
    "Compare physical-time ramps and sequence ramps.",
    "L(z) = 0.1/(z-1); unity feedback; r[k] = kT; T = 0.1 s",
    CSD_DISCRETE,
    CSD_PERFORMANCE,
    mount,
    NULL,
    NULL
};
