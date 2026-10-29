/* CP04: Build a Bode plot from factors.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cp04 = {
    "CP04",
    "Bode construction",
    "Build magnitude and phase from individual factors.",
    "G(s) = 1/((s+1)(s+2)); frequency unit: rad/s",
    CSD_CONTINUOUS,
    CSD_PLOTS,
    mount,
    NULL,
    NULL
};
