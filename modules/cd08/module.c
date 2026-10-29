/* CD08: Design SISO state feedback and reference tracking.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cd08 = {
    "CD08",
    "State feedback",
    "Place state poles and set the scalar reference gain.",
    "A = [0,1; -2,-3]; B = [0;1]; C = [1,0]; targets = -2, -4",
    CSD_CONTINUOUS,
    CSD_DESIGN,
    mount,
    NULL,
    NULL
};
