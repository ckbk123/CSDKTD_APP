/* DD06: Place discrete state poles and set tracking gain.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dd06 = {
    "DD06",
    "Discrete state feedback",
    "Check controllability and place sampled state poles.",
    "A = [0,1; -2,-3]; B = [0;1]; ZOH T = 0.1 s; targets = 0.7, 0.8",
    CSD_DISCRETE,
    CSD_DESIGN,
    mount,
    NULL,
    NULL
};
