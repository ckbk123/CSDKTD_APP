/* CF02: Derive steady-state error and system type.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cf02 = {
    "CF02",
    "Steady-state error",
    "Compare tracking inputs and error constants.",
    "L(s) = 4/(s(s+2)); unity feedback; reference: r(t) = t",
    CSD_CONTINUOUS,
    CSD_PERFORMANCE,
    mount,
    NULL,
    NULL
};
