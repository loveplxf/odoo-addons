import { Component, proxy, t, useProps } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { CHOICES, PALETTES } from "../../core/constants";
import { isHexColor } from "../../core/color_utils";

let nextId = 0;

/**
 * Centralized theme configuration form. Changes apply instantly (CSS
 * attributes / custom properties) and are persisted per user, debounced.
 * Used both in the quick settings sheet and in the full-page client action.
 */
export class ThemeSettings extends Component {
    static template = "dcs_backend_theme.ThemeSettings";
    props = useProps({
        compact: t.boolean().optional(false),
    });

    setup() {
        this.themeService = useService("cbt_theme");
        this.prefs = proxy(this.themeService.prefs);
        this.uid = `cbt_ts_${nextId++}`;
        this.choices = CHOICES;
        this.palettes = PALETTES;
        this.state = proxy({ hex: this.prefs.cbt_primary_color });
    }

    set(key, value) {
        // A "mini" sidebar means the compact navigation mode.
        if (key === "cbt_sidebar_mode" && value === "mini") {
            this.themeService.setPref("cbt_nav_mode", "compact");
            return;
        }
        this.themeService.setPref(key, value);
    }

    setPalette(id) {
        this.set("cbt_palette", id);
    }

    onColorInput(ev) {
        const value = ev.target.value;
        this.state.hex = value;
        if (isHexColor(value)) {
            this.themeService.setPrefs({ cbt_palette: "custom", cbt_primary_color: value.toLowerCase() });
        }
    }

    onHexChange(ev) {
        let value = ev.target.value.trim();
        if (/^[0-9a-f]{6}$/i.test(value)) {
            value = `#${value}`;
        }
        if (isHexColor(value)) {
            this.state.hex = value.toLowerCase();
            this.themeService.setPrefs({ cbt_palette: "custom", cbt_primary_color: value.toLowerCase() });
        } else {
            this.state.hex = this.prefs.cbt_primary_color;
        }
    }

    reset() {
        this.themeService.resetPrefs();
        this.state.hex = this.prefs.cbt_primary_color;
    }

    fontStack(value) {
        return {
            system: "var(--body-font-family)",
            roboto: "Roboto, sans-serif",
            open_sans: "'Open Sans', sans-serif",
            montserrat: "Montserrat, sans-serif",
            raleway: "Raleway, sans-serif",
            tajawal: "Tajawal, sans-serif",
        }[value];
    }

    get labels() {
        return {
            appearance: _t("Appearance"),
            mode: _t("Theme mode"),
            modeHelp: _t("Switching between light and dark reloads the page once."),
            color: _t("Primary color"),
            custom: _t("Custom color"),
            hex: _t("Hex value"),
            navigation: _t("Navigation"),
            navMode: _t("Navigation style"),
            sidebar: _t("Sidebar"),
            sidebarStyle: _t("Sidebar style"),
            sidebarPos: _t("Sidebar position"),
            sidebarLock: _t("Keep sidebar fixed (don't expand on hover)"),
            typography: _t("Typography"),
            font: _t("Font"),
            fontSize: _t("Font size"),
            layout: _t("Layout"),
            radius: _t("Corners"),
            density: _t("Density"),
            chatter: _t("Chatter position"),
            split: _t("List + form split view"),
            splitHelp: _t("Open records next to the list on large screens."),
            drawer: _t("App drawer"),
            drawerStyle: _t("Drawer layout"),
            iconStyle: _t("App icons"),
            motion: _t("Motion"),
            animation: _t("Animations"),
            animationHelp: _t("Your system's reduced-motion setting is always respected."),
            reset: _t("Reset to defaults"),
        };
    }
}
