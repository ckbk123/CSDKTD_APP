/* CS01: Classify poles, eigenmodes and boundaries.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cs01 = {
    "CS01",
    "Pole stability",
    "Distinguish transfer poles and internal state modes.",
    "G(s) = 1/((s+1)(s+2)); poles = -1, -2",
    CSD_CONTINUOUS,
    CSD_STABILITY,
    mount,
    NULL,
    NULL
};
