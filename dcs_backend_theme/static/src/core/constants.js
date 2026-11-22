import { _t } from "@web/core/l10n/translation";

/** Name of every preference field on res.users.settings, with its default. */
export const PREF_DEFAULTS = Object.freeze({
    cbt_theme_mode: "light",
    cbt_palette: "indigo",
    cbt_primary_color: "#4f46e5",
    cbt_nav_mode: "vertical",
    cbt_sidebar_mode: "expanded",
    cbt_sidebar_locked: true,
    cbt_sidebar_position: "start",
    cbt_sidebar_style: "tinted",
    cbt_font_family: "system",
    cbt_font_size: "md",
    cbt_radius: "md",
    cbt_density: "comfortable",
    cbt_chatter_position: "auto",
    cbt_drawer_style: "grid",
    cbt_icon_style: "rounded",
    cbt_animation: "full",
    cbt_split_view: false,
});

/** Preferences that need a page reload to take effect (compiled bundle). */
export const RELOAD_PREFS = new Set(["cbt_theme_mode"]);

export const PALETTES = [
    { id: "indigo", label: _t("Indigo"), color: "#4f46e5" },
    { id: "blue", label: _t("Blue"), color: "#2563eb" },
    { id: "purple", label: _t("Purple"), color: "#7c3aed" },
    { id: "green", label: _t("Green"), color: "#16a34a" },
    { id: "teal", label: _t("Teal"), color: "#0d9488" },
    { id: "orange", label: _t("Orange"), color: "#ea580c" },
    { id: "red", label: _t("Red"), color: "#dc2626" },
    { id: "slate", label: _t("Slate"), color: "#475569" },
];

export const CHOICES = {
    cbt_theme_mode: [
        { value: "light", label: _t("Light"), icon: "light_mode" },
        { value: "dark", label: _t("Dark"), icon: "dark_mode" },
        { value: "system", label: _t("System"), icon: "desktop_windows" },
    ],
    cbt_nav_mode: [
        { value: "vertical", label: _t("Sidebar"), icon: "left_panel_open" },
        { value: "horizontal", label: _t("Top bar"), icon: "toolbar" },
        { value: "compact", label: _t("Compact"), icon: "more_vert" },
        { value: "drawer", label: _t("App drawer"), icon: "apps" },
    ],
    cbt_sidebar_mode: [
        { value: "expanded", label: _t("Expanded") },
        { value: "mini", label: _t("Mini") },
        { value: "collapsed", label: _t("Collapsed") },
    ],
    cbt_sidebar_position: [
        { value: "start", label: _t("Start") },
        { value: "end", label: _t("End") },
    ],
    cbt_sidebar_style: [
        { value: "light", label: _t("Light") },
        { value: "tinted", label: _t("Tinted") },
        { value: "ink", label: _t("Ink") },
    ],
    cbt_font_family: [
        { value: "system", label: _t("System UI") },
        { value: "roboto", label: "Roboto" },
        { value: "open_sans", label: "Open Sans" },
        { value: "montserrat", label: "Montserrat" },
        { value: "raleway", label: "Raleway" },
        { value: "tajawal", label: "Tajawal" },
    ],
    cbt_font_size: [
        { value: "sm", label: _t("S") },
        { value: "md", label: _t("M") },
        { value: "lg", label: _t("L") },
        { value: "xl", label: _t("XL") },
    ],
    cbt_radius: [
        { value: "none", label: _t("Square") },
        { value: "sm", label: _t("Subtle") },
        { value: "md", label: _t("Rounded") },
        { value: "lg", label: _t("Soft") },
    ],
    cbt_density: [
        { value: "compact", label: _t("Compact") },
        { value: "comfortable", label: _t("Comfortable") },
        { value: "spacious", label: _t("Spacious") },
    ],
    cbt_chatter_position: [
        { value: "auto", label: _t("Automatic") },
        { value: "side", label: _t("Side") },
        { value: "bottom", label: _t("Bottom") },
    ],
    cbt_drawer_style: [
        { value: "grid", label: _t("Grid") },
        { value: "categories", label: _t("Categories") },
        { value: "list", label: _t("List") },
    ],
    cbt_icon_style: [
        { value: "original", label: _t("Original") },
        { value: "rounded", label: _t("Rounded") },
        { value: "circle", label: _t("Circle") },
        { value: "flat", label: _t("Flat") },
    ],
    cbt_animation: [
        { value: "full", label: _t("Full") },
        { value: "reduced", label: _t("Reduced") },
        { value: "none", label: _t("Off") },
    ],
};

/**
 * Root menus are not categorized by Odoo: we map well-known app xmlid
 * prefixes (the module name) to a few business categories. Unknown apps go
 * to "Other". Purely presentational.
 */
const CATEGORY_BY_MODULE = {
    crm: "sales", sale: "sales", sale_management: "sales", point_of_sale: "sales", website_sale: "sales",
    sale_subscription: "sales", loyalty: "sales",
    account: "finance", account_accountant: "finance", hr_expense: "finance", documents: "finance",
    stock: "operations", mrp: "operations", purchase: "operations", maintenance: "operations",
    quality: "operations", repair: "operations", fleet: "operations", project: "operations",
    hr_timesheet: "operations", planning: "operations", field_service: "operations",
    hr: "people", hr_recruitment: "people", hr_holidays: "people", hr_attendance: "people",
    hr_appraisal: "people", hr_skills: "people", lunch: "people", hr_work_entry: "people",
    website: "marketing", mass_mailing: "marketing", marketing_card: "marketing", event: "marketing",
    survey: "marketing", social: "marketing", website_slides: "marketing", im_livechat: "marketing",
    mail: "productivity", calendar: "productivity", contacts: "productivity", note: "productivity",
    knowledge: "productivity", todo: "productivity", project_todo: "productivity", spreadsheet_dashboard: "productivity",
    base: "settings", base_setup: "settings", utm: "settings", digest: "settings",
};

export const CATEGORIES = [
    { id: "sales", label: _t("Sales & CRM") },
    { id: "finance", label: _t("Finance") },
    { id: "operations", label: _t("Operations") },
    { id: "people", label: _t("People") },
    { id: "marketing", label: _t("Website & Marketing") },
    { id: "productivity", label: _t("Productivity") },
    { id: "other", label: _t("Other") },
    { id: "settings", label: _t("Administration") },
];

export function getAppCategory(app) {
    const module = (app.xmlid || "").split(".")[0];
    return CATEGORY_BY_MODULE[module] || "other";
}

export const RECENT_STORAGE_KEY = "cbt.recent_menus";
export const SEARCH_HISTORY_KEY = "cbt.recent_searches";
export const MAX_RECENTS = 8;
export const MAX_SEARCH_HISTORY = 6;
