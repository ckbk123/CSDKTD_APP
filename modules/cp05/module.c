/* CP05: Construct a Nyquist curve.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cp05 = {
    "CP05",
    "Nyquist construction",
    "Map a contour into a complex response curve.",
    "L(s) = 4/((s+1)(s+2)); negative unity feedback",
    CSD_CONTINUOUS,
    CSD_PLOTS,
    mount,
    NULL,
    NULL
};
