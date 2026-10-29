#include "csdktd/module_registry.h"
#include <stdio.h>
#include <string.h>

#define CHECK(x) do { if (!(x)) { fprintf(stderr, "FAIL line %d: %s\n", __LINE__, #x); return 1; } } while (0)
int main(void) {
    static const size_t expected[2][5] = {{6,6,5,5,9},{5,4,5,4,7}};
    size_t counts[2][5] = {{0}}, i, j;
    CHECK(csd_modules_count == 56);
    for (i = 0; i < csd_modules_count; ++i) {
        const CsdModule *m = csd_modules_all[i];
        CsdModuleHost host = {R_INVALID_ID, NULL};
        CHECK(m && m->id && strlen(m->id) == 4);
        CHECK(m->title && *m->title && m->description && *m->description);
        CHECK(m->baseline && *m->baseline && m->mount);
        CHECK(m->domain >= 0 && m->domain <= CSD_DISCRETE);
        CHECK(m->category >= 0 && m->category <= CSD_DESIGN);
        CHECK(csd_module_find(m->id) == m);
        for (j = 0; j < i; ++j) CHECK(strcmp(m->id, csd_modules_all[j]->id) != 0);
        m->mount(&host);
        CHECK(host.state == NULL); /* Every current page is intentionally empty. */
        CHECK(host.content == R_INVALID_ID);
        ++counts[m->domain][m->category];
    }
    for (i = 0; i < 2; ++i) for (j = 0; j < 5; ++j) CHECK(counts[i][j] == expected[i][j]);
    CHECK(csd_module_find(NULL) == NULL && csd_module_find("CR99") == NULL);
    puts("PASS: all 56 independent modules have unique routes, default examples and empty mounts.");
    return 0;
}
