#include "csdktd/module_registry.h"
#include <string.h>

extern const CsdModule csd_module_cr01;
extern const CsdModule csd_module_cr02;
extern const CsdModule csd_module_cr03;
extern const CsdModule csd_module_cr04;
extern const CsdModule csd_module_cr05;
extern const CsdModule csd_module_cr06;
extern const CsdModule csd_module_cp01;
extern const CsdModule csd_module_cp02;
extern const CsdModule csd_module_cp03;
extern const CsdModule csd_module_cp04;
extern const CsdModule csd_module_cp05;
extern const CsdModule csd_module_cp06;
extern const CsdModule csd_module_cs01;
extern const CsdModule csd_module_cs02;
extern const CsdModule csd_module_cs03;
extern const CsdModule csd_module_cs04;
extern const CsdModule csd_module_cs05;
extern const CsdModule csd_module_cf01;
extern const CsdModule csd_module_cf02;
extern const CsdModule csd_module_cf03;
extern const CsdModule csd_module_cf04;
extern const CsdModule csd_module_cf05;
extern const CsdModule csd_module_cd01;
extern const CsdModule csd_module_cd02;
extern const CsdModule csd_module_cd03;
extern const CsdModule csd_module_cd04;
extern const CsdModule csd_module_cd05;
extern const CsdModule csd_module_cd06;
extern const CsdModule csd_module_cd07;
extern const CsdModule csd_module_cd08;
extern const CsdModule csd_module_cd09;
extern const CsdModule csd_module_dr01;
extern const CsdModule csd_module_dr02;
extern const CsdModule csd_module_dr03;
extern const CsdModule csd_module_dr04;
extern const CsdModule csd_module_dr05;
extern const CsdModule csd_module_dp01;
extern const CsdModule csd_module_dp02;
extern const CsdModule csd_module_dp03;
extern const CsdModule csd_module_dp04;
extern const CsdModule csd_module_ds01;
extern const CsdModule csd_module_ds02;
extern const CsdModule csd_module_ds03;
extern const CsdModule csd_module_ds04;
extern const CsdModule csd_module_ds05;
extern const CsdModule csd_module_df01;
extern const CsdModule csd_module_df02;
extern const CsdModule csd_module_df03;
extern const CsdModule csd_module_df04;
extern const CsdModule csd_module_dd01;
extern const CsdModule csd_module_dd02;
extern const CsdModule csd_module_dd03;
extern const CsdModule csd_module_dd04;
extern const CsdModule csd_module_dd05;
extern const CsdModule csd_module_dd06;
extern const CsdModule csd_module_dd07;

const CsdModule *const csd_modules_all[] = {
    &csd_module_cr01,
    &csd_module_cr02,
    &csd_module_cr03,
    &csd_module_cr04,
    &csd_module_cr05,
    &csd_module_cr06,
    &csd_module_cp01,
    &csd_module_cp02,
    &csd_module_cp03,
    &csd_module_cp04,
    &csd_module_cp05,
    &csd_module_cp06,
    &csd_module_cs01,
    &csd_module_cs02,
    &csd_module_cs03,
    &csd_module_cs04,
    &csd_module_cs05,
    &csd_module_cf01,
    &csd_module_cf02,
    &csd_module_cf03,
    &csd_module_cf04,
    &csd_module_cf05,
    &csd_module_cd01,
    &csd_module_cd02,
    &csd_module_cd03,
    &csd_module_cd04,
    &csd_module_cd05,
    &csd_module_cd06,
    &csd_module_cd07,
    &csd_module_cd08,
    &csd_module_cd09,
    &csd_module_dr01,
    &csd_module_dr02,
    &csd_module_dr03,
    &csd_module_dr04,
    &csd_module_dr05,
    &csd_module_dp01,
    &csd_module_dp02,
    &csd_module_dp03,
    &csd_module_dp04,
    &csd_module_ds01,
    &csd_module_ds02,
    &csd_module_ds03,
    &csd_module_ds04,
    &csd_module_ds05,
    &csd_module_df01,
    &csd_module_df02,
    &csd_module_df03,
    &csd_module_df04,
    &csd_module_dd01,
    &csd_module_dd02,
    &csd_module_dd03,
    &csd_module_dd04,
    &csd_module_dd05,
    &csd_module_dd06,
    &csd_module_dd07,
};

const size_t csd_modules_count = sizeof(csd_modules_all) / sizeof(csd_modules_all[0]);

const CsdModule *csd_module_find(const char *id)
{
    size_t i;
    if (!id) return NULL;
    for (i = 0; i < csd_modules_count; ++i) {
        if (strcmp(csd_modules_all[i]->id, id) == 0) return csd_modules_all[i];
    }
    return NULL;
}

const char *csd_domain_name(CsdDomain domain)
{
    switch (domain) {
        case CSD_CONTINUOUS: return "Continuous";
        case CSD_DISCRETE: return "Discrete";
        default: return "Unknown domain";
    }
}

const char *csd_category_name(CsdCategory category)
{
    switch (category) {
        case CSD_REPRESENTATION: return "System Representation";
        case CSD_PLOTS: return "Plots";
        case CSD_STABILITY: return "Stability";
        case CSD_PERFORMANCE: return "Performance";
        case CSD_DESIGN: return "Controller Design";
        default: return "Unknown section";
    }
}

const char *csd_category_description(CsdCategory category)
{
    switch (category) {
        case CSD_REPRESENTATION: return "Connect equations, transfer functions and signal diagrams.";
        case CSD_PLOTS: return "See how a model becomes a time or frequency plot.";
        case CSD_STABILITY: return "Find stable systems, parameter regions and boundary cases.";
        case CSD_PERFORMANCE: return "Explore tracking error, transients and frequency quality.";
        case CSD_DESIGN: return "Build controllers and observers from stated requirements.";
        default: return "";
    }
}
