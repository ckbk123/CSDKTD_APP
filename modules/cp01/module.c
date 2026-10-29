/* CP01: Construct a time response.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cp01 = {
    "CP01",
    "Time response",
    "Inspect step, ramp and initial-condition responses.",
    "G(s) = 1/((s+1)(s+2)); input: unit step; initial state: zero",
    CSD_CONTINUOUS,
    CSD_PLOTS,
    mount,
    NULL,
    NULL
};
