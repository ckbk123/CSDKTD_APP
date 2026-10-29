/* CD02: Design lead compensation using root locus.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cd02 = {
    "CD02",
    "Lead: root locus",
    "Place a lead compensator from a target pole pair.",
    "G(s) = 1/(s(s+2)); targets = -2 +/- 2j; compensator pole = -6",
    CSD_CONTINUOUS,
    CSD_DESIGN,
    mount,
    NULL,
    NULL
};
