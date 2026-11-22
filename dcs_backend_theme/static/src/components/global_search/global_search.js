import { Component, proxy } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { AppIcon } from "../app_icon/app_icon";
import { usePanel } from "../../core/use_panel";

/**
 * Global search: fuzzy navigation over apps, menus and bookmarks, with recent
 * searches and suggestions. Record/command search is delegated to Odoo's own
 * command palette (no ORM behaviour is replaced).
 */
export class GlobalSearch extends Component {
    static template = "dcs_backend_theme.GlobalSearch";
    static components = { AppIcon };

    setup() {
        this.themeService = useService("cbt_theme");
        this.nav = useService("cbt_nav");
        this.command = useService("command");
        this.navState = proxy(this.nav.state);
        this.data = proxy(this.themeService.data);
        this.state = proxy({ query: "", activeIndex: 0 });
        this.rootRef = usePanel("root", () => this.close());
        this.listId = `cbt_search_list_${GlobalSearch.nextId++}`;
    }

    static nextId = 0;

    get query() {
        return this.state.query.trim();
    }

    /** Flat list of selectable items (drives keyboard + aria-activedescendant). */
    get items() {
        if (!this.query) {
            const items = [];
            for (const q of this.navState.recentSearches) {
                items.push({ key: `q_${q}`, kind: "history", label: q, group: "history" });
            }
            for (const bookmark of this.data.bookmarks.slice(0, 4)) {
                items.push({
                    key: `b_${bookmark.id}`,
                    kind: "bookmark",
                    label: bookmark.label,
                    bookmark,
                    app: bookmark.appId ? this.nav.getMenu(bookmark.appId) : null,
                    group: "suggestions",
                });
            }
            for (const menuItem of this.nav.getRecentMenus().slice(0, 6)) {
                items.push({
                    key: `r_${menuItem.id}`,
                    kind: "menu",
                    label: menuItem.name,
                    menu: menuItem,
                    app: this.nav.getAppOf(menuItem),
                    group: "suggestions",
                });
            }
            return items;
        }
        const items = this.nav.search(this.query, 40).map((entry) => ({
            key: entry.key,
            kind: entry.type === "bookmark" ? "bookmark" : "entry",
            label: entry.name,
            path: entry.path.join(" / "),
            entry,
            bookmark: entry.bookmark,
            app: entry.app,
            type: entry.type,
            group: "results",
        }));
        if (this.command) {
            items.push({ key: "palette", kind: "palette", label: this.query, group: "more" });
        }
        return items;
    }

    get groups() {
        const titles = {
            history: _t("Recent searches"),
            suggestions: _t("Suggestions"),
            results: _t("Applications & menus"),
            more: _t("More"),
        };
        const groups = [];
        this.items.forEach((item, index) => {
            let group = groups.at(-1);
            if (!group || group.id !== item.group) {
                group = { id: item.group, title: titles[item.group], items: [] };
                groups.push(group);
            }
            group.items.push({ ...item, index });
        });
        return groups;
    }

    optionId(index) {
        return `${this.listId}_${index}`;
    }

    typeLabel(item) {
        if (item.kind === "bookmark") {
            return _t("Bookmark");
        }
        if (item.type === "app") {
            return _t("App");
        }
        return item.path || "";
    }

    close() {
        this.themeService.closePanel("search");
    }

    onInput(ev) {
        this.state.query = ev.target.value;
        this.state.activeIndex = 0;
    }

    onKeydown(ev) {
        const count = this.items.length;
        switch (ev.key) {
            case "ArrowDown":
                ev.preventDefault();
                this.state.activeIndex = count ? (this.state.activeIndex + 1) % count : 0;
                this.scrollActive();
                break;
            case "ArrowUp":
                ev.preventDefault();
                this.state.activeIndex = count ? (this.state.activeIndex - 1 + count) % count : 0;
                this.scrollActive();
                break;
            case "Enter": {
                ev.preventDefault();
                const item = this.items[this.state.activeIndex];
                if (item) {
                    this.select(item);
                }
                break;
            }
        }
    }

    hover(index) {
        if (this.state.activeIndex !== index) {
            this.state.activeIndex = index;
        }
    }

    scrollActive() {
        const el = this.rootRef()?.querySelector(`#${this.optionId(this.state.activeIndex)}`);
        el?.scrollIntoView({ block: "nearest" });
    }

    async select(item) {
        if (item.kind === "history") {
            this.state.query = item.label;
            this.state.activeIndex = 0;
            return;
        }
        if (this.query) {
            this.nav.pushSearch(this.query);
        }
        this.close();
        if (item.kind === "palette") {
            this.command.openMainPalette({ searchValue: item.label });
        } else if (item.kind === "bookmark") {
            await this.nav.openBookmark(item.bookmark);
        } else if (item.kind === "menu") {
            await this.nav.openMenu(item.menu);
        } else {
            await this.nav.openEntry(item.entry);
        }
    }

    clearHistory() {
        this.nav.clearSearchHistory();
    }

    get labels() {
        return {
            dialog: _t("Search"),
            placeholder: _t("Search apps, menus and bookmarks…"),
            empty: _t("Nothing found. Try another word."),
            palette: _t("Search records and commands for"),
            clear: _t("Clear"),
            navigate: _t("to navigate"),
            open: _t("to open"),
            close: _t("to close"),
        };
    }
}
