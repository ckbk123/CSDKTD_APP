/* DP03: Construct discrete Bode/Nyquist and W-plane views.
 * This library owns only this module's UI and per-visit state. */
#include "csdktd/module.h"
#include <stddef.h>

static void mount(CsdModuleHost *host)
{
    /* Add this module's future controls to host->content. */
    (void)host;
}

const CsdModule csd_module_dp03 = {
    "DP03",
    "Discrete Bode and Nyquist",
    "Explore unit-circle frequency and warped-plane views.",
    "G(z) = (0.0544z+0.0493)/(z^2-1.741z+0.741); T = 0.1 s",
    CSD_DISCRETE,
    CSD_PLOTS,
    mount,
    NULL,
    NULL
};
