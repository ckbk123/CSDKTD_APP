/* DR02: Derive and execute a difference equation.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dr02 = {
    "DR02",
    "Difference equations",
    "Step through delay memory and coefficient order.",
    "y[k+1] = 0.90483742 y[k] + 0.09516258 u[k]; T = 0.1 s",
    CSD_DISCRETE,
    CSD_REPRESENTATION,
    mount,
    NULL,
    NULL
};
