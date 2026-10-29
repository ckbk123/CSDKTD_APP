/* CS05: Find stable gains on a root locus.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cs05 = {
    "CS05",
    "Stable root-locus gains",
    "Find gains that place every pole in the left half-plane.",
    "L(s) = K/(s(s+2)(s+5)); K >= 0",
    CSD_CONTINUOUS,
    CSD_STABILITY,
    mount,
    NULL,
    NULL
};
