import { defineMailModels } from "@mail/../tests/mail_test_helpers";
import { describe, expect, test } from "@odoo/hoot";
import { press, queryAll, queryAllTexts } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import {
    contains,
    defineMenus,
    getService,
    makeTestApp,
    mountWithCleanup,
} from "@web/../tests/web_test_helpers";

import { AppDrawer } from "@dcs_backend_theme/components/app_drawer/app_drawer";
import { GlobalSearch } from "@dcs_backend_theme/components/global_search/global_search";
import { Sidebar } from "@dcs_backend_theme/components/sidebar/sidebar";
import { ThemeSettings } from "@dcs_backend_theme/components/theme_settings/theme_settings";

describe.current.tags("desktop");
defineMailModels();

function defineTestMenus() {
    defineMenus(
        [
            {
                id: 1,
                name: "CRM",
                xmlid: "crm.crm_menu_root",
                actionID: 10,
                children: [{ id: 2, name: "Pipeline", xmlid: "crm.menu_pipeline", actionID: 11, appID: 1 }],
            },
            {
                id: 3,
                name: "Inventory",
                xmlid: "stock.menu_stock_root",
                actionID: 20,
                children: [{ id: 4, name: "Transfers", xmlid: "stock.menu_transfers", actionID: 21, appID: 3 }],
            },
        ],
        { mode: "replace" }
    );
}

test("sidebar lists apps and filters menus", async () => {
    defineTestMenus();
    await mountWithCleanup(Sidebar);
    expect(".cbt-sidebar").toHaveCount(1);
    expect(queryAllTexts(".cbt-sidebar__app .cbt-sidebar__label")).toEqual(["CRM", "Inventory"]);
    expect(".cbt-sidebar__app[href='/odoo/action-10']").toHaveCount(1);

    await contains(".cbt-sidebar__search-input").edit("transf", { confirm: false });
    expect(queryAllTexts(".cbt-sidebar__result-name")).toEqual(["Transfers"]);
});

test("sidebar mini mode hides labels and exposes tooltips", async () => {
    defineTestMenus();
    await makeTestApp();
    await getService("cbt_theme").setPrefs({ cbt_sidebar_mode: "mini" });
    await mountWithCleanup(Sidebar);
    expect(".cbt-sidebar.cbt-sidebar--mini").toHaveCount(1);
    expect(".cbt-sidebar__app .cbt-sidebar__label").toHaveCount(0);
    expect(".cbt-sidebar__app[data-tooltip='CRM']").toHaveCount(1);
});

test("sidebar is hidden in horizontal navigation", async () => {
    defineTestMenus();
    await makeTestApp();
    await getService("cbt_theme").setPrefs({ cbt_nav_mode: "horizontal" });
    await mountWithCleanup(Sidebar);
    expect(".cbt-sidebar").toHaveCount(0);
});

test("app drawer searches apps and toggles favorites", async () => {
    defineTestMenus();
    await makeTestApp();
    getService("cbt_theme").openPanel("drawer");
    await mountWithCleanup(AppDrawer);
    expect(queryAllTexts(".cbt-drawer__tile-name")).toEqual(["CRM", "Inventory"]);
    expect(".cbt-drawer__input").toBeFocused();

    await contains(".cbt-drawer__input").edit("inv", { confirm: false });
    expect(queryAllTexts(".cbt-drawer__tile-name")).toEqual(["Inventory"]);

    await contains(".cbt-drawer__input").clear({ confirm: false });
    await contains(".cbt-drawer__tile:first-child .cbt-drawer__fav").click();
    expect(getService("cbt_theme").data.favoriteApps).toEqual(["crm.crm_menu_root"]);
    expect(".cbt-drawer__chip").toHaveCount(1);
});

test("app drawer categories layout groups apps", async () => {
    defineTestMenus();
    await makeTestApp();
    await getService("cbt_theme").setPrefs({ cbt_drawer_style: "categories" });
    await mountWithCleanup(AppDrawer);
    // headings are uppercased by CSS: compare the DOM text
    expect(queryAll(".cbt-drawer__section .cbt-drawer__heading").map((el) => el.textContent)).toEqual([
        "Sales & CRM",
        "Operations",
    ]);
});

test("app drawer closes on Escape", async () => {
    defineTestMenus();
    await makeTestApp();
    const theme = getService("cbt_theme");
    theme.openPanel("drawer");
    await mountWithCleanup(AppDrawer);
    await press("Escape");
    expect(theme.ui.panel).toBe(null);
});

test("global search shows results and supports keyboard selection", async () => {
    defineTestMenus();
    await mountWithCleanup(GlobalSearch);
    expect(".cbt-search__input").toBeFocused();
    await contains(".cbt-search__input").edit("pipe", { confirm: false });
    expect(".cbt-search__option").toHaveCount(2); // Pipeline + "search records" fallback
    let options = queryAll(".cbt-search__option");
    expect(options[0]).toHaveAttribute("aria-selected", "true");
    expect(options[0].querySelector(".cbt-search__option-label")).toHaveText("Pipeline");
    await press("ArrowDown");
    await animationFrame();
    options = queryAll(".cbt-search__option");
    expect(options[0]).toHaveAttribute("aria-selected", "false");
    expect(options[1]).toHaveAttribute("aria-selected", "true");
    expect(".cbt-search__input").toHaveAttribute("aria-activedescendant", options[1].id);
});

test("theme settings change preferences through native radios", async () => {
    await mountWithCleanup(ThemeSettings);
    const theme = getService("cbt_theme");
    await contains(".cbt-seg__option:contains(Compact)").click();
    expect(theme.prefs.cbt_density).toBe("compact");
    await contains(".cbt-swatch[aria-label='Teal']").click();
    expect(theme.prefs.cbt_palette).toBe("teal");
    expect(document.documentElement.style.getPropertyValue("--cbt-primary")).toBe("#0d9488");
    await contains(".form-check-input[id$='_split']").click();
    expect(theme.prefs.cbt_split_view).toBe(true);
});
