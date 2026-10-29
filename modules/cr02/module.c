/* CR02: Derive a linear ODE and apply Laplace correctly.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cr02 = {
    "CR02",
    "ODE and Laplace",
    "Follow a linear equation into its transfer function.",
    "y'' + 3y' + 2y = u; y(0) = 0; y'(0) = 0",
    CSD_CONTINUOUS,
    CSD_REPRESENTATION,
    mount,
    NULL,
    NULL
};
