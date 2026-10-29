/* DR04: Reduce sampled diagrams and apply discrete Mason.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dr04 = {
    "DR04",
    "Sampled signal diagrams",
    "Trace sampling boundaries, delays and discrete Mason.",
    "G(s) = 5 exp(-0.2s)/s^2; T = 0.2 s; H = 0.1; C(z) = 10 - 2z^-1",
    CSD_DISCRETE,
    CSD_REPRESENTATION,
    mount,
    NULL,
    NULL
};
