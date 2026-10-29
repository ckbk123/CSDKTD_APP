#include "csdktd/shell.h"
#include "csdktd/module_registry.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#ifdef _WIN32
#include <windows.h>
#endif

static int error_count;
static void on_error(RError code, RSeverity severity, const char *detail) {
    fprintf(stderr, "Raven %s: %s\n", Rerror_to_string(code), detail);
    if (severity == R_SEVERITY_ERROR || severity == R_SEVERITY_FATAL) ++error_count;
}
static int capture(Rid window, const char *path) {
    int w = 0, h = 0, i;
    uint8_t *pixels = Rwindow_capture(window, &w, &h);
    FILE *out = pixels ? fopen(path, "wb") : NULL;
    if (!out) { Rpixels_free(pixels); return 0; }
    fprintf(out, "P6\n%d %d\n255\n", w, h);
    for (i = 0; i < w * h; ++i) fwrite(pixels + i * 4, 1, 3, out);
    fclose(out); Rpixels_free(pixels); return 1;
}
static void theme(void) {
    Rtheme_apply(R_THEME_LIGHT);
    Rtheme_set_color(R_COLOR_WINDOW, .965f, .977f, .99f, 1);
    Rtheme_set_color(R_COLOR_TEXT, .08f, .14f, .24f, 1);
    Rtheme_set_color(R_COLOR_ACCENT, .06f, .39f, .77f, 1);
    Rtheme_set_color(R_COLOR_ACCENT_HOVERED, .08f, .46f, .87f, 1);
    Rtheme_set_color(R_COLOR_CONTROL, 1, 1, 1, 1);
    Rtheme_set_color(R_COLOR_CONTROL_BORDER, .82f, .87f, .93f, 1);
    Rtheme_set_metric(R_METRIC_FONT_SIZE, 14);
    Rtheme_set_metric(R_METRIC_CONTROL_HEIGHT, 40);
    Rtheme_set_metric(R_METRIC_CORNER_RADIUS, 7);
    Rset_animations_enabled(R_FALSE);
}
int main(int argc, char **argv) {
    RInitDesc desc = {0};
    CsdShell *app;
    const char *module = NULL, *shot = NULL;
    int smoke = 0, gui_smoke = 0, discrete = 0, category = -1, frames = 0, i, rc = 0;
    for (i = 1; i < argc; ++i) {
        if (!strcmp(argv[i], "--smoke-test")) smoke = 1;
        else if (!strcmp(argv[i], "--gui-smoke-test")) gui_smoke = smoke = 1;
        else if (!strcmp(argv[i], "--open") && i + 1 < argc) module = argv[++i];
        else if (!strcmp(argv[i], "--discrete")) discrete = 1;
        else if (!strcmp(argv[i], "--category") && i + 1 < argc) category = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--capture") && i + 1 < argc) shot = argv[++i];
        else if (!strcmp(argv[i], "--frames") && i + 1 < argc) frames = atoi(argv[++i]);
        else if (!strcmp(argv[i], "--list")) {
            size_t n;
            for (n = 0; n < csd_modules_count; ++n)
                printf("%s | %s | %s | %s\n", csd_modules_all[n]->id,
                    csd_domain_name(csd_modules_all[n]->domain),
                    csd_category_name(csd_modules_all[n]->category), csd_modules_all[n]->title);
            return 0;
        } else {
            fprintf(stderr, "Usage: CSDKTD APP [--open ID] [--discrete] [--category 0..4]\n"
                "Developer checks: --list | --smoke-test | --gui-smoke-test | --capture path.ppm --frames N\n");
            return 2;
        }
    }
    if ((module && !csd_module_find(module)) || category < -1 || category > 4 || frames < 0) {
        fprintf(stderr, "Unknown module, category or frame count.\n"); return 2;
    }
    if (shot && !frames) frames = 6;
    desc.backend = smoke && !gui_smoke ? R_BACKEND_NULL : R_BACKEND_VULKAN;
    desc.headless = smoke && !gui_smoke;
    desc.worker_threads = 2;
    desc.app_name = "CSDKTD APP";
    Rerror_set_callback(on_error);
    if (!Rinit_ex(&desc)) {
#ifdef _WIN32
        if (!smoke) MessageBoxA(NULL,
            "CSDKTD APP could not start its graphics renderer.\n\n"
            "A working Vulkan graphics driver is required. Update the driver supplied by your GPU manufacturer and try again.",
            "CSDKTD APP", MB_OK | MB_ICONERROR);
#endif
        return 1;
    }
    theme();
    app = csd_shell_create(smoke);
    if (!app) { Rshutdown(); return 1; }
    if (discrete) csd_shell_overview(app, CSD_DISCRETE);
    if (category >= 0) csd_shell_category(app, discrete ? CSD_DISCRETE : CSD_CONTINUOUS, (CsdCategory)category);
    if (module) csd_shell_open(app, module);
    if (smoke) {
        rc = csd_shell_smoke_test(app);
        if (gui_smoke) for (i = 0; i < 3; ++i) {
            Rwindow_request_redraw(csd_shell_window(app)); Rwait_frame(.02);
        }
    } else if (frames) {
        for (i = 0; i < frames && Ris_running(); ++i) {
            Rwindow_request_redraw(csd_shell_window(app));
            Rwait_frame(.02); csd_shell_process(app);
        }
        if (shot && !capture(csd_shell_window(app), shot)) rc = 1;
    } else {
        while (Rwait_frame(-1.0)) csd_shell_process(app);
    }
    csd_shell_destroy(app);
    Rshutdown();
    return rc ? rc : (error_count ? 10 : 0);
}

#ifdef _WIN32
int WINAPI WinMain(HINSTANCE instance, HINSTANCE previous, LPSTR command, int show) {
    (void)instance; (void)previous; (void)command; (void)show;
    return main(__argc, __argv);
}
#endif
