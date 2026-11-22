import { Component } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { user } from "@web/core/user";
import { useService } from "@web/core/utils/hooks";
import { usePanel } from "../../core/use_panel";
import { ThemeSettings } from "./theme_settings";

/** Quick settings sheet opened from the systray / sidebar. */
export class ThemePanel extends Component {
    static template = "dcs_backend_theme.ThemePanel";
    static components = { ThemeSettings };

    setup() {
        this.themeService = useService("cbt_theme");
        this.action = useService("action");
        this.rootRef = usePanel("root", () => this.close());
        this.isSystem = user.isSystem;
    }

    close() {
        this.themeService.closePanel("settings");
    }

    async openFullPage() {
        this.close();
        await this.action.doAction("dcs_backend_theme.action_theme_settings");
    }

    get labels() {
        return {
            title: _t("Theme settings"),
            close: _t("Close"),
            more: _t("Login page & full settings"),
        };
    }
}
