/* CR01: Expand, factor and interpret polynomials.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cr01 = {
    "CR01",
    "Polynomial laboratory",
    "Expand expressions, inspect factors and locate roots.",
    "P(s) = s^4 + 7s^3 + 27s^2 + 47s + 26",
    CSD_CONTINUOUS,
    CSD_REPRESENTATION,
    mount,
    NULL,
    NULL
};
