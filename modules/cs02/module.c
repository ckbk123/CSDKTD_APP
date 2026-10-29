/* CS02: Work through Routh and Hurwitz, including special cases.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cs02 = {
    "CS02",
    "Routh and Hurwitz",
    "Work through stability tables and special rows.",
    "P(s) = s^3 + 7s^2 + 10s + K; K = 20",
    CSD_CONTINUOUS,
    CSD_STABILITY,
    mount,
    NULL,
    NULL
};
