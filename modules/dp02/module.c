/* DP02: Map continuous poles and discrete modes.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dp02 = {
    "DP02",
    "Pole mapping",
    "Connect the s plane, unit circle and sample period.",
    "s = -2 + 3j and -2 - 3j; z = exp(sT); T = 0.1 s",
    CSD_DISCRETE,
    CSD_PLOTS,
    mount,
    NULL,
    NULL
};
