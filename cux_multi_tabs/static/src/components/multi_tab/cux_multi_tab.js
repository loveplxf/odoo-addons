import { Component, proxy, t, useListener, useProps } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { Dropdown } from "@web/core/dropdown/dropdown";
import { DropdownGroup } from "@web/core/dropdown/dropdown_group";
import { DropdownItem } from "@web/core/dropdown/dropdown_item";

export class CuxMultiTab extends Component {
    static template = "cux_multi_tab.tab";
    static components = { Dropdown, DropdownItem, DropdownGroup };

    props = useProps({
        action_infos: t.array(),
        active_action: t.function(),
        close_action: t.function(),
        close_current_action: t.function(),
        close_other_action: t.function(),
        multi_tab_next: t.function(),
        multi_tab_prev: t.function(),
    });

    setup() {
        this.contextMenuState = proxy({ visible: false, x: 0, y: 0, action_info: null });
        // OWL 3: useListener replaces useExternalListener and works with any EventTarget
        useListener(window, "click", () => this._close_context_menu());
        useListener(window, "blur", () => this._close_context_menu());
    }

    get labels() {
        return {
            closeTab: _t("Close Tab"),
            closeOtherTabs: _t("Close Other Tabs"),
        };
    }

    _close_current_action() {
        this.props.close_current_action();
    }

    _close_other_action() {
        const activeInfo = this.props.action_infos.find((info) => info.active);
        this.props.close_other_action(activeInfo);
    }

    _on_click_tab_close(info) {
        this._close_context_menu();
        this.props.close_action(info);
    }

    _on_click_tab_item(info) {
        this._close_context_menu();
        this.props.active_action(info);
    }

    _on_tab_contextmenu(ev, info) {
        ev.preventDefault();
        ev.stopPropagation();
        this.contextMenuState.visible = true;
        this.contextMenuState.x = ev.clientX;
        this.contextMenuState.y = ev.clientY;
        this.contextMenuState.action_info = info;
    }

    _close_context_menu() {
        this.contextMenuState.visible = false;
        this.contextMenuState.action_info = null;
    }

    _on_contextmenu_close_tab() {
        const info = this.contextMenuState.action_info;
        this._close_context_menu();
        if (info) {
            this.props.close_action(info);
        }
    }

    _on_contextmenu_close_other_tabs() {
        const info = this.contextMenuState.action_info;
        this._close_context_menu();
        if (info) {
            this.props.close_other_action(info);
        }
    }

    _on_multi_tab_next() {
        this._close_context_menu();
        const infos = this.props.action_infos;
        const index = infos.findIndex((info) => info.active);
        if (index < 0 || index >= infos.length - 1) {
            return;
        }
        this.props.multi_tab_next(index);
    }

    _on_multi_tab_prev() {
        this._close_context_menu();
        const index = this.props.action_infos.findIndex((info) => info.active);
        if (index <= 0) {
            return;
        }
        this.props.multi_tab_prev(index);
    }
}
