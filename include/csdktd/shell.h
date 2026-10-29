#ifndef CSDKTD_SHELL_H
#define CSDKTD_SHELL_H
#include "module.h"

typedef struct CsdShell CsdShell;
CsdShell *csd_shell_create(int hidden);
void csd_shell_destroy(CsdShell *app);
void csd_shell_process(CsdShell *app);
Rid csd_shell_window(const CsdShell *app);
const CsdModule *csd_shell_active(const CsdShell *app);
Rid csd_shell_module_content(const CsdShell *app);
void csd_shell_overview(CsdShell *app, CsdDomain domain);
void csd_shell_category(CsdShell *app, CsdDomain domain, CsdCategory category);
int csd_shell_open(CsdShell *app, const char *id);
void csd_shell_reset(CsdShell *app);
size_t csd_shell_match_count(CsdDomain domain, int category, const char *query);
int csd_shell_smoke_test(CsdShell *app);
#endif
