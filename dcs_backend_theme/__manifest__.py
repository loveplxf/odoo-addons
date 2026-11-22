# Copyright 2026 Ankit, DevsCodespace (https://devscodespace.com)
# License LGPL-3.0 or later (https://www.gnu.org/licenses/lgpl-3.0).
{
    "name": "DevsCodespace Backend Theme",
    "summary": "Modern, responsive backend theme for Odoo 20 Community: sidebar, app drawer, "
               "global search, bookmarks, dark mode, color palettes, split view, "
               "chatter position and login page layouts.",
    "description": """
DevsCodespace Backend Theme
===========================
A modern, configurable backend theme for Odoo 20 Community, built with OWL 3,
services, registries and isolated patches. Per-user preferences are stored on
``res.users.settings`` and shipped with the session, so the theme costs no
extra RPC at start-up.
""",
    "version": "20.0.1.0.0",
    "category": "Themes/Backend",
    "author": "Ankit",
    "maintainer": "DevsCodespace",
    "company": "DevsCodespace",
    "website": "https://devscodespace.com",
    "license": "LGPL-3",
    # `mail` is required only for the chatter-position feature (FormRenderer
    # patch in static/src/patches/chatter_position.js). Every installed Odoo
    # business app already depends on it.
    "depends": ["web", "mail"],
    "data": [
        "data/theme_actions.xml",
        "views/login_templates.xml",
    ],
    "assets": {
        # ------------------------------------------------------------------
        # Backend (light). Variables go *before* Odoo's primary variables so
        # our `!default` values win at compile time.
        # ------------------------------------------------------------------
        "web.assets_backend": [
            (
                "before",
                "web/static/src/scss/primary_variables.scss",
                "dcs_backend_theme/static/src/scss/variables/primary_variables.scss",
            ),
            "dcs_backend_theme/static/src/scss/fonts.scss",
            "dcs_backend_theme/static/src/scss/tokens.scss",
            "dcs_backend_theme/static/src/scss/ui/*.scss",
            "dcs_backend_theme/static/src/core/**/*",
            "dcs_backend_theme/static/src/components/**/*",
            "dcs_backend_theme/static/src/patches/**/*",
            ("remove", "dcs_backend_theme/static/src/**/*.dark.scss"),
        ],
        "web.assets_backend_lazy": [
            (
                "before",
                "web/static/src/scss/primary_variables.scss",
                "dcs_backend_theme/static/src/scss/variables/primary_variables.scss",
            ),
        ],
        # ------------------------------------------------------------------
        # Dark bundles: the whole backend is recompiled with dark variables
        # (no CSS filter / inversion), then refined by *.dark.scss rules.
        # ------------------------------------------------------------------
        "web.assets_web_dark": [
            (
                "before",
                "dcs_backend_theme/static/src/scss/variables/primary_variables.scss",
                "dcs_backend_theme/static/src/scss/variables/primary_variables.dark.scss",
            ),
            "dcs_backend_theme/static/src/scss/ui/dark_mode.dark.scss",
        ],
        "web.assets_backend_lazy_dark": [
            (
                "before",
                "dcs_backend_theme/static/src/scss/variables/primary_variables.scss",
                "dcs_backend_theme/static/src/scss/variables/primary_variables.dark.scss",
            ),
        ],
        # Login / reset-password pages
        "web.assets_frontend": [
            "dcs_backend_theme/static/src/login/login.scss",
        ],
        # Hoot unit tests (Odoo 20 test runner)
        "web.assets_unit_tests": [
            "dcs_backend_theme/static/tests/**/*",
            ("remove", "dcs_backend_theme/static/tests/tours/**/*"),
        ],
        # Tours (run by tests/test_ui.py)
        "web.assets_tests": [
            "dcs_backend_theme/static/tests/tours/**/*",
        ],
    },
    "post_init_hook": "post_init_hook",
    "uninstall_hook": "uninstall_hook",
    # First image = Apps Store thumbnail (2:1 banner).
    "images": [
        "static/description/banner.png",
        "static/description/screenshots/sidebar_expanded.jpg",
        "static/description/screenshots/nav_modes.jpg",
        "static/description/screenshots/dark_mode.jpg",
        "static/description/screenshots/palettes.jpg",
        "static/description/screenshots/split_view.jpg",
        "static/description/screenshots/login_layouts.jpg",
    ],
    "installable": True,
    "application": False,
}
