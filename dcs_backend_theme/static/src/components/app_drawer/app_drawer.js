import { Component, proxy } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { fuzzyLookup } from "@web/core/utils/search";
import { AppIcon } from "../app_icon/app_icon";
import { CATEGORIES, getAppCategory } from "../../core/constants";
import { usePanel } from "../../core/use_panel";

/** Application launcher: search, favorites, recents, categories, keyboard. */
export class AppDrawer extends Component {
    static template = "dcs_backend_theme.AppDrawer";
    static components = { AppIcon };

    setup() {
        this.themeService = useService("cbt_theme");
        this.nav = useService("cbt_nav");
        this.prefs = proxy(this.themeService.prefs);
        this.data = proxy(this.themeService.data);
        this.state = proxy({ query: "", activeIndex: 0 });
        // Start the keyboard highlight on the current app rather than the first one.
        const currentApp = this.nav.getCurrentApp();
        const currentIndex = currentApp
            ? this.navigableApps.findIndex((app) => app.id === currentApp.id)
            : -1;
        if (currentIndex > 0) {
            this.state.activeIndex = currentIndex;
        }
        this.rootRef = usePanel("root", () => this.close());
    }

    get apps() {
        return this.nav.getApps();
    }

    get currentApp() {
        return this.nav.getCurrentApp();
    }

    get isSearching() {
        return Boolean(this.state.query.trim());
    }

    get matchingApps() {
        return fuzzyLookup(this.state.query.trim(), this.apps, (app) => app.name);
    }

    get matchingMenus() {
        return this.nav
            .search(this.state.query)
            .filter((entry) => entry.type === "menu")
            .slice(0, 8);
    }

    get favoriteApps() {
        return this.apps.filter((app) => this.data.favoriteApps.includes(app.xmlid));
    }

    get recentApps() {
        const seen = new Set();
        const result = [];
        for (const item of this.nav.getRecentMenus()) {
            const app = this.nav.getAppOf(item);
            if (app && !seen.has(app.id)) {
                seen.add(app.id);
                result.push(app);
            }
        }
        return result.slice(0, 6);
    }

    get categories() {
        const groups = Object.fromEntries(CATEGORIES.map((c) => [c.id, { ...c, apps: [] }]));
        for (const app of this.apps) {
            groups[getAppCategory(app)].apps.push(app);
        }
        return CATEGORIES.map((c) => groups[c.id]).filter((g) => g.apps.length);
    }

    /** Flat list of every app tile, in DOM order, for keyboard navigation. */
    get navigableApps() {
        if (this.isSearching) {
            return this.matchingApps;
        }
        return this.prefs.cbt_drawer_style === "categories"
            ? this.categories.flatMap((g) => g.apps)
            : this.apps;
    }

    /** Keyboard navigation entries: app tiles, followed by the matching menus. */
    get navigableEntries() {
        if (!this.isSearching) {
            return this.navigableApps;
        }
        return [...this.matchingApps, ...this.matchingMenus.map((entry) => entry.menu)];
    }

    isActive(item) {
        return this.navigableEntries[this.state.activeIndex] === item;
    }

    isFavorite(app) {
        return this.themeService.isFavoriteApp(app);
    }

    close() {
        this.themeService.closePanel("drawer");
    }

    async openApp(app, ev) {
        if (ev && (ev.ctrlKey || ev.metaKey || ev.button === 1)) {
            return; // native new-tab behaviour on the href
        }
        ev?.preventDefault();
        this.close();
        await this.nav.openMenu(app);
    }

    async openEntry(entry, ev) {
        ev?.preventDefault();
        this.close();
        await this.nav.openEntry(entry);
    }

    toggleFavorite(app) {
        this.themeService.toggleFavoriteApp(app);
    }

    setStyle(style) {
        this.themeService.setPref("cbt_drawer_style", style);
    }

    onInput(ev) {
        this.state.query = ev.target.value;
        this.state.activeIndex = 0;
    }

    /** Arrow keys move through the visual grid (columns measured from the DOM). */
    onKeydown(ev) {
        const list = this.navigableEntries;
        if (!list.length) {
            return;
        }
        const tiles = [...this.rootRef().querySelectorAll("[data-cbt-drawer-index]")];
        const columns = this.countColumns(tiles);
        let index = this.state.activeIndex;
        const rtl = getComputedStyle(this.rootRef()).direction === "rtl";
        switch (ev.key) {
            case "ArrowRight":
                index += rtl ? -1 : 1;
                break;
            case "ArrowLeft":
                index += rtl ? 1 : -1;
                break;
            case "ArrowDown":
                index += columns;
                break;
            case "ArrowUp":
                index -= columns;
                break;
            case "Enter": {
                ev.preventDefault();
                const item = list[this.state.activeIndex];
                if (!item) {
                    return;
                }
                if (this.isSearching && !this.matchingApps.includes(item)) {
                    this.close();
                    this.nav.openMenu(item);
                } else {
                    this.openApp(item);
                }
                return;
            }
            default:
                return;
        }
        if (
            ev.target.tagName === "INPUT" &&
            this.state.query &&
            (ev.key === "ArrowLeft" || ev.key === "ArrowRight")
        ) {
            return; // keep caret movement inside a non-empty search field
        }
        ev.preventDefault();
        this.state.activeIndex = Math.max(0, Math.min(list.length - 1, index));
        tiles
            .find((el) => Number(el.dataset.cbtDrawerIndex) === this.state.activeIndex)
            ?.scrollIntoView({ block: "nearest" });
    }

    countColumns(tiles) {
        if (this.prefs.cbt_drawer_style === "list" && !this.isSearching) {
            return 1;
        }
        const first = tiles[0];
        if (!first) {
            return 1;
        }
        const top = first.offsetTop;
        const columns = tiles.filter((el) => el.offsetTop === top).length;
        return Math.max(1, columns);
    }

    setActive(index) {
        if (index >= 0) {
            this.state.activeIndex = index;
        }
    }

    indexOf(app) {
        return this.navigableApps.indexOf(app);
    }

    get labels() {
        return {
            title: _t("Applications"),
            search: _t("Search applications and menus…"),
            favorites: _t("Favorites"),
            recent: _t("Recently used"),
            all: _t("All applications"),
            menus: _t("Menus"),
            empty: _t("No application matches your search."),
            close: _t("Close"),
            addFavorite: _t("Add to favorites"),
            removeFavorite: _t("Remove from favorites"),
            layout: _t("Layout"),
            grid: _t("Grid"),
            categories: _t("Categories"),
            list: _t("List"),
        };
    }
}
