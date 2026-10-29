/* DD01: Emulate a continuous LTI controller.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dd01 = {
    "DD01",
    "Controller emulation",
    "Apply Euler or Tustin to a continuous controller.",
    "C(s) = 12(s+8/3)/(s+6); Tustin; T = 0.1 s",
    CSD_DISCRETE,
    CSD_DESIGN,
    mount,
    NULL,
    NULL
};
