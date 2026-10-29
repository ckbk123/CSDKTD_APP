/* DS05: Explain discrete Nyquist stability.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_ds05 = {
    "DS05",
    "Discrete Nyquist stability",
    "Relate the unit-circle mapping to closed-loop roots.",
    "L(z) = 0.5/(z-0.8); negative unity feedback; T = 0.1 s",
    CSD_DISCRETE,
    CSD_STABILITY,
    mount,
    NULL,
    NULL
};
