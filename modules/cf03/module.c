/* CF03: Compare integral error criteria and control effort.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cf03 = {
    "CF03",
    "Error and effort",
    "Compare integral error measures and control effort.",
    "G(s) = 1/((s+1)(s+2)); C(s) = 4; unit step; horizon: 10 s",
    CSD_CONTINUOUS,
    CSD_PERFORMANCE,
    mount,
    NULL,
    NULL
};
