import { proxy } from "@odoo/owl";
import { browser } from "@web/core/browser/browser";
import { cookie } from "@web/core/browser/cookie";
import { rpc } from "@web/core/network/rpc";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import { debounce } from "@web/core/utils/timing";
import { PALETTES, PREF_DEFAULTS, RELOAD_PREFS } from "./constants";
import { hexToRgb, isHexColor, onColor } from "./color_utils";

const SETTINGS_MODEL = "res.users.settings";
const SETTINGS_METHOD = "set_res_users_settings";
const RELOAD_GUARD_KEY = "cbt.scheme_reload";
// The color_scheme cookie is refreshed on every page load; a short lifetime
// means it disappears on its own a few days after the theme is uninstalled.
const SCHEME_COOKIE_TTL = 3 * 24 * 60 * 60;

/** Extract the theme preferences from `user.settings` (session payload). */
export function readPrefs(settings = {}) {
    const prefs = {};
    for (const [key, fallback] of Object.entries(PREF_DEFAULTS)) {
        const value = settings[key];
        prefs[key] = value === undefined || value === null || value === "" ? fallback : value;
    }
    return prefs;
}

export function getPrimaryColor(prefs) {
    if (prefs.cbt_palette === "custom" && isHexColor(prefs.cbt_primary_color)) {
        return prefs.cbt_primary_color;
    }
    const palette = PALETTES.find((p) => p.id === prefs.cbt_palette) || PALETTES[0];
    return palette.color;
}

/**
 * Reflect preferences on <html>: data attributes drive the SCSS, inline
 * custom properties carry the runtime primary color.
 */
export function applyPrefs(prefs, root = document.documentElement) {
    const attrs = {
        "data-cbt-nav": prefs.cbt_nav_mode,
        "data-cbt-sidebar": prefs.cbt_sidebar_mode,
        "data-cbt-sidebar-pos": prefs.cbt_sidebar_position,
        "data-cbt-sidebar-style": prefs.cbt_sidebar_style,
        "data-cbt-sidebar-locked": prefs.cbt_sidebar_locked ? "1" : "0",
        "data-cbt-font": prefs.cbt_font_family,
        "data-cbt-font-size": prefs.cbt_font_size,
        "data-cbt-radius": prefs.cbt_radius,
        "data-cbt-density": prefs.cbt_density,
        "data-cbt-animation": prefs.cbt_animation,
        "data-cbt-icons": prefs.cbt_icon_style,
        "data-cbt-drawer": prefs.cbt_drawer_style,
        "data-cbt-chatter": prefs.cbt_chatter_position,
        "data-cbt-mode": prefs.cbt_theme_mode,
    };
    for (const [name, value] of Object.entries(attrs)) {
        root.setAttribute(name, value);
    }
    const primary = getPrimaryColor(prefs);
    root.style.setProperty("--cbt-primary", primary);
    root.style.setProperty("--cbt-primary-rgb", hexToRgb(primary).join(", "));
    root.style.setProperty("--cbt-on-primary", onColor(primary));
}

export function removeAppliedPrefs(root = document.documentElement) {
    for (const name of [...root.getAttributeNames()]) {
        if (name.startsWith("data-cbt-")) {
            root.removeAttribute(name);
        }
    }
    for (const prop of ["--cbt-primary", "--cbt-primary-rgb", "--cbt-on-primary"]) {
        root.style.removeProperty(prop);
    }
}

export const themeService = {
    start(env) {
        const settings = user.settings || {};
        const prefs = proxy(readPrefs(settings));
        const data = proxy({
            favoriteApps: Array.isArray(settings.cbt_favorite_apps) ? [...settings.cbt_favorite_apps] : [],
            bookmarks: Array.isArray(settings.cbt_bookmarks) ? [...settings.cbt_bookmarks] : [],
        });
        // Transient UI state shared by the theme components.
        const ui = proxy({
            panel: null, // "drawer" | "search" | "bookmarks" | "settings" | null
            sidebarPeek: false, // collapsed/mini sidebar temporarily expanded
            fullscreen: false,
        });

        let pending = {};
        let saving = Promise.resolve();

        const callKwUrl = `/web/dataset/call_kw/${SETTINGS_MODEL}/${SETTINGS_METHOD}`;

        async function flush() {
            const values = pending;
            pending = {};
            if (!Object.keys(values).length || !settings.id) {
                return;
            }
            saving = rpc(callKwUrl, {
                model: SETTINGS_MODEL,
                method: SETTINGS_METHOD,
                args: [[settings.id]],
                kwargs: { new_settings: values, context: user.context },
            }).then(() => {
                for (const [key, value] of Object.entries(values)) {
                    user.updateUserSettings(key, value);
                }
            });
            return saving;
        }
        const scheduleFlush = debounce(flush, 600);
        // Page is going away (reload, close, navigation): send what is still
        // pending with a keepalive request, which outlives the document.
        browser.addEventListener("pagehide", () => {
            if (!Object.keys(pending).length || !settings.id) {
                return;
            }
            scheduleFlush.cancel();
            const values = pending;
            pending = {};
            try {
                browser.fetch(callKwUrl, {
                    method: "POST",
                    keepalive: true,
                    credentials: "same-origin",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        jsonrpc: "2.0",
                        method: "call",
                        params: {
                            model: SETTINGS_MODEL,
                            method: SETTINGS_METHOD,
                            args: [[settings.id]],
                            kwargs: { new_settings: values, context: user.context },
                        },
                    }),
                });
            } catch {
                // best effort only
            }
        });

        function persist(values, { immediate = false } = {}) {
            Object.assign(pending, values);
            if (immediate) {
                scheduleFlush.cancel();
                return flush();
            }
            scheduleFlush();
        }

        // ------------------------------------------------------------------
        // Color scheme: the dark theme is a separately compiled bundle, so a
        // switch between light and dark needs one reload.
        // ------------------------------------------------------------------
        const darkQuery = browser.matchMedia?.("(prefers-color-scheme: dark)");

        function loadedScheme() {
            const value = getComputedStyle(document.documentElement)
                .getPropertyValue("--cbt-scheme")
                .trim();
            return value === "dark" || value === "light" ? value : null;
        }

        function resolvedScheme() {
            const mode = prefs.cbt_theme_mode;
            if (mode === "system") {
                return darkQuery?.matches ? "dark" : "light";
            }
            return mode === "dark" ? "dark" : "light";
        }

        function syncScheme({ allowReload = true } = {}) {
            const target = resolvedScheme();
            // Odoo reads this cookie for lazy bundles and chart colors; the
            // server reads it for the "system" mode (see ir_http.py).
            cookie.set("color_scheme", target, SCHEME_COOKIE_TTL);
            const loaded = loadedScheme();
            if (!allowReload || !loaded || loaded === target) {
                browser.sessionStorage.removeItem(RELOAD_GUARD_KEY);
                return false;
            }
            // Guard against reload loops (e.g. stale assets cache).
            if (browser.sessionStorage.getItem(RELOAD_GUARD_KEY) === target) {
                return false;
            }
            browser.sessionStorage.setItem(RELOAD_GUARD_KEY, target);
            browser.location.reload();
            return true;
        }

        darkQuery?.addEventListener?.("change", () => {
            if (prefs.cbt_theme_mode === "system") {
                syncScheme();
            }
        });

        applyPrefs(prefs);
        browser.requestAnimationFrame(() => syncScheme());

        // ------------------------------------------------------------------
        // Public API
        // ------------------------------------------------------------------
        const api = {
            prefs,
            data,
            ui,
            get primaryColor() {
                return getPrimaryColor(prefs);
            },
            get scheme() {
                return resolvedScheme();
            },
            async setPref(key, value) {
                return api.setPrefs({ [key]: value });
            },
            async setPrefs(values) {
                const changed = {};
                for (const [key, value] of Object.entries(values)) {
                    if (key in PREF_DEFAULTS && prefs[key] !== value) {
                        prefs[key] = value;
                        changed[key] = value;
                    }
                }
                if (!Object.keys(changed).length) {
                    return;
                }
                applyPrefs(prefs);
                const needsReload = Object.keys(changed).some((k) => RELOAD_PREFS.has(k));
                if (needsReload) {
                    await persist(changed, { immediate: true });
                    await saving;
                    syncScheme();
                } else {
                    persist(changed);
                }
            },
            async resetPrefs() {
                return api.setPrefs({ ...PREF_DEFAULTS });
            },
            /** Wait until every pending preference is stored server side. */
            async save() {
                scheduleFlush.cancel();
                await flush();
                await saving;
            },

            // Favorite apps (by xmlid: stable across databases/upgrades)
            isFavoriteApp(app) {
                return Boolean(app?.xmlid) && data.favoriteApps.includes(app.xmlid);
            },
            toggleFavoriteApp(app) {
                if (!app?.xmlid) {
                    return;
                }
                const list = data.favoriteApps.filter((x) => x !== app.xmlid);
                if (list.length === data.favoriteApps.length) {
                    list.push(app.xmlid);
                }
                data.favoriteApps = list;
                // Discrete user actions are saved right away (not debounced):
                // a quick navigation must never reload an older list from the
                // server and then overwrite the new one.
                persist({ cbt_favorite_apps: list }, { immediate: true });
            },

            // Bookmarks
            setBookmarks(list) {
                data.bookmarks = list;
                persist({ cbt_bookmarks: list }, { immediate: true });
            },

            // Panels (mutually exclusive overlays)
            openPanel(name) {
                ui.panel = name;
            },
            closePanel(name) {
                if (!name || ui.panel === name) {
                    ui.panel = null;
                }
            },
            togglePanel(name) {
                ui.panel = ui.panel === name ? null : name;
            },
        };

        env.bus.addEventListener("ACTION_MANAGER:UI-UPDATED", ({ detail: mode }) => {
            if (mode !== "new") {
                ui.fullscreen = mode === "fullscreen";
            }
        });

        return api;
    },
};

registry.category("services").add("cbt_theme", themeService);
