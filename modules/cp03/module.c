/* CP03: Measure sinusoidal gain and phase.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cp03 = {
    "CP03",
    "Sinusoidal response",
    "Relate gain and phase to time-domain sinusoids.",
    "G(s) = 1/((s+1)(s+2)); u(t) = sin(t); omega = 1 rad/s",
    CSD_CONTINUOUS,
    CSD_PLOTS,
    mount,
    NULL,
    NULL
};
