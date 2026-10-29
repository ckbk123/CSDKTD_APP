/* CS04: Apply Nyquist with the correct loop and pole count.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cs04 = {
    "CS04",
    "Nyquist stability",
    "Connect encirclements with closed-loop stability.",
    "L(s) = 4/((s+1)(s+2)); negative unity feedback",
    CSD_CONTINUOUS,
    CSD_STABILITY,
    mount,
    NULL,
    NULL
};
