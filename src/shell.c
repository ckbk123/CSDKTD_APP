#include "csdktd/shell.h"
#include "csdktd/module_registry.h"
#include "csd_logo.h"
#include <ctype.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct CsdAction { struct CsdShell *app; int index; } CsdAction;
struct CsdShell {
    Rid window, logo, root, body, results, grid, search;
    CsdDomain domain;
    int category;
    const CsdModule *active;
    CsdModuleHost host;
    CsdAction categories[6], domains[2], *module_actions;
    int pending, pending_index, filter_pending;
    char query[160];
};

static void render_page(CsdShell *app);
static void render_results(CsdShell *app);

static Rid add(Rid parent, RWidgetType type) {
    return Rwidget_add_child(parent, Rwidget_create(type));
}
static Rid text(Rid parent, const char *value, float size, int muted) {
    Rid w = Rwidget_add_child(parent, Rlabel_create(value));
    Rlabel_set_text_size(w, size);
    Rlabel_set_wrap(w, R_TRUE);
    if (muted) Rlabel_set_color(w, .40f, .46f, .55f, 1);
    return w;
}
static void gap(Rid parent, float width, float height) {
    Rspacer_set_size(add(parent, R_WIDGET_SPACER), width, height);
}
static Rid box(Rid parent, float padding) {
    Rid border = add(parent, R_WIDGET_BORDER);
    Rborder_set_padding(border, padding, padding, padding, padding);
    return border;
}
static void name(Rid w, const char *value) {
    Rwidget_set_name(w, value);
}
static Rid button(Rid parent, const char *caption, RButtonClickedCallback fn, void *ctx) {
    Rid w = Rwidget_add_child(parent, Rbutton_create(caption));
    Rbutton_set_clicked_callback(w, fn, ctx);
    Rwidget_set_min_size(w, 0, 38);
    return w;
}
static void flex(Rid parent) { Rslot_set_fill(add(parent, R_WIDGET_SPACER), 1); }
static int contains(const char *text_value, const char *query) {
    const char *p;
    size_t i, n = strlen(query);
    if (!n) return 1;
    for (p = text_value; *p; ++p) {
        for (i = 0; i < n && p[i]; ++i)
            if (tolower((unsigned char)p[i]) != tolower((unsigned char)query[i])) break;
        if (i == n) return 1;
    }
    return 0;
}
static int matches(const CsdModule *m, CsdDomain d, int cat, const char *q) {
    return m->domain == d && (cat < 0 || (int)m->category == cat) &&
        (contains(m->title, q) || contains(m->id, q) || contains(m->description, q) ||
         contains(csd_category_name(m->category), q));
}
size_t csd_shell_match_count(CsdDomain d, int cat, const char *q) {
    size_t i, n = 0;
    for (i = 0; i < csd_modules_count; ++i) if (matches(csd_modules_all[i], d, cat, q ? q : "")) ++n;
    return n;
}
static void leave(CsdShell *app) {
    if (app->active && app->active->unmount) app->active->unmount(&app->host);
    app->host.state = NULL;
    app->host.content = R_INVALID_ID;
    app->active = NULL;
}
static int closing(Rid window, void *ctx) {
    CsdShell *app = ctx; (void)window;
    /* Raven destroys the widget tree after this callback. Release the
     * module first, while its widgets can still be inspected safely. */
    app->pending = app->filter_pending = 0;
    leave(app);
    return R_TRUE;
}
static void on_category(Rid sender, void *ctx) {
    CsdAction *a = ctx; (void)sender;
    a->app->pending = 1; a->app->pending_index = a->index;
}
static void on_domain(Rid sender, void *ctx) {
    CsdAction *a = ctx; (void)sender;
    a->app->pending = 2; a->app->pending_index = a->index;
}
static void on_module(Rid sender, void *ctx) {
    CsdAction *a = ctx; (void)sender;
    a->app->pending = 3; a->app->pending_index = a->index;
}
static void on_back(Rid sender, void *ctx) {
    CsdShell *app = ctx; (void)sender;
    app->pending = 1; app->pending_index = app->category;
}
static void on_reset(Rid sender, void *ctx) {
    CsdShell *app = ctx; (void)sender;
    app->pending = 4;
}
static void on_query(Rid sender, const char *value, void *ctx) {
    CsdShell *app = ctx; (void)sender;
    snprintf(app->query, sizeof(app->query), "%s", value);
    app->filter_pending = 1;
}
static int keys(Rid window, const REvent *ev, void *ctx) {
    CsdShell *app = ctx; (void)window;
    if (ev->type != R_EVENT_KEY_DOWN) return R_FALSE;
    if (ev->key == R_KEY_ESCAPE) {
        app->pending = 1;
        app->pending_index = app->active ? app->category : -1;
        return R_TRUE;
    }
    if ((ev->modifiers & R_MOD_CTRL) && ev->key == R_KEY_F && !app->active) {
        Rwidget_focus(app->search); return R_TRUE;
    }
    if ((ev->modifiers & R_MOD_CTRL) && ev->key == R_KEY_HOME) {
        app->pending = 1; app->pending_index = -1; return R_TRUE;
    }
    return R_FALSE;
}
static void columns(CsdShell *app, int width) {
    if (Rwidget_is_valid(app->grid))
        Runiform_grid_set_columns(app->grid, width < 1030 ? 2 : 3);
}
static void resized(Rid window, int width, int height, void *ctx) {
    (void)window; (void)height; columns(ctx, width);
}

static void sidebar(CsdShell *app) {
    Rid bg = box(app->body, 22), col, w, toggle;
    size_t n;
    int i;
    Rborder_set_background(bg, .055f, .10f, .19f, 1);
    Rwidget_set_size(bg, 238, -1);
    col = add(bg, R_WIDGET_VBOX);
    Rpanel_set_spacing(col, 7);
    w = text(col, "CONTROL SYSTEMS", 12, 0);
    Rlabel_set_color(w, .55f, .69f, .86f, 1);
    gap(col, 0, 10);
    for (i = 0; i < 2; ++i) {
        app->domains[i].app = app; app->domains[i].index = i;
        toggle = button(col, csd_domain_name((CsdDomain)i), on_domain, &app->domains[i]);
        name(toggle, i ? "domain.discrete" : "domain.continuous");
        Rbutton_set_style(toggle, app->domain == (CsdDomain)i ? R_BUTTON_PRIMARY : R_BUTTON_DEFAULT);
        Rwidget_set_color(toggle, R_COLOR_CONTROL, .10f, .16f, .25f, 1);
        Rwidget_set_color(toggle, R_COLOR_TEXT, .90f, .94f, 1, 1);
    }
    gap(col, 0, 19);
    w = text(col, "LEARNING TOPICS", 11, 0);
    Rlabel_set_color(w, .55f, .69f, .86f, 1);
    for (i = -1; i < 5; ++i) {
        char label[80], id[40];
        app->categories[i + 1].app = app; app->categories[i + 1].index = i;
        snprintf(label, sizeof(label), "%s", i < 0 ? "Overview" : csd_category_name((CsdCategory)i));
        w = button(col, label, on_category, &app->categories[i + 1]);
        snprintf(id, sizeof(id), "nav.%d", i); name(w, id);
        Rbutton_set_style(w, R_BUTTON_DEFAULT);
        Rwidget_set_color(w, R_COLOR_CONTROL, app->category == i ? .14f : .055f,
            app->category == i ? .24f : .10f, app->category == i ? .37f : .19f, 1);
        Rwidget_set_color(w, R_COLOR_CONTROL_HOVERED, .13f, .23f, .35f, 1);
        Rwidget_set_color(w, R_COLOR_CONTROL_PRESSED, .17f, .29f, .43f, 1);
        Rwidget_set_color(w, R_COLOR_TEXT, .91f, .95f, 1, 1);
        Rwidget_set_metric(w, R_METRIC_FONT_SIZE, 13);
    }
    flex(col);
    n = csd_shell_match_count(app->domain, -1, "");
    {
        char caption[80];
        snprintf(caption, sizeof(caption), "%zu modules  /  SISO LTI", n);
        w = text(col, caption, 12, 0);
        Rlabel_set_color(w, .59f, .70f, .84f, 1);
    }
    w = text(col, "Choose a topic.\nStart with its default example.", 12, 0);
    Rlabel_set_color(w, .45f, .57f, .72f, 1);
}

static Rid card(CsdShell *app, const char *title, const char *description,
                const char *eyebrow, RButtonClickedCallback callback, void *ctx, const char *id) {
    Rid b = Rwidget_add_child(app->grid, Rwidget_create(R_WIDGET_BUTTON));
    Rid pad, stack, label;
    Rbutton_set_clicked_callback(b, callback, ctx);
    name(b, id);
    Rwidget_set_min_size(b, 0, 178);
    Rwidget_set_max_size(b, -1, 178);
    Rwidget_set_color(b, R_COLOR_CONTROL, 1, 1, 1, 1);
    Rwidget_set_color(b, R_COLOR_CONTROL_HOVERED, .92f, .96f, 1, 1);
    Rwidget_set_color(b, R_COLOR_CONTROL_PRESSED, .86f, .92f, .99f, 1);
    Rwidget_set_color(b, R_COLOR_CONTROL_BORDER, .83f, .88f, .94f, 1);
    Rwidget_set_metric(b, R_METRIC_CORNER_RADIUS, 10);
    pad = box(b, 18); Rborder_set_background(pad, 0, 0, 0, 0);
    stack = add(pad, R_WIDGET_VBOX); Rpanel_set_spacing(stack, 8);
    label = text(stack, eyebrow, 11, 0); Rlabel_set_color(label, .08f, .40f, .75f, 1);
    text(stack, title, 18, 0);
    label = text(stack, description, 12, 1); Rslot_set_fill(label, 1);
    /* The entire card is one keyboard-focusable button. */
    Rwidget_set_hit_testable(pad, R_FALSE);
    Rwidget_set_hit_testable(stack, R_FALSE);
    return b;
}
static void render_results(CsdShell *app) {
    size_t i, total;
    int width, height;
    char label[160];
    Rwidget_clear_children(app->results);
    app->grid = R_INVALID_ID;
    if (app->category < 0 && !app->query[0]) {
        text(app->results, "CHOOSE A LEARNING TOPIC", 11, 1);
        gap(app->results, 0, 12);
    } else {
        total = csd_shell_match_count(app->domain, app->category, app->query);
        snprintf(label, sizeof(label), "%zu module%s%s", total, total == 1 ? "" : "s",
            app->query[0] ? " found" : " in this topic");
        text(app->results, label, 12, 1); gap(app->results, 0, 12);
        if (!total) {
            text(app->results, "No matching modules", 22, 0);
            text(app->results, "Try a topic, a module name, or a word such as poles or PID.", 14, 1);
            return;
        }
    }
    app->grid = add(app->results, R_WIDGET_UNIFORM_GRID);
    Rpanel_set_spacing(app->grid, 16);
    Runiform_grid_set_min_cell_size(app->grid, 180, 178);
    Rwindow_get_size(app->window, &width, &height); columns(app, width);
    if (app->category < 0 && !app->query[0]) {
        for (i = 0; i < 5; ++i) {
            char id[40];
            snprintf(label, sizeof(label), "%02zu    /    %zu MODULES", i + 1,
                csd_shell_match_count(app->domain, (int)i, ""));
            snprintf(id, sizeof(id), "topic.%zu", i);
            card(app, csd_category_name((CsdCategory)i), csd_category_description((CsdCategory)i),
                label, on_category, &app->categories[i + 1], id);
        }
    } else {
        for (i = 0; i < csd_modules_count; ++i) {
            const CsdModule *m = csd_modules_all[i];
            if (!matches(m, app->domain, app->category, app->query)) continue;
            snprintf(label, sizeof(label), "%s    /    %s", m->id, csd_category_name(m->category));
            card(app, m->title, m->description, label, on_module, &app->module_actions[i], m->id);
        }
    }
}

static void library_page(CsdShell *app, Rid main) {
    Rid heading, searchwrap, scroller;
    char title[100];
    text(main, app->domain == CSD_CONTINUOUS ? "CONTINUOUS SYSTEMS" : "DISCRETE SYSTEMS", 11, 1);
    snprintf(title, sizeof(title), "%s", app->category < 0 ?
        "Explore control theory" : csd_category_name((CsdCategory)app->category));
    text(main, title, 32, 0);
    text(main, app->category < 0 ?
        "Choose a topic, open a module, and explore one idea at a time." :
        csd_category_description((CsdCategory)app->category), 14, 1);
    gap(main, 0, 16);
    heading = add(main, R_WIDGET_HBOX); Rpanel_set_spacing(heading, 12);
    searchwrap = box(heading, 0); Rwidget_set_size(searchwrap, 390, 40);
    app->search = add(searchwrap, R_WIDGET_TEXT_INPUT);
    name(app->search, "module.search");
    Rtext_input_set_placeholder(app->search, "Search modules in this topic...");
    Rtext_input_set_text(app->search, app->query);
    Rtext_input_set_changed_callback(app->search, on_query, app);
    flex(heading);
    {
        Rid hint = text(heading, "Ctrl+F  Search", 11, 1);
        Rslot_set_valign(hint, R_VALIGN_CENTER);
    }
    gap(main, 0, 18);
    scroller = add(main, R_WIDGET_SCROLL_BOX); Rslot_set_fill(scroller, 1);
    app->results = add(scroller, R_WIDGET_VBOX);
    render_results(app);
}
static void module_page(CsdShell *app, Rid main) {
    Rid top, b, banner, bannerstack, surface, empty;
    char breadcrumb[180];
    const CsdModule *m = app->active;
    top = add(main, R_WIDGET_HBOX); Rpanel_set_spacing(top, 12);
    b = button(top, "<  All modules", on_back, app); name(b, "module.back");
    Rbutton_set_style(b, R_BUTTON_FLAT);
    flex(top);
    b = button(top, "Reset example", on_reset, app); name(b, "module.reset");
    gap(main, 0, 18);
    snprintf(breadcrumb, sizeof(breadcrumb), "%s  /  %s  /  %s",
        csd_domain_name(m->domain), csd_category_name(m->category), m->id);
    text(main, breadcrumb, 11, 1);
    text(main, m->title, 29, 0);
    text(main, m->description, 14, 1);
    gap(main, 0, 18);
    banner = box(main, 17);
    Rborder_set_background(banner, .92f, .96f, 1, 1);
    Rborder_set_corner_radius(banner, 8, 8, 8, 8);
    bannerstack = add(banner, R_WIDGET_VBOX); Rpanel_set_spacing(bannerstack, 6);
    text(bannerstack, "DEFAULT EXAMPLE", 11, 1);
    text(bannerstack, m->baseline, 14, 0);
    gap(main, 0, 18);
    surface = box(main, 20); Rslot_set_fill(surface, 1);
    name(surface, "module.surface");
    Rborder_set_background(surface, 1, 1, 1, 1);
    Rborder_set_outline(surface, 1, .84f, .89f, .94f, 1);
    Rborder_set_corner_radius(surface, 10, 10, 10, 10);
    /* This is the module's own empty content tree. Its lifecycle is isolated
     * from sibling modules and destroyed when the student leaves. */
    app->host.content = add(surface, R_WIDGET_OVERLAY);
    name(app->host.content, "module.content");
    app->host.state = NULL;
    if (m->mount) m->mount(&app->host);
    /* An empty-state caption belongs to the shell, not to module content. */
    if (Rwidget_get_child_count(app->host.content) == 0) {
    empty = add(app->host.content, R_WIDGET_VBOX);
    name(empty, "module.placeholder");
    Rslot_set_halign(empty, R_HALIGN_CENTER); Rslot_set_valign(empty, R_VALIGN_CENTER);
    Rpanel_set_spacing(empty, 8);
    b = text(empty, "Your workspace", 21, 1); Rslot_set_halign(b, R_HALIGN_CENTER);
    b = text(empty, "Interactive tools will appear here.", 13, 1); Rslot_set_halign(b, R_HALIGN_CENTER);
    }
    gap(main, 0, 10);
    text(main, "Each visit starts with the default example.    Esc  Back to modules", 11, 1);
}
static void render_page(CsdShell *app) {
    Rid main, padding;
    app->grid = app->search = app->results = R_INVALID_ID;
    Rwidget_clear_children(app->body);
    sidebar(app);
    padding = box(app->body, 30); Rslot_set_fill(padding, 1);
    main = add(padding, R_WIDGET_VBOX); Rpanel_set_spacing(main, 7);
    if (app->active) module_page(app, main); else library_page(app, main);
}
void csd_shell_overview(CsdShell *app, CsdDomain d) {
    leave(app); app->domain = d; app->category = -1; app->query[0] = 0;
    render_page(app);
}
void csd_shell_category(CsdShell *app, CsdDomain d, CsdCategory cat) {
    leave(app); app->domain = d; app->category = (int)cat; app->query[0] = 0;
    render_page(app);
}
int csd_shell_open(CsdShell *app, const char *id) {
    const CsdModule *m = csd_module_find(id);
    if (!m) return 0;
    leave(app); app->active = m; app->domain = m->domain;
    app->category = (int)m->category; app->query[0] = 0;
    render_page(app); return 1;
}
void csd_shell_reset(CsdShell *app) {
    const CsdModule *m = app->active;
    if (!m) return;
    if (m->reset) m->reset(&app->host);
    else { leave(app); app->active = m; render_page(app); }
}
void csd_shell_process(CsdShell *app) {
    int pending = app->pending, index = app->pending_index;
    if (!Rwindow_is_valid(app->window)) return;
    app->pending = 0;
    if (pending) app->filter_pending = 0;
    switch (pending) {
    case 1:
        if (index < 0) csd_shell_overview(app, app->domain);
        else csd_shell_category(app, app->domain, (CsdCategory)index);
        break;
    case 2:
        if (app->category < 0) csd_shell_overview(app, (CsdDomain)index);
        else csd_shell_category(app, (CsdDomain)index, (CsdCategory)app->category);
        break;
    case 3: csd_shell_open(app, csd_modules_all[index]->id); break;
    case 4: csd_shell_reset(app); break;
    default: break;
    }
    if (app->filter_pending && !app->active) { app->filter_pending = 0; render_results(app); }
}
Rid csd_shell_window(const CsdShell *app) { return app->window; }
const CsdModule *csd_shell_active(const CsdShell *app) { return app->active; }
Rid csd_shell_module_content(const CsdShell *app) { return app->host.content; }

CsdShell *csd_shell_create(int hidden) {
    CsdShell *app = calloc(1, sizeof(*app));
    Rid head, image, brand, pad, sub;
    size_t i;
    if (!app) return NULL;
    app->module_actions = calloc(csd_modules_count, sizeof(*app->module_actions));
    if (!app->module_actions) { free(app); return NULL; }
    for (i = 0; i < csd_modules_count; ++i) {
        app->module_actions[i].app = app; app->module_actions[i].index = (int)i;
    }
    app->grid = app->host.content = R_INVALID_ID;
    app->category = -1;
    app->window = Rwindow_create("CSDKTD APP", 1280, 760, hidden ? R_WINDOW_HIDDEN : R_WINDOW_DEFAULT);
    if (!Rwindow_is_valid(app->window)) { free(app->module_actions); free(app); return NULL; }
    Rwindow_set_min_size(app->window, 900, 640);
    Rwindow_set_close_callback(app->window, closing, app);
    Rwindow_set_resize_callback(app->window, resized, app);
    Rwindow_set_event_hook(app->window, keys, app);
    app->root = Rwidget_create(R_WIDGET_VBOX);
    Rwindow_set_content(app->window, app->root);
    head = box(app->root, 16);
    Rborder_set_background(head, 1, 1, 1, 1);
    Rborder_set_outline(head, 1, .88f, .91f, .95f, 1);
    sub = add(head, R_WIDGET_HBOX); Rpanel_set_spacing(sub, 16);
    gap(sub, 8, 0);
    app->logo = Rtexture_create((const char *)csd_logo_data, sizeof(csd_logo_data));
    image = add(sub, R_WIDGET_IMAGE);
    Rwidget_set_size(image, 52, 52); Rimage_set_texture(image, app->logo); Rimage_set_stretch(image, R_STRETCH_FIT);
    brand = add(sub, R_WIDGET_VBOX); Rpanel_set_spacing(brand, 4);
    text(brand, "CSDKTD APP", 23, 0);
    text(brand, "HO CHI MINH CITY UNIVERSITY OF TECHNOLOGY", 10, 1);
    flex(sub);
    pad = text(sub, "INTERACTIVE LEARNING\nSISO linear systems", 12, 1);
    Rslot_set_valign(pad, R_VALIGN_CENTER);
    app->body = add(app->root, R_WIDGET_HBOX); Rslot_set_fill(app->body, 1);
    csd_shell_overview(app, CSD_CONTINUOUS);
    return app;
}
void csd_shell_destroy(CsdShell *app) {
    if (!app) return;
    leave(app);
    if (Rwindow_is_valid(app->window)) Rwindow_destroy(app->window);
    if (Rtexture_is_valid(app->logo)) Rtexture_destroy(app->logo);
    free(app->module_actions); free(app);
}
int csd_shell_smoke_test(CsdShell *app) {
    size_t i;
    Rid window = app->window;
    for (i = 0; i < csd_modules_count; ++i) {
        Rid first;
        if (!csd_shell_open(app, csd_modules_all[i]->id)) return 1;
        if (csd_shell_active(app) != csd_modules_all[i]) return 2;
        first = app->host.content;
        if (!Rwidget_is_valid(first)) return 3;
        csd_shell_reset(app);
        if (Rwidget_is_valid(first) || app->host.content == first) return 4;
        if (app->window != window || !Rwindow_is_valid(window)) return 5;
        csd_shell_category(app, csd_modules_all[i]->domain, csd_modules_all[i]->category);
        if (app->active || Rwidget_is_valid(app->host.content)) return 6;
    }
    if (csd_shell_open(app, "missing-module")) return 7;
    if (csd_shell_match_count(CSD_CONTINUOUS, -1, "CR05") != 1) return 8;
    if (csd_shell_match_count(CSD_DISCRETE, -1, "CR05") != 0) return 9;
    csd_shell_overview(app, CSD_CONTINUOUS);
    printf("PASS: 56 routes, reset/unmount, single-window identity, search and invalid route.\n");
    return 0;
}
