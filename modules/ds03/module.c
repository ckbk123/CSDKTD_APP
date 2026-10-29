/* DS03: Transform the disk and apply Routh.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_ds03 = {
    "DS03",
    "Bilinear Routh",
    "Map the unit disk into a half-plane stability test.",
    "P(z) = z^2 + (K-1)z + 0.2K; z = (1+w)/(1-w)",
    CSD_DISCRETE,
    CSD_STABILITY,
    mount,
    NULL,
    NULL
};
