/* DS02: Apply Jury conditions and build the table.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_ds02 = {
    "DS02",
    "Jury criterion",
    "Derive discrete stability conditions and intervals.",
    "P(z) = z^2 + (K-1)z + 0.2K; parameter: K",
    CSD_DISCRETE,
    CSD_STABILITY,
    mount,
    NULL,
    NULL
};
