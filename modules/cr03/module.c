/* CR03: Convert TF/ODE/state descriptions and canonical coordinates.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cr03 = {
    "CR03",
    "State representations",
    "Compare transfer functions and state coordinates.",
    "A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; D = 0",
    CSD_CONTINUOUS,
    CSD_REPRESENTATION,
    mount,
    NULL,
    NULL
};
