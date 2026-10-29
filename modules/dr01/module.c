/* DR01: Connect sequences with Z transforms.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dr01 = {
    "DR01",
    "Z transforms",
    "Connect causal sequences with transform expressions.",
    "h[k] = 0.8^k for k >= 0; initial history: zero",
    CSD_DISCRETE,
    CSD_REPRESENTATION,
    mount,
    NULL,
    NULL
};
