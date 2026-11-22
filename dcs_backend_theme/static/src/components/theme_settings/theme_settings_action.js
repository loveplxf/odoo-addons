import { Component, onWillStart, proxy } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";
import { useService } from "@web/core/utils/hooks";
import { isHexColor } from "../../core/color_utils";
import { ThemeSettings } from "./theme_settings";

const LOGIN_LAYOUTS = [
    { value: "minimal", label: _t("Minimal") },
    { value: "corporate", label: _t("Corporate") },
    { value: "split", label: _t("Split screen") },
    { value: "illustration", label: _t("Illustration") },
];
const BACKGROUND_STYLES = [
    { value: "gradient", label: _t("Gradient") },
    { value: "plain", label: _t("Plain") },
    { value: "image", label: _t("Image") },
];
const MAX_UPLOAD = 4 * 1024 * 1024;

/** Login page branding — administrators only (enforced server side too). */
export class LoginSettings extends Component {
    static template = "dcs_backend_theme.LoginSettings";

    setup() {
        this.orm = useService("orm");
        this.notification = useService("notification");
        this.layouts = LOGIN_LAYOUTS;
        this.backgroundStyles = BACKGROUND_STYLES;
        this.state = proxy({ values: null, saving: false, dirty: false, pendingImages: {} });
        onWillStart(async () => {
            this.state.values = await this.orm.call("cbt.theme.config", "get_login_settings", []);
        });
    }

    update(key, value) {
        this.state.values[key] = value;
        this.state.dirty = true;
    }

    onColor(key, ev) {
        if (isHexColor(ev.target.value)) {
            this.update(key, ev.target.value.toLowerCase());
        }
    }

    async onImage(kind, ev) {
        const file = ev.target.files?.[0];
        if (!file) {
            return;
        }
        if (!file.type.startsWith("image/") || file.size > MAX_UPLOAD) {
            this.notification.add(_t("Please choose an image smaller than 4 MB."), { type: "danger" });
            ev.target.value = "";
            return;
        }
        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
        this.state.pendingImages[kind] = {
            data: String(dataUrl).split(",")[1],
            mimetype: file.type,
            name: file.name,
        };
        this.state.values[`${kind}_url`] = dataUrl;
        this.state.dirty = true;
    }

    removeImage(kind) {
        this.state.pendingImages[kind] = false;
        this.state.values[`${kind}_url`] = false;
        this.state.dirty = true;
    }

    async save() {
        const v = this.state.values;
        const payload = {
            layout: v.layout,
            brand_name: v.brand_name || "",
            title: v.title || "",
            subtitle: v.subtitle || "",
            footer_text: v.footer_text || "",
            primary_color: v.primary_color,
            background_style: v.background_style,
            background_color: v.background_color,
            show_powered_by: Boolean(v.show_powered_by),
            show_nav_brand: Boolean(v.show_nav_brand),
            system_name: v.system_name || "",
        };
        for (const [kind, image] of Object.entries(this.state.pendingImages)) {
            payload[kind] = image;
        }
        this.state.saving = true;
        try {
            this.state.values = await this.orm.call("cbt.theme.config", "set_login_settings", [payload]);
            this.state.pendingImages = {};
            this.state.dirty = false;
            this.notification.add(_t("Login page updated."), { type: "success" });
        } finally {
            this.state.saving = false;
        }
    }

    get previewStyle() {
        const v = this.state.values;
        const image = v.background_style === "image" && v.background_url ? `url(${v.background_url})` : "none";
        return `--cbt-login-primary: ${v.primary_color}; --cbt-login-accent: ${v.background_color}; --cbt-preview-image: ${image};`;
    }

    get labels() {
        return {
            title: _t("Login page"),
            help: _t("Applies to everyone on this database: sign-in, password reset and sign-up pages."),
            layout: _t("Layout"),
            brand: _t("Brand name"),
            brandPlaceholder: _t("Defaults to the company name"),
            heading: _t("Headline"),
            subtitle: _t("Supporting text"),
            footer: _t("Footer text"),
            primary: _t("Button color"),
            background: _t("Brand panel"),
            accent: _t("Panel color"),
            logo: _t("Logo"),
            logoHelp: _t("Defaults to the company logo"),
            image: _t("Background image"),
            remove: _t("Remove"),
            upload: _t("Upload"),
            powered: _t("Show “Powered by Odoo”"),
            navBrand: _t("Show logo and system name in the top-left corner"),
            systemName: _t("System name"),
            save: _t("Save login page"),
            open: _t("Open login page"),
            preview: _t("Preview"),
        };
    }
}

/** Full-page settings (client action `dcs_backend_theme.theme_settings`). */
export class ThemeSettingsAction extends Component {
    static template = "dcs_backend_theme.ThemeSettingsAction";
    static components = { ThemeSettings, LoginSettings };

    setup() {
        this.isSystem = user.isSystem;
    }

    get labels() {
        return {
            title: _t("Backend theme"),
            subtitle: _t("Personal preferences are saved to your user and follow you on every device."),
            madeBy: _t("Theme by"),
            personal: _t("My preferences"),
        };
    }
}

registry.category("actions").add("dcs_backend_theme.theme_settings", ThemeSettingsAction);
