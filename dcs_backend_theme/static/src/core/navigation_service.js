import { proxy } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";
import { router } from "@web/core/browser/router";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { fuzzyLookup } from "@web/core/utils/search";
import {
    MAX_RECENTS,
    MAX_SEARCH_HISTORY,
    RECENT_STORAGE_KEY,
    SEARCH_HISTORY_KEY,
} from "./constants";

/** Device-local lists (recents are not worth a server write per click). */
function readList(key) {
    try {
        const value = JSON.parse(browser.localStorage.getItem(key) || "[]");
        return Array.isArray(value) ? value : [];
    } catch {
        return [];
    }
}
function writeList(key, list) {
    try {
        browser.localStorage.setItem(key, JSON.stringify(list));
    } catch {
        // storage full or disabled: recents are a convenience only
    }
}

let uid = 0;
function newBookmarkId() {
    return `bm_${Date.now().toString(36)}_${(uid++).toString(36)}`;
}

/**
 * Menu index, recents, bookmarks and navigation helpers shared by the
 * sidebar, app drawer, global search and bookmarks panel.
 */
export const navigationService = {
    dependencies: ["menu", "action", "cbt_theme"],
    start(env, { menu, action, cbt_theme: theme }) {
        const state = proxy({
            recentMenuIds: readList(RECENT_STORAGE_KEY).filter((id) => Number.isInteger(id)),
            recentSearches: readList(SEARCH_HISTORY_KEY).filter((q) => typeof q === "string"),
            currentMenuId: null,
        });
        let index = null;
        // Menu the user just picked: several menus may share one action, so
        // resolving the action alone would highlight the wrong entry.
        let lastSelectedMenuId = null;

        function selectMenu(menuItem) {
            lastSelectedMenuId = typeof menuItem === "number" ? menuItem : menuItem?.id ?? null;
            if (lastSelectedMenuId) {
                state.currentMenuId = lastSelectedMenuId;
            }
            return menu.selectMenu(menuItem);
        }

        env.bus.addEventListener("MENUS:APP-CHANGED", () => {
            index = null;
        });

        // ------------------------------------------------------------------
        // Index of every reachable menu (apps + leaves with an action)
        // ------------------------------------------------------------------
        function buildIndex() {
            const entries = [];
            const walk = (node, app, path) => {
                for (const child of node.childrenTree || []) {
                    if (child.actionID) {
                        entries.push({
                            key: `menu_${child.id}`,
                            type: "menu",
                            id: child.id,
                            name: child.name,
                            path,
                            app,
                            menu: child,
                        });
                    }
                    if (child.childrenTree?.length) {
                        walk(child, app, [...path, child.name]);
                    }
                }
            };
            for (const app of menu.getApps()) {
                entries.push({ key: `app_${app.id}`, type: "app", id: app.id, name: app.name, path: [], app, menu: app });
                walk(menu.getMenuAsTree(app.id), app, [app.name]);
            }
            return entries;
        }

        function getIndex() {
            if (!index) {
                index = buildIndex();
            }
            return index;
        }

        function findMenuForAction(actionId, appId) {
            if (!actionId) {
                return null;
            }
            const candidates = menu
                .getAll()
                .filter((m) => m.id !== "root" && m.actionID === actionId);
            return (
                candidates.find((m) => m.appID === appId && m.id !== m.appID) ||
                candidates.find((m) => m.id !== m.appID) ||
                candidates[0] ||
                null
            );
        }

        // ------------------------------------------------------------------
        // Track the current menu (sidebar highlight + recents)
        // ------------------------------------------------------------------
        function syncCurrentMenu(actionId, appId) {
            const picked = lastSelectedMenuId ? menu.getMenu(lastSelectedMenuId) : null;
            const sameAction = picked && String(picked.actionID) === String(actionId);
            const found = sameAction
                ? picked
                : typeof actionId === "number"
                  ? findMenuForAction(actionId, appId)
                  : null;
            if (found) {
                state.currentMenuId = found.id;
            } else if (actionId === undefined) {
                state.currentMenuId = null;
            }
            if (found && found.id !== found.appID) {
                const list = [found.id, ...state.recentMenuIds.filter((id) => id !== found.id)];
                state.recentMenuIds = list.slice(0, MAX_RECENTS);
                writeList(RECENT_STORAGE_KEY, state.recentMenuIds);
            }
        }

        function onUiUpdated({ detail: mode }) {
            if (mode === "new") {
                return; // dialogs
            }
            const controller = action.currentController;
            syncCurrentMenu(controller?.action?.id, menu.getCurrentApp()?.id);
        }
        env.bus.addEventListener("ACTION_MANAGER:UI-UPDATED", onUiUpdated);

        // Switching tabs in cux_multi_tabs keeps every controller mounted, so no
        // UI-UPDATED event fires and the sidebar would keep highlighting the
        // menu of the tab we just left (which is not even in the new app).
        env.bus.addEventListener("CUX_MULTI_TABS:TAB-ACTIVATED", ({ detail = {} }) => {
            lastSelectedMenuId = null;
            syncCurrentMenu(detail.actionId, detail.appId);
        });

        // ------------------------------------------------------------------
        // Bookmarks
        // ------------------------------------------------------------------
        function describeCurrentPage() {
            const controller = action.currentController;
            if (!controller) {
                return null;
            }
            const act = controller.action || {};
            const viewType = controller.view?.type;
            const app = menu.getCurrentApp();
            const label = (controller.displayName || act.display_name || act.name || "").toString();
            const resModel = controller.props?.resModel;
            const resId = router.current?.resId;
            if (viewType === "form" && resModel && Number.isInteger(resId)) {
                return {
                    type: "record",
                    label: label || _t("Record"),
                    resModel,
                    resId,
                    actionId: typeof act.id === "number" ? act.id : false,
                    appId: app?.id || false,
                };
            }
            if (typeof act.id !== "number") {
                return null; // unsaved client/server actions cannot be reopened reliably
            }
            const menuItem = findMenuForAction(act.id, app?.id);
            if (menuItem) {
                return {
                    type: "menu",
                    label: menuItem.name,
                    menuId: menuItem.id,
                    actionId: act.id,
                    appId: menuItem.appID || false,
                };
            }
            return {
                type: "action",
                label: label || _t("Action"),
                actionId: act.id,
                viewType: viewType || false,
                appId: app?.id || false,
            };
        }

        function sameTarget(a, b) {
            if (!a || !b || a.type !== b.type) {
                return false;
            }
            if (a.type === "record") {
                return a.resModel === b.resModel && a.resId === b.resId;
            }
            if (a.type === "menu") {
                return a.menuId === b.menuId;
            }
            return a.actionId === b.actionId;
        }

        const api = {
            state,
            getIndex,
            getApps: () => menu.getApps(),
            getMenu: (id) => menu.getMenu(id),
            getCurrentApp: () => menu.getCurrentApp(),
            getRecentMenus() {
                return state.recentMenuIds.map((id) => menu.getMenu(id)).filter(Boolean);
            },
            getAppOf(menuItem) {
                return menuItem?.appID ? menu.getMenu(menuItem.appID) : null;
            },
            getHref(menuItem) {
                return `/odoo/${menuItem.actionPath || "action-" + menuItem.actionID}`;
            },

            /** Fuzzy search over apps, menus and bookmarks. */
            search(query, limit = 30) {
                const q = (query || "").trim();
                if (!q) {
                    return [];
                }
                const entries = getIndex();
                const bookmarkEntries = theme.data.bookmarks.map((b) => ({
                    key: `bm_${b.id}`,
                    type: "bookmark",
                    id: b.id,
                    name: b.label,
                    path: [_t("Bookmarks")],
                    app: b.appId ? menu.getMenu(b.appId) : null,
                    bookmark: b,
                }));
                const all = [...bookmarkEntries, ...entries];
                return fuzzyLookup(q, all, (e) => `${e.path.join(" ")} ${e.name}`).slice(0, limit);
            },

            async openEntry(entry) {
                if (entry.type === "bookmark") {
                    return api.openBookmark(entry.bookmark);
                }
                return selectMenu(entry.menu);
            },
            async openMenu(menuItem) {
                return selectMenu(menuItem);
            },

            // Search history
            pushSearch(query) {
                const q = (query || "").trim();
                if (q.length < 2) {
                    return;
                }
                state.recentSearches = [q, ...state.recentSearches.filter((x) => x !== q)].slice(
                    0,
                    MAX_SEARCH_HISTORY
                );
                writeList(SEARCH_HISTORY_KEY, state.recentSearches);
            },
            clearSearchHistory() {
                state.recentSearches = [];
                writeList(SEARCH_HISTORY_KEY, []);
            },

            // Bookmarks
            describeCurrentPage,
            currentBookmark() {
                const current = describeCurrentPage();
                return current ? theme.data.bookmarks.find((b) => sameTarget(b, current)) : null;
            },
            addCurrentPage() {
                const current = describeCurrentPage();
                if (!current || api.currentBookmark()) {
                    return null;
                }
                const bookmark = { id: newBookmarkId(), createdAt: Date.now(), ...current };
                for (const key of Object.keys(bookmark)) {
                    if (bookmark[key] === false || bookmark[key] === undefined) {
                        delete bookmark[key];
                    }
                }
                theme.setBookmarks([...theme.data.bookmarks, bookmark]);
                return bookmark;
            },
            toggleCurrentPage() {
                const existing = api.currentBookmark();
                if (existing) {
                    api.removeBookmark(existing.id);
                    return null;
                }
                return api.addCurrentPage();
            },
            removeBookmark(id) {
                theme.setBookmarks(theme.data.bookmarks.filter((b) => b.id !== id));
            },
            renameBookmark(id, label) {
                const clean = (label || "").trim().slice(0, 120);
                if (!clean) {
                    return;
                }
                theme.setBookmarks(theme.data.bookmarks.map((b) => (b.id === id ? { ...b, label: clean } : b)));
            },
            moveBookmark(id, delta) {
                const list = [...theme.data.bookmarks];
                const from = list.findIndex((b) => b.id === id);
                const to = from + delta;
                if (from < 0 || to < 0 || to >= list.length) {
                    return;
                }
                const [item] = list.splice(from, 1);
                list.splice(to, 0, item);
                theme.setBookmarks(list);
            },
            async openBookmark(bookmark) {
                if (bookmark.type === "menu" && bookmark.menuId && menu.getMenu(bookmark.menuId)) {
                    return selectMenu(bookmark.menuId);
                }
                const onActionReady = () => {
                    if (bookmark.appId && menu.getMenu(bookmark.appId)) {
                        menu.setCurrentMenu(bookmark.appId);
                    }
                };
                if (bookmark.type === "record") {
                    // Prefer the original window action (keeps its views,
                    // context and URL); fall back to a plain form if that
                    // action no longer exists.
                    if (bookmark.actionId) {
                        try {
                            return await action.doAction(bookmark.actionId, {
                                clearBreadcrumbs: true,
                                viewType: "form",
                                props: { resId: bookmark.resId },
                                onActionReady,
                            });
                        } catch {
                            // deleted/inaccessible action: use the model form below
                        }
                    }
                    return action.doAction(
                        {
                            type: "ir.actions.act_window",
                            res_model: bookmark.resModel,
                            res_id: bookmark.resId,
                            views: [[false, "form"]],
                            target: "current",
                        },
                        { clearBreadcrumbs: true, onActionReady }
                    );
                }
                if (bookmark.actionId) {
                    return action.doAction(bookmark.actionId, {
                        clearBreadcrumbs: true,
                        viewType: bookmark.viewType || undefined,
                        onActionReady,
                    });
                }
            },
        };
        return api;
    },
};

registry.category("services").add("cbt_nav", navigationService);
