import { Component, proxy, t, useProps } from "@odoo/owl";
import { useSubEnv } from "@web/owl2/utils";
import { _t } from "@web/core/l10n/translation";
import { SIZES } from "@web/core/ui/ui_utils";
import { useService } from "@web/core/utils/hooks";
import { patch } from "@web/core/utils/patch";
import { CallbackRecorder, useSetupAction } from "@web/search/action_hook";
import { ListController } from "@web/views/list/list_controller";
import { ListRenderer } from "@web/views/list/list_renderer";
import { getDefaultConfig, View } from "@web/views/view";

/**
 * Embedded form shown next to the list. It gets its own isolated `config`
 * (so it never renames the list's breadcrumb) and its own beforeLeave
 * recorder, which we call to auto-save before switching or closing — the
 * same autosave semantics as Odoo's standard form view.
 */
export class SplitFormPane extends Component {
    static template = "dcs_backend_theme.SplitFormPane";
    static components = { View };
    props = useProps({
        resModel: t.string(),
        resId: t.number(),
        resIds: t.array(),
        formViewId: t.or([t.number(), t.boolean()]).optional(false),
        context: t.object(),
        actionId: t.or([t.number(), t.boolean()]).optional(false),
        recorder: t.any(), // CallbackRecorder
        onClose: t.function(),
        onExpand: t.function(),
    });

    setup() {
        const config = { ...getDefaultConfig() };
        config.actionId = this.props.actionId || false;
        config.views = [[this.props.formViewId || false, "form"]];
        useSubEnv({ config, cbtSplit: null, cbtSplitHost: null, cbtInSplit: true });
        this.labels = {
            close: _t("Close"),
            expand: _t("Open full form"),
            title: _t("Record preview"),
        };
    }

    get viewProps() {
        return {
            type: "form",
            resModel: this.props.resModel,
            resId: this.props.resId,
            resIds: this.props.resIds,
            viewId: this.props.formViewId || false,
            context: this.props.context,
            display: { controlPanel: false },
            __beforeLeave__: this.props.recorder,
        };
    }
}

/**
 * Rendered by the web.Layout extension (list_split_view.xml). The pane is
 * hosted in the Layout rather than in the ListView template because apps
 * derive their own list templates from web.ListView (t-inherit-mode
 * "primary": purchase, project…) and, in Odoo 19, such copies only receive
 * parent extensions loaded *before* them. Nothing derives from web.Layout.
 * `env.cbtSplitHost` (the list controller) is only set for list views.
 */
export class SplitPaneHost extends Component {
    static template = "dcs_backend_theme.SplitPaneHost";
    static components = { SplitFormPane };

    setup() {
        this.host = this.env.cbtSplitHost;
        this.split = proxy(this.env.cbtSplit);
        this.host.cbtSplitFlags.supported = true;
    }
}

patch(ListController.prototype, {
    setup() {
        super.setup(...arguments);
        this.cbtTheme = useService("cbt_theme");
        this.cbtPrefs = proxy(this.cbtTheme.prefs);
        this.cbtUi = useService("ui");
        this.cbtSplit = proxy({ resId: null, resIds: [], recorder: new CallbackRecorder() });
        // Set by SplitPaneHost once it is mounted in this list's Layout; a
        // list whose controller renders without web.Layout keeps the
        // standard behavior.
        this.cbtSplitFlags = { supported: false };
        useSubEnv({ cbtSplit: this.cbtSplit, cbtSplitHost: this });
        // Leaving the action (breadcrumb, menu…) must save the side form too.
        useSetupAction({ beforeLeave: () => this.cbtSaveSplit() });
    },

    get className() {
        const base = super.className;
        if (!this.cbtSplit?.resId) {
            return base;
        }
        return base ? `${base} cbt-split-active` : "cbt-split-active";
    },

    /**
     * Component classes are referenced directly with `t-component` (no
     * lookup in a `static components` map), so the pane also works for
     * ListController subclasses that define their own components map
     * (sale/account/purchase file-upload lists...).
     */
    get cbtSplitPaneHost() {
        return SplitPaneHost;
    },

    /** Conditions under which the split view replaces the standard form switch. */
    cbtCanSplit(record, options = {}) {
        const views = this.env.config?.views || [];
        return (
            this.cbtPrefs.cbt_split_view &&
            this.cbtSplitFlags.supported &&
            this.cbtUi.size >= SIZES.XL &&
            !this.env.inDialog &&
            !options.newWindow &&
            !this.editable &&
            !(this.props.allowOpenAction && this.archInfo.openAction) &&
            this.env.config?.actionType === "ir.actions.act_window" &&
            views.some(([, type]) => type === "form") &&
            Number.isInteger(record?.resId)
        );
    },

    get cbtFormViewId() {
        const formView = (this.env.config?.views || []).find(([, type]) => type === "form");
        return formView ? formView[0] : false;
    },

    async openRecord(record, options = {}) {
        if (!this.cbtCanSplit(record, options)) {
            return super.openRecord(...arguments);
        }
        if (this.cbtSplit.resId === record.resId) {
            return;
        }
        if (!(await this.cbtSaveSplit())) {
            return;
        }
        this.cbtSplit.recorder = new CallbackRecorder();
        this.cbtSplit.resIds = this.model.root.records.map((r) => r.resId);
        this.cbtSplit.resId = record.resId;
    },

    /** @returns {Promise<boolean>} false when the side form could not be saved */
    async cbtSaveSplit() {
        if (!this.cbtSplit?.resId) {
            return true;
        }
        const results = await Promise.all(this.cbtSplit.recorder.callbacks.map((cb) => cb()));
        if (results.includes(false)) {
            return false;
        }
        await this.model.root.load();
        return true;
    },

    async cbtCloseSplit() {
        if (await this.cbtSaveSplit()) {
            this.cbtSplit.resId = null;
        }
    },

    async cbtExpandSplit() {
        const resId = this.cbtSplit.resId;
        if (!(await this.cbtSaveSplit())) {
            return;
        }
        this.cbtSplit.resId = null;
        this.props.selectRecord(resId, { activeIds: this.cbtSplit.resIds });
    },
});

patch(ListRenderer.prototype, {
    setup() {
        super.setup(...arguments);
        this.cbtSplit = this.env.cbtSplit ? proxy(this.env.cbtSplit) : null;
    },
    getRowClass(record) {
        const classes = super.getRowClass(record);
        if (this.cbtSplit?.resId && record.resId === this.cbtSplit.resId) {
            return Array.isArray(classes) ? [...classes, "cbt-split-current"] : `${classes || ""} cbt-split-current`;
        }
        return classes;
    },
});
