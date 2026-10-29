/* DR03: Construct discrete state models and delay states.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dr03 = {
    "DR03",
    "Discrete state models",
    "Compare delay, transfer and state representations.",
    "A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; use ZOH at T = 0.1 s",
    CSD_DISCRETE,
    CSD_REPRESENTATION,
    mount,
    NULL,
    NULL
};
