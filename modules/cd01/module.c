/* CD01: Choose and tune an LTI P/PI/PD/PID structure.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cd01 = {
    "CD01",
    "PID structure and tuning",
    "Compare linear controller actions and derivative filtering.",
    "G(s) = 1/((s+1)(s+2)); Kp = 4; Ki = 2; Kd = 1; Tf = 0.05 s",
    CSD_CONTINUOUS,
    CSD_DESIGN,
    mount,
    NULL,
    NULL
};
