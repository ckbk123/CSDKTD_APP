#ifndef CSDKTD_MODULE_REGISTRY_H
#define CSDKTD_MODULE_REGISTRY_H

#include <stddef.h>
#include "csdktd/module.h"

extern const CsdModule *const csd_modules_all[];
extern const size_t csd_modules_count;

const CsdModule *csd_module_find(const char *id);
const char *csd_domain_name(CsdDomain domain);
const char *csd_category_name(CsdCategory category);
const char *csd_category_description(CsdCategory category);

#endif
