/* CP02: Explain pole modes and zero effects.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cp02 = {
    "CP02",
    "Poles, zeros and modes",
    "Connect pole and zero locations with response shape.",
    "G(s) = 4/(s^2+2s+4); input: unit step",
    CSD_CONTINUOUS,
    CSD_PLOTS,
    mount,
    NULL,
    NULL
};
