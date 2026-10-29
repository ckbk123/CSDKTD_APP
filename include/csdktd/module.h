#ifndef CSDKTD_MODULE_H
#define CSDKTD_MODULE_H

#include <Raven.h>

typedef enum CsdDomain {
    CSD_CONTINUOUS = 0,
    CSD_DISCRETE = 1
} CsdDomain;

typedef enum CsdCategory {
    CSD_REPRESENTATION = 0,
    CSD_PLOTS = 1,
    CSD_STABILITY = 2,
    CSD_PERFORMANCE = 3,
    CSD_DESIGN = 4
} CsdCategory;

/* The shell owns the content widget. A module owns only its state and children.
 * Per-visit state belongs here, never in another module or a shared global. */
typedef struct CsdModuleHost {
    Rid content;
    void *state;
} CsdModuleHost;

typedef struct CsdModule {
    const char *id;
    const char *title;
    const char *description;
    const char *baseline;
    CsdDomain domain;
    CsdCategory category;
    void (*mount)(CsdModuleHost *host);
    void (*unmount)(CsdModuleHost *host);
    /* Optional: restore baseline values in place. NULL means unmount/mount.
     * unmount is always called before the shell destroys the content tree. */
    void (*reset)(CsdModuleHost *host);
} CsdModule;

#endif
