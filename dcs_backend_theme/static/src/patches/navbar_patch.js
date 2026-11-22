import { proxy } from "@odoo/owl";
import { useLayoutEffect } from "@web/owl2/utils";
import { _t } from "@web/core/l10n/translation";
import { user } from "@web/core/user";
import { session } from "@web/session";
import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { NavBar } from "@web/webclient/navbar/navbar";

/**
 * Isolated NavBar patch: replaces the desktop apps dropdown with the app
 * drawer launcher and adds a sidebar toggle. Mobile (ui.isSmall) keeps
 * Odoo's own burger menu untouched.
 */
patch(NavBar.prototype, {
    setup() {
        super.setup(...arguments);
        this.cbtTheme = useService("cbt_theme");
        this.cbtPrefs = proxy(this.cbtTheme.prefs);
        this.cbtUi = proxy(this.cbtTheme.ui);
        // Section visibility depends on the navigation mode: re-run Odoo's
        // overflow computation ("more" menu) whenever it changes.
        useLayoutEffect(
            () => {
                this.adapt();
            },
            () => [this.cbtPrefs.cbt_nav_mode, this.cbtPrefs.cbt_sidebar_mode]
        );
        this.cbtLabels = {
            apps: _t("Apps"),
            home: _t("Home Menu"),
            sidebar: _t("Toggle sidebar"),
        };
    },

    get cbtShowSidebarToggle() {
        return ["vertical", "compact"].includes(this.cbtPrefs.cbt_nav_mode) && !this.ui.isSmall;
    },

    /** Apps (drawer) toggle: hidden in sidebar modes, shown elsewhere. */
    get cbtShowAppsToggle() {
        return !["vertical", "compact"].includes(this.cbtPrefs.cbt_nav_mode);
    },

    /** Replace the apps grid with the global brand logo and name. */
    get cbtSystemBrand() {
        return Boolean(session.cbt_brand?.show);
    },

    get cbtSystemName() {
        return session.cbt_brand?.name || user.activeCompany?.name || "";
    },

    get cbtSystemLogoSrc() {
        if (session.cbt_brand?.logo) {
            return session.cbt_brand.logo;
        }
        const company = user.activeCompany;
        return company ? `/web/image/res.company/${company.id}/logo` : "";
    },

    cbtOpenDrawer() {
        this.cbtTheme.togglePanel("drawer");
    },

    cbtToggleSidebar() {
        if (this.cbtPrefs.cbt_nav_mode === "compact") {
            this.cbtTheme.setPref("cbt_nav_mode", "vertical");
            this.cbtTheme.setPref("cbt_sidebar_mode", "expanded");
        } else {
            this.cbtTheme.setPref("cbt_nav_mode", "compact");
        }
        this.cbtUi.sidebarPeek = false;
    },
});
