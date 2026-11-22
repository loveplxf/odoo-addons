import { describe, expect, test } from "@odoo/hoot";
import { animationFrame } from "@odoo/hoot-mock";
import { defineMailModels } from "@mail/../tests/mail_test_helpers";
import { defineMenus, getService, makeTestApp } from "@web/../tests/web_test_helpers";

import { contrastRatio, hexToRgb, isHexColor, onColor } from "@dcs_backend_theme/core/color_utils";
import { PREF_DEFAULTS, getAppCategory } from "@dcs_backend_theme/core/constants";
import {
    applyPrefs,
    getPrimaryColor,
    readPrefs,
    removeAppliedPrefs,
} from "@dcs_backend_theme/core/theme_service";

describe.current.tags("headless");
defineMailModels();

describe("color utils", () => {
    test("validates hex colors", () => {
        expect(isHexColor("#4f46e5")).toBe(true);
        expect(isHexColor("#4F46E5")).toBe(true);
        expect(isHexColor("4f46e5")).toBe(false);
        expect(isHexColor("#fff")).toBe(false);
        expect(isHexColor("red")).toBe(false);
    });

    test("computes readable text color on a primary", () => {
        expect(hexToRgb("#4f46e5")).toEqual([79, 70, 229]);
        expect(onColor("#4f46e5")).toBe("#ffffff");
        expect(onColor("#facc15")).toBe("#10131a"); // yellow needs dark ink
        expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeGreaterThan(20);
    });
});

describe("preferences", () => {
    test("readPrefs falls back to defaults for missing values", () => {
        const prefs = readPrefs({ cbt_palette: "teal", cbt_nav_mode: "", cbt_split_view: null });
        expect(prefs.cbt_palette).toBe("teal");
        expect(prefs.cbt_nav_mode).toBe(PREF_DEFAULTS.cbt_nav_mode);
        expect(prefs.cbt_split_view).toBe(false);
        expect(Object.keys(prefs).sort()).toEqual(Object.keys(PREF_DEFAULTS).sort());
    });

    test("getPrimaryColor uses palette or a valid custom color", () => {
        expect(getPrimaryColor({ cbt_palette: "teal" })).toBe("#0d9488");
        expect(getPrimaryColor({ cbt_palette: "custom", cbt_primary_color: "#123456" })).toBe("#123456");
        // invalid custom color falls back to the first palette
        expect(getPrimaryColor({ cbt_palette: "custom", cbt_primary_color: "nope" })).toBe("#4f46e5");
    });

    test("applyPrefs reflects preferences on the root element and can be undone", () => {
        const root = document.createElement("div");
        applyPrefs(readPrefs({ cbt_density: "compact", cbt_palette: "red" }), root);
        expect(root.getAttribute("data-cbt-density")).toBe("compact");
        expect(root.getAttribute("data-cbt-nav")).toBe("vertical");
        expect(root.style.getPropertyValue("--cbt-primary")).toBe("#dc2626");
        expect(root.style.getPropertyValue("--cbt-primary-rgb")).toBe("220, 38, 38");
        removeAppliedPrefs(root);
        expect(root.getAttributeNames().filter((n) => n.startsWith("data-cbt-"))).toEqual([]);
        expect(root.style.getPropertyValue("--cbt-primary")).toBe("");
    });

    test("apps are grouped into categories by module", () => {
        expect(getAppCategory({ xmlid: "crm.crm_menu_root" })).toBe("sales");
        expect(getAppCategory({ xmlid: "stock.menu_stock_root" })).toBe("operations");
        expect(getAppCategory({ xmlid: "my_custom.menu" })).toBe("other");
        expect(getAppCategory({})).toBe("other");
    });
});

describe("services", () => {
    test("theme service applies changes live and manages panels/favorites", async () => {
        await makeTestApp();
        const theme = getService("cbt_theme");
        expect(theme.prefs.cbt_theme_mode).toBe("light");

        await theme.setPrefs({ cbt_radius: "lg", cbt_palette: "green", unknown_key: 1 });
        expect(document.documentElement.getAttribute("data-cbt-radius")).toBe("lg");
        expect(theme.primaryColor).toBe("#16a34a");
        expect("unknown_key" in theme.prefs).toBe(false);

        theme.openPanel("drawer");
        expect(theme.ui.panel).toBe("drawer");
        theme.togglePanel("search");
        expect(theme.ui.panel).toBe("search");
        theme.closePanel("drawer"); // not the open one: no effect
        expect(theme.ui.panel).toBe("search");
        theme.closePanel();
        expect(theme.ui.panel).toBe(null);

        const app = { id: 1, xmlid: "crm.crm_menu_root" };
        theme.toggleFavoriteApp(app);
        expect(theme.isFavoriteApp(app)).toBe(true);
        theme.toggleFavoriteApp(app);
        expect(theme.isFavoriteApp(app)).toBe(false);
    });

    test("navigation service indexes menus and searches them", async () => {
        defineMenus(
            [
                {
                    id: 1,
                    name: "Sales",
                    xmlid: "sale.menu_root",
                    actionID: 10,
                    children: [
                        { id: 2, name: "Orders", xmlid: "sale.menu_orders", actionID: 11, appID: 1 },
                        {
                            id: 3,
                            name: "Configuration",
                            xmlid: "sale.menu_config",
                            appID: 1,
                            children: [
                                { id: 4, name: "Pricelists", xmlid: "sale.menu_pricelists", actionID: 12, appID: 1 },
                            ],
                        },
                    ],
                },
            ],
            { mode: "replace" }
        );
        await makeTestApp();
        const nav = getService("cbt_nav");
        const index = nav.getIndex();
        expect(index.map((e) => e.name)).toEqual(["Sales", "Orders", "Pricelists"]);
        const pricelist = index.find((e) => e.name === "Pricelists");
        expect(pricelist.path).toEqual(["Sales", "Configuration"]);

        const results = nav.search("pricel");
        expect(results[0].name).toBe("Pricelists");
        expect(nav.search("")).toEqual([]);
        expect(nav.getHref({ actionID: 12 })).toBe("/odoo/action-12");
        expect(nav.getHref({ actionID: 12, actionPath: "pricelists" })).toBe("/odoo/pricelists");
    });

    test("bookmarks can be renamed, reordered and removed", async () => {
        await makeTestApp();
        const theme = getService("cbt_theme");
        const nav = getService("cbt_nav");
        theme.setBookmarks([
            { id: "a", type: "menu", label: "A", menuId: 1 },
            { id: "b", type: "action", label: "B", actionId: 2 },
            { id: "c", type: "record", label: "C", resModel: "res.partner", resId: 3 },
        ]);
        nav.renameBookmark("b", "  Renamed  ");
        expect(theme.data.bookmarks[1].label).toBe("Renamed");
        nav.renameBookmark("b", "   "); // empty labels are ignored
        expect(theme.data.bookmarks[1].label).toBe("Renamed");
        nav.moveBookmark("c", -1);
        expect(theme.data.bookmarks.map((b) => b.id)).toEqual(["a", "c", "b"]);
        nav.moveBookmark("a", -1); // out of range: no-op
        expect(theme.data.bookmarks.map((b) => b.id)).toEqual(["a", "c", "b"]);
        nav.removeBookmark("a");
        expect(theme.data.bookmarks.map((b) => b.id)).toEqual(["c", "b"]);
    });

    test("search history keeps recent unique queries", async () => {
        await makeTestApp();
        const nav = getService("cbt_nav");
        nav.clearSearchHistory();
        nav.pushSearch("invoice");
        nav.pushSearch("x"); // too short
        nav.pushSearch("partner");
        nav.pushSearch("invoice");
        await animationFrame();
        expect(nav.state.recentSearches).toEqual(["invoice", "partner"]);
    });
});
