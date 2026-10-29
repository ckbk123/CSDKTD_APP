/* DD02: Design lead and lag directly in the z plane.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dd02 = {
    "DD02",
    "Discrete lead and lag",
    "Design compensation directly in the z plane.",
    "G(s) = 50/(s(s+5)); ZOH T = 0.1 s; target zeta = 0.707, wn = 10 rad/s",
    CSD_DISCRETE,
    CSD_DESIGN,
    mount,
    NULL,
    NULL
};
