import { Component, t, useProps } from "@odoo/owl";

/**
 * Renders an application icon from the menu payload:
 * - `webIconData`: image (data URI or URL)
 * - `webIcon` "fa-class,color,background": font icon on a colored tile
 */
export class AppIcon extends Component {
    static template = "dcs_backend_theme.AppIcon";
    props = useProps({
        app: t.object(),
        size: t.string().optional("md"), // "sm" | "md" | "lg"
    });

    /**
     * Odoo 20 font icons: web_icon "icon,color,background" where `icon` is a
     * Material Symbols / odoo_ui_icons name rendered with
     * `<i class="oi" data-icon="...">`. Legacy "fa-*" names (Font Awesome is
     * no longer shipped) fall back to a colored initial.
     */
    get fontIcon() {
        const { webIcon, webIconData } = this.props.app;
        if (webIconData || !webIcon) {
            return null;
        }
        const parts = typeof webIcon === "string"
            ? webIcon.split(",")
            : [webIcon.icon, webIcon.color, webIcon.backgroundColor];
        const [name, color, background] = parts;
        if (!name) {
            return null;
        }
        return {
            name: name.startsWith("fa") ? null : name.trim(),
            color: color || "#fff",
            background: background || "var(--cbt-primary)",
        };
    }

    get imageSrc() {
        return this.props.app.webIconData || "/web/static/img/default_icon_app.png";
    }

    get initials() {
        return (this.props.app.name || "?").trim().slice(0, 1).toUpperCase();
    }
}
