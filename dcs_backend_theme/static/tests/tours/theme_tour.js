import { registry } from "@web/core/registry";

/**
 * End-to-end check in the real web client: sidebar, app drawer, global
 * search, bookmarks and theme settings, including server persistence of a
 * bookmark (verified by the Python test afterwards).
 */
registry.category("web_tour.tours").add("dcs_backend_theme_tour", {
    url: "/odoo",
    steps: () => [
        // Sidebar is rendered and the layout is offset
        { trigger: ".cbt-sidebar .cbt-sidebar__section" },
        { trigger: "html[data-cbt-has-sidebar][data-cbt-nav='vertical']" },

        // App drawer: open, search, open an app. Only apps that exist with
        // this module's own dependencies (web, mail) are used.
        { trigger: ".cbt-apps-toggle", run: "click" },
        { trigger: ".cbt-drawer .cbt-drawer__input", run: "edit Settings" },
        { trigger: ".cbt-drawer__tile-link:contains(Settings)", run: "click" },
        { trigger: ".cbt-sidebar .cbt-sidebar__heading:contains(Settings)" },
        { trigger: ".o_form_view .settings" }, // settings page fully mounted

        // The search shortcut opens the app drawer; search a menu there
        { trigger: ".o_main_navbar", run: "press ctrl+shift+f" },
        { trigger: ".cbt-drawer .cbt-drawer__input", run: "edit Users" },
        // (keyboard selection itself is covered by the unit tests)
        { trigger: ".cbt-drawer__menu:contains(Users)", run: "click" },
        { trigger: "body:not(:has(.cbt-drawer))" },
        { trigger: ".o_control_panel .o_breadcrumb:contains(Users)" },
        { trigger: ".o_list_view .o_data_row" },

        // Bookmark the current view (stored on res.users.settings)
        { trigger: ".cbt-systray-btn [data-icon=bookmark]", run: "click" },
        { trigger: ".cbt-sheet__toolbar .btn-primary", run: "click" },
        { trigger: ".cbt-bookmark__label:contains(Users)" },
        { trigger: ".cbt-sheet__header .cbt-icon-btn", run: "click" },
        { trigger: "body:not(:has(.cbt-sheet))" },

        // Theme settings: change density live
        { trigger: ".cbt-systray-btn [data-icon=tune]", run: "click" },
        { trigger: ".cbt-sheet--settings .cbt-seg__option:contains(Compact)", run: "click" },
        { trigger: "html[data-cbt-density='compact']" },
        { trigger: ".cbt-sheet--settings .cbt-seg__option:contains(Comfortable)", run: "click" },
        { trigger: "html[data-cbt-density='comfortable']" },
        { trigger: ".cbt-sheet__header .cbt-icon-btn", run: "click" },
        { trigger: "body:not(:has(.cbt-sheet))" },

        // Standard views still work: switch to list and back to kanban
        { trigger: ".o_switch_view.o_kanban", run: "click" },
        { trigger: ".o_kanban_view .o_kanban_record" },
        { trigger: ".o_switch_view.o_list", run: "click" },
        { trigger: ".o_list_view .o_data_row" },
    ],
});
