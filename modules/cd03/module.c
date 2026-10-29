/* CD03: Design lag compensation using root locus.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cd03 = {
    "CD03",
    "Lag: root locus",
    "Improve tracking while checking transient changes.",
    "G(s) = 1/(s(s+2)); baseline C(s) = 4; unit-ramp reference",
    CSD_CONTINUOUS,
    CSD_DESIGN,
    mount,
    NULL,
    NULL
};
