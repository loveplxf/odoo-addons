import { Component, proxy } from "@odoo/owl";
import { useHotkey } from "@web/core/hotkeys/hotkey_hook";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";
import { AppDrawer } from "../app_drawer/app_drawer";
import { BookmarksPanel } from "../bookmarks/bookmarks_panel";
import { GlobalSearch } from "../global_search/global_search";
import { ThemePanel } from "../theme_settings/theme_panel";

export const SEARCH_HOTKEY = "control+shift+f";

/**
 * Hosts the theme overlays. Each panel is only instantiated while it is open
 * (nothing is rendered or computed otherwise), so they add no cost to the
 * initial load.
 */
export class OverlayHostImpl extends Component {
    static template = "dcs_backend_theme.OverlayHost";
    static components = { AppDrawer, BookmarksPanel, GlobalSearch, ThemePanel };

    setup() {
        this.themeService = useService("cbt_theme");
        this.themeUi = proxy(this.themeService.ui);
        useHotkey(SEARCH_HOTKEY, () => this.themeService.togglePanel("drawer"), {
            global: true,
            bypassEditableProtection: true,
        });
    }
}

export class OverlayHost extends Component {
    static template = "dcs_backend_theme.OverlayHostGate";
    static components = { OverlayHostImpl };
}

registry.category("main_components").add("cbt.OverlayHost", { Component: OverlayHost });
