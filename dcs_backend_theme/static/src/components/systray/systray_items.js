import { Component, proxy } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { useService } from "@web/core/utils/hooks";

class ThemeSystrayButton extends Component {
    setup() {
        this.themeService = useService("cbt_theme");
        this.themeUi = proxy(this.themeService.ui);
    }
}

export class BookmarksSystray extends ThemeSystrayButton {
    static template = "dcs_backend_theme.BookmarksSystray";
    setup() {
        super.setup();
        this.label = _t("Bookmarks");
    }
    open() {
        this.themeService.togglePanel("bookmarks");
    }
}

export class ThemeSettingsSystray extends ThemeSystrayButton {
    static template = "dcs_backend_theme.ThemeSettingsSystray";
    setup() {
        super.setup();
        this.label = _t("Theme settings");
    }
    open() {
        this.themeService.togglePanel("settings");
    }
}

const systray = registry.category("systray");
// Higher sequence = further to the start of the systray.
systray.add("cbt.bookmarks", { Component: BookmarksSystray }, { sequence: 95 });
systray.add("cbt.theme_settings", { Component: ThemeSettingsSystray }, { sequence: 94 });
