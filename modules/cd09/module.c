/* CD09: Design a Luenberger observer and combine feedback.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cd09 = {
    "CD09",
    "Luenberger observer",
    "Estimate vector state from one measured output.",
    "A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; observer targets = -6, -7",
    CSD_CONTINUOUS,
    CSD_DESIGN,
    mount,
    NULL,
    NULL
};
