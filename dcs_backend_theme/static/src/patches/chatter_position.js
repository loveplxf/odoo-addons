import { proxy } from "@odoo/owl";
import { SIZES } from "@web/core/ui/ui_utils";
import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { FormController } from "@web/views/form/form_controller";
import { FormRenderer } from "@web/views/form/form_renderer";
// Load order: mail's FormRenderer patch defines mailLayout(); ours wraps it.
import "@mail/chatter/web/form_renderer";

/**
 * Chatter position preference:
 *  - auto:   side when the action area is wide enough (see below), else bottom
 *  - bottom: always below the sheet (documents with an attachment
 *            preview keep Odoo's own "COMBO" layout, already bottom)
 *  - side:   beside the sheet from XL screens (one breakpoint earlier)
 * Only the layout decision is changed; chatter features are untouched.
 */
function chatterPosition(component) {
    // Forms embedded in the list split view are narrow: chatter goes below.
    if (component.env.cbtInSplit) {
        return "bottom";
    }
    return component.cbtPrefs?.cbt_chatter_position || "auto";
}

/**
 * Odoo decides "side chatter" from the viewport width (XXL ≥ 1400px), but the
 * theme's sidebar takes part of that width. In "auto" mode we look at the
 * width actually available to the action instead, so the sheet is never
 * squeezed next to an expanded sidebar.
 */
export const AUTO_SIDE_CHATTER_MIN_WIDTH = 1400; // Odoo's XXL breakpoint

function availableWidth() {
    // Read the sidebar's *target* width (CSS token, in px) rather than
    // measuring the layout, which may still be mid-transition.
    const root = document.documentElement;
    const sidebar = root.hasAttribute("data-cbt-has-sidebar")
        ? parseFloat(getComputedStyle(root).getPropertyValue("--cbt-sidebar-current-width")) || 0
        : 0;
    return window.innerWidth - sidebar;
}

patch(FormRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        this.cbtPrefs = proxy(useService("cbt_theme").prefs);
    },
    mailLayout(hasAttachmentContainer) {
        const layout = super.mailLayout(hasAttachmentContainer);
        let position = chatterPosition(this);
        // Subscribe to the layout preferences that change the available width
        // (the renderer re-renders when the sidebar is toggled).
        void (this.cbtPrefs.cbt_sidebar_mode + this.cbtPrefs.cbt_nav_mode);
        if (
            position === "auto" &&
            ["SIDE_CHATTER", "EXTERNAL_COMBO_XXL"].includes(layout) &&
            availableWidth() < AUTO_SIDE_CHATTER_MIN_WIDTH
        ) {
            position = "bottom";
        }
        if (position === "bottom") {
            if (layout === "SIDE_CHATTER") {
                return "BOTTOM_CHATTER";
            }
            if (layout === "EXTERNAL_COMBO_XXL") {
                return "EXTERNAL_COMBO";
            }
        }
        if (
            position === "side" &&
            layout === "BOTTOM_CHATTER" &&
            !this.env.inDialog &&
            this.uiService.size === SIZES.XL
        ) {
            return "SIDE_CHATTER";
        }
        return layout;
    },
});

patch(FormController.prototype, {
    setup() {
        super.setup(...arguments);
        this.cbtPrefs = proxy(useService("cbt_theme").prefs);
    },
    get className() {
        const result = super.className;
        const position = chatterPosition(this);
        if (this.env.inDialog) {
            return result;
        }
        if (position === "side" && this.ui.size === SIZES.XL) {
            // Same flex layout Odoo uses for XXL so the aside chatter fits.
            result["o_xxl_form_view h-100"] = true;
        }
        // "bottom" on XXL keeps the class (needed by the attachment preview
        // layout); the stacking is handled in chatter.scss.
        return result;
    },
});
