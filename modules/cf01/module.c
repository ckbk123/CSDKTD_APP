/* CF01: Measure transient requirements and test pole predictions.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cf01 = {
    "CF01",
    "Transient specifications",
    "Inspect rise time, overshoot and settling time.",
    "T(s) = 4/(s^2+2s+4); unit step; settling band: 2%",
    CSD_CONTINUOUS,
    CSD_PERFORMANCE,
    mount,
    NULL,
    NULL
};
