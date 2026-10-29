/* Link-time test double: the actual CR01 archive is not extracted because
 * this executable supplies its descriptor. Other modules remain unchanged. */
#include "csdktd/shell.h"
#include <stdio.h>
#include <stdlib.h>

#define CHECK(x) do { if (!(x)) { fprintf(stderr, "FAIL line %d: %s\n", __LINE__, #x); return 1; } } while (0)
typedef struct Probe { Rid child; int value; } Probe;
static int mounts, resets, unmounts, invalid;
static void mount(CsdModuleHost *host) {
    Probe *p = calloc(1, sizeof(*p));
    if (!p) { ++invalid; return; }
    if (!Rwidget_is_valid(host->content) || host->state) ++invalid;
    p->child = Rwidget_add_child(host->content, Rlabel_create("Lifecycle fixture"));
    p->value = 12;
    host->state = p;
    ++mounts;
}
static void reset(CsdModuleHost *host) {
    Probe *p = host->state;
    if (!p || !Rwidget_is_valid(host->content) || !Rwidget_is_valid(p->child)) ++invalid;
    if (p) p->value = 12;
    ++resets;
}
static void unmount(CsdModuleHost *host) {
    Probe *p = host->state;
    if (!p || !Rwidget_is_valid(host->content) || !Rwidget_is_valid(p->child)) ++invalid;
    free(p); host->state = NULL;
    ++unmounts;
}
const CsdModule csd_module_cr01 = {
    "CR01", "Lifecycle fixture", "Stateful test module", "value = 12",
    CSD_CONTINUOUS, CSD_REPRESENTATION, mount, unmount, reset
};
int main(void) {
    RInitDesc desc = {0};
    CsdShell *app;
    Rid first, window;
    desc.backend = R_BACKEND_NULL; desc.headless = 1; desc.worker_threads = 1;
    CHECK(Rinit_ex(&desc));
    app = csd_shell_create(1); CHECK(app);
    window = csd_shell_window(app);
    CHECK(csd_shell_open(app, "CR01"));
    first = csd_shell_module_content(app);
    csd_shell_reset(app);
    CHECK(mounts == 1 && resets == 1 && unmounts == 0);
    CHECK(csd_shell_module_content(app) == first && Rwidget_is_valid(first));
    CHECK(csd_shell_open(app, "CR02"));
    CHECK(unmounts == 1 && !Rwidget_is_valid(first));
    first = csd_shell_module_content(app);
    csd_shell_reset(app); /* No reset callback: rebuild this blank module. */
    CHECK(!Rwidget_is_valid(first));
    CHECK(csd_shell_open(app, "CR01"));
    Rwindow_close(window); /* Same close path as the operating-system button. */
    CHECK(unmounts == 2 && !Rwindow_is_valid(window));
    csd_shell_process(app); /* A pending frame after close must be harmless. */
    csd_shell_destroy(app);
    CHECK(mounts == 2 && unmounts == 2 && invalid == 0);
    app = csd_shell_create(1); CHECK(app);
    CHECK(csd_shell_open(app, "CR01"));
    csd_shell_destroy(app); /* Programmatic exit must also release state once. */
    CHECK(mounts == 3 && unmounts == 3 && invalid == 0);
    Rshutdown();
    puts("PASS: stateful reset, fallback reset, navigation and both close paths.");
    return 0;
}
