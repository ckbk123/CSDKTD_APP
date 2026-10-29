/* CR06: Choose dynamic states and explain state response.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cr06 = {
    "CR06",
    "Dynamic states",
    "Choose integrator states and inspect trajectories.",
    "x1' = x2; x2' = -2x1 - 3x2 + u; y = x1; x(0) = [0;0]",
    CSD_CONTINUOUS,
    CSD_REPRESENTATION,
    mount,
    NULL,
    NULL
};
