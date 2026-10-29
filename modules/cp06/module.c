/* CP06: Construct a root locus and test its rules.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_cp06 = {
    "CP06",
    "Root-locus construction",
    "Explore branch rules and the gain conditions.",
    "L(s) = K/(s(s+2)(s+5)); K >= 0",
    CSD_CONTINUOUS,
    CSD_PLOTS,
    mount,
    NULL,
    NULL
};
