import { Component, onWillUnmount, proxy, signal } from "@odoo/owl";
import { render, useLayoutEffect } from "@web/owl2/utils";
import { localization } from "@web/core/l10n/localization";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import { session } from "@web/session";
import { useBus, useService } from "@web/core/utils/hooks";
import { fuzzyLookup } from "@web/core/utils/search";
import { AppIcon } from "../app_icon/app_icon";

const PEEK_DELAY = 160;

/**
 * Fixed sidebar rendered as a main component (no WebClient template patch).
 * The web client is offset with padding driven by <html data-cbt-*> attributes,
 * so Odoo's own flex layout is never rewrapped.
 */
export class Sidebar extends Component {
    static template = "dcs_backend_theme.Sidebar";
    static components = { AppIcon };

    setup() {
        this.themeService = useService("cbt_theme");
        this.nav = useService("cbt_nav");
        this.menuService = useService("menu");
        this.prefs = proxy(this.themeService.prefs);
        this.themeUi = proxy(this.themeService.ui);
        this.data = proxy(this.themeService.data);
        this.navState = proxy(this.nav.state);
        this.ui = proxy(useService("ui"));
        this.rootRef = signal.ref();
        this.state = proxy({
            query: "",
            expandedAppId: this.nav.getCurrentApp()?.id || null,
            openSections: {},
        });

        this.peekTimer = null;

        useBus(this.env.bus, "MENUS:APP-CHANGED", () => {
            const app = this.nav.getCurrentApp();
            if (app) {
                this.state.expandedAppId = app.id;
                if (this.isVerticalNav) {
                    this.openAllSections(this.getTree(app));
                }
            }
            render(this);
        });

        // Expose "a sidebar occupies space" to the layout SCSS.
        useLayoutEffect(
            (visible) => {
                const root = document.documentElement;
                root.toggleAttribute("data-cbt-has-sidebar", visible);
                return () => root.removeAttribute("data-cbt-has-sidebar");
            },
            () => [this.isVisible]
        );

        // Auto-open the sections containing the active menu.
        useLayoutEffect(
            (currentMenuId) => {
                if (!currentMenuId) {
                    return;
                }
                const app = this.nav.getAppOf(this.nav.getMenu(currentMenuId));
                if (!app) {
                    return;
                }
                this.state.expandedAppId = app.id;
                for (const id of this.pathTo(app, currentMenuId)) {
                    this.state.openSections[id] = true;
                }
            },
            () => [this.navState.currentMenuId]
        );

        // Sidebar mode shows the open app's menus: expand every level at once.
        useLayoutEffect(
            (appId) => {
                if (!this.isVerticalNav || !appId) {
                    return;
                }
                const app = this.currentApp;
                if (app) {
                    this.openAllSections(this.getTree(app));
                }
            },
            () => [this.currentApp?.id]
        );

        onWillUnmount(() => clearTimeout(this.peekTimer));
    }

    // ------------------------------------------------------------------
    // Derived state
    // ------------------------------------------------------------------
    get isVisible() {
        const mode = this.prefs.cbt_nav_mode;
        return (
            (mode === "vertical" || mode === "compact") &&
            !this.ui.isSmall &&
            !this.themeUi.fullscreen
        );
    }

    get isRail() {
        return this.prefs.cbt_nav_mode === "compact" || this.prefs.cbt_sidebar_mode === "mini";
    }

    /** Sidebar navigation mode: menus of the open app only. */
    get isVerticalNav() {
        return this.prefs.cbt_nav_mode === "vertical";
    }

    /** Compact navigation mode: collapsed sidebar with icon + label. */
    get isCompact() {
        return this.prefs.cbt_nav_mode === "compact";
    }

    /** The header shows the global brand logo and name instead of the apps button. */
    get showSystemBrand() {
        return Boolean(session.cbt_brand?.show);
    }

    get systemName() {
        return session.cbt_brand?.name || user.activeCompany?.name || "";
    }

    get systemLogoSrc() {
        if (session.cbt_brand?.logo) {
            return session.cbt_brand.logo;
        }
        const company = user.activeCompany;
        return company ? `/web/image/res.company/${company.id}/logo` : "";
    }

    /** The sidebar shows labels (always in compact mode). */
    get showLabels() {
        if (this.prefs.cbt_nav_mode === "compact") {
            return true;
        }
        return this.prefs.cbt_sidebar_mode === "expanded" || this.themeUi.sidebarPeek;
    }

    get showTree() {
        return this.prefs.cbt_nav_mode === "vertical" && this.showLabels;
    }

    get rootClass() {
        const mode = this.prefs.cbt_nav_mode === "compact" ? "mini" : this.prefs.cbt_sidebar_mode;
        return {
            [`cbt-sidebar--${mode}`]: true,
            [`cbt-sidebar--${this.prefs.cbt_sidebar_style}`]: true,
            [`cbt-sidebar--pos-${this.prefs.cbt_sidebar_position}`]: true,
            "cbt-sidebar--peek": this.themeUi.sidebarPeek,
            "cbt-sidebar--labels": this.showLabels,
        };
    }

    get tooltipPosition() {
        const atStart = this.prefs.cbt_sidebar_position === "start";
        const rtl = localization.direction === "rtl";
        return atStart !== rtl ? "right" : "left";
    }

    get apps() {
        return this.nav.getApps();
    }

    get currentApp() {
        return this.nav.getCurrentApp();
    }

    get favoriteApps() {
        const favorites = this.data.favoriteApps;
        return this.apps.filter((app) => favorites.includes(app.xmlid));
    }

    get recentMenus() {
        return this.nav.getRecentMenus().slice(0, 5);
    }

    get filteredEntries() {
        const q = this.state.query.trim();
        if (!q) {
            return [];
        }
        return fuzzyLookup(q, this.nav.getIndex(), (e) => `${e.path.join(" ")} ${e.name}`).slice(0, 25);
    }

    getTree(app) {
        return this.menuService.getMenuAsTree(app.id).childrenTree || [];
    }

    /** Ids of the sections leading to `targetId` inside `app`. */
    pathTo(app, targetId) {
        const search = (node, acc) => {
            for (const child of this.menuService.getMenuAsTree(node.id).childrenTree || []) {
                if (child.id === targetId) {
                    return acc;
                }
                const found = search(child, [...acc, child.id]);
                if (found) {
                    return found;
                }
            }
            return null;
        };
        return search(app, []) || [];
    }

    isActive(menuItem) {
        return this.navState.currentMenuId === menuItem.id;
    }

    tooltip(text) {
        return this.showLabels ? false : text;
    }

    // ------------------------------------------------------------------
    // Handlers
    // ------------------------------------------------------------------
    async onAppClick(app, ev) {
        if (ev && (ev.ctrlKey || ev.metaKey)) {
            return; // let the browser open the href in a new tab
        }
        ev?.preventDefault();
        const isCurrent = this.currentApp?.id === app.id;
        if (this.showTree && isCurrent) {
            const expand = this.state.expandedAppId !== app.id;
            this.state.expandedAppId = expand ? app.id : null;
            if (expand) {
                this.openAllSections(this.getTree(app));
            }
            return;
        }
        this.state.expandedAppId = app.id;
        this.openAllSections(this.getTree(app));
        await this.nav.openMenu(app);
        this.endPeek();
    }

    /** Open every section of a menu tree, whatever its depth. */
    openAllSections(nodes) {
        for (const node of nodes) {
            if (node.childrenTree && node.childrenTree.length) {
                this.state.openSections[node.id] = true;
                this.openAllSections(node.childrenTree);
            }
        }
    }

    async onMenuClick(menuItem, ev) {
        if (ev && (ev.ctrlKey || ev.metaKey)) {
            return;
        }
        ev?.preventDefault();
        await this.nav.openMenu(menuItem);
        this.state.query = "";
        this.endPeek();
    }

    async onEntryClick(entry, ev) {
        ev?.preventDefault();
        await this.nav.openEntry(entry);
        this.state.query = "";
        this.endPeek();
    }

    toggleSection(section) {
        this.state.openSections[section.id] = !this.state.openSections[section.id];
    }

    toggleMode() {
        if (this.isCompact) {
            this.themeService.setPref("cbt_nav_mode", "vertical");
            this.themeService.setPref("cbt_sidebar_mode", "expanded");
        } else {
            this.themeService.setPref("cbt_nav_mode", "compact");
        }
        this.themeUi.sidebarPeek = false;
    }

    toggleLock() {
        this.themeService.setPref("cbt_sidebar_locked", !this.prefs.cbt_sidebar_locked);
    }

    openDrawer() {
        this.themeService.openPanel("drawer");
    }

    openSettings() {
        this.themeService.openPanel("settings");
    }

    // Hover-to-expand when unlocked (mini / collapsed / compact rail)
    onMouseEnter() {
        if (this.prefs.cbt_sidebar_locked && this.prefs.cbt_nav_mode !== "compact") {
            return;
        }
        if (this.prefs.cbt_sidebar_mode === "expanded" && this.prefs.cbt_nav_mode !== "compact") {
            return;
        }
        clearTimeout(this.peekTimer);
        this.peekTimer = setTimeout(() => (this.themeUi.sidebarPeek = true), PEEK_DELAY);
    }

    onMouseLeave() {
        clearTimeout(this.peekTimer);
        if (this.rootRef()?.contains(document.activeElement) && this.state.query) {
            return;
        }
        this.themeUi.sidebarPeek = false;
    }

    endPeek() {
        clearTimeout(this.peekTimer);
        this.themeUi.sidebarPeek = false;
    }

    onFocusOut(ev) {
        if (!this.rootRef()?.contains(ev.relatedTarget)) {
            this.endPeek();
        }
    }

    /** Roving keyboard navigation over visible items. */
    onKeydown(ev) {
        const items = [...this.rootRef().querySelectorAll(".cbt-sidebar__item:not([disabled])")].filter(
            (el) => el.offsetParent !== null
        );
        const index = items.indexOf(document.activeElement);
        const focus = (i) => items[Math.max(0, Math.min(items.length - 1, i))]?.focus();
        const rtl = localization.direction === "rtl";
        switch (ev.key) {
            case "ArrowDown":
                ev.preventDefault();
                focus(index + 1);
                break;
            case "ArrowUp":
                ev.preventDefault();
                focus(index - 1);
                break;
            case "Home":
                ev.preventDefault();
                focus(0);
                break;
            case "End":
                ev.preventDefault();
                focus(items.length - 1);
                break;
            case "ArrowRight":
            case "ArrowLeft": {
                const target = document.activeElement;
                const expand = (ev.key === "ArrowRight") !== rtl;
                if (target?.getAttribute("aria-expanded") !== null) {
                    const open = target.getAttribute("aria-expanded") === "true";
                    if (open !== expand) {
                        ev.preventDefault();
                        target.click();
                    }
                }
                break;
            }
            case "Escape":
                if (this.state.query) {
                    this.state.query = "";
                } else {
                    this.endPeek();
                }
                break;
        }
    }

    get labels() {
        return {
            nav: _t("Main navigation"),
            filter: _t("Filter menus"),
            favorites: _t("Favorites"),
            recent: _t("Recent"),
            apps: _t("Applications"),
            allApps: _t("All applications"),
            collapse: _t("Collapse sidebar"),
            expand: _t("Expand sidebar"),
            lock: _t("Keep sidebar open (don't expand on hover)"),
            unlock: _t("Expand on hover"),
            settings: _t("Theme settings"),
            noResult: _t("No matching menu"),
        };
    }
}

/** Only mount inside the real web client (see patches/webclient_patch.js). */
registry.category("main_components").add("cbt.Sidebar", {
    Component: class SidebarHost extends Component {
        static template = "dcs_backend_theme.SidebarHost";
        static components = { Sidebar };
        get enabled() {
            return Boolean(this.env.cbtInWebClient && this.env.services.cbt_nav);
        }
    },
});
