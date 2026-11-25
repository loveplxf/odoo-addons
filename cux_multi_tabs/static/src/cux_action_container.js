import { ActionContainer } from "@web/webclient/actions/action_container";
import { patch } from "@web/core/utils/patch";
import { CuxMultiTab } from "./components/multi_tab/cux_multi_tab";

import { proxy, useListener, xml } from "@odoo/owl";
import { render } from "@web/owl2/utils";
import { router as _router } from "@web/core/browser/router";
import { useService } from "@web/core/utils/hooks";
import { registry } from "@web/core/registry";
import { user } from "@web/core/user";

const actionRegistry = registry.category("actions");

// Odoo 20 note: the action manager is now an owl Plugin whose controller
// stacks live in a closure, so the Odoo 19 approach of vendoring/replacing
// the whole "action" service no longer works. Tabs are instead tracked here,
// at the ActionContainer level, from the public ACTION_MANAGER:UPDATE and
// ACTION_MANAGER:UI-UPDATED events.
//
// Flow in Odoo 20 (see action_plugin.js):
//   1. clearBreadcrumbs actions first emit a BlankComponent UPDATE and *await*
//      its onMounted — so the transition component MUST be rendered, otherwise
//      the action manager hangs forever.
//   2. The real controller UPDATE fires *before* the controller is mounted;
//      rendering it is what drives the mount.
//   3. UI-UPDATED fires from the controller's onMounted, once the stack is
//      committed and the router state pushed.
// Therefore: UPDATE = pick/render the target tab (a preceding BlankComponent
// marks a new root action), UI-UPDATED = finalize the tab (dedup by root
// displayName — equivalent to the old controllerStacks grouping — and store
// menu/router state used when switching tabs).
patch(ActionContainer.prototype, {
    setup() {
        super.setup();
        this.actionService = useService("action");
        this.menuService = useService("menu");

        this.tabs = proxy([]);
        this.blankInfo = null;
        this._pendingRoot = false;
        this._pendingFullscreen = false;
        this._reactivatingTab = null;
        this._tabSeq = 0;

        useListener(this.env.bus, "ACTION_MANAGER:UPDATE", ({ detail: info }) => {
            if (!info || !info.Component) {
                return;
            }
            if ("withControlPanel" in (info.componentProps || {})) {
                // BlankComponent transition: render it so its onMounted
                // resolves the action manager's promise.
                this._pendingRoot = true;
                this._pendingFullscreen = !!info.fullscreen;
                this.blankInfo = info;
                render(this);
                return;
            }
            this.blankInfo = null;
            const action = info.componentProps?.action;
            const isHomeMenu = action?.tag === "menu";
            // The controller only mounts if we render it: assign the info to
            // the target tab immediately.
            //
            // Where the info goes:
            //  - reactivating a tab (see _activate_tab): that exact tab;
            //  - a new root action (preceded by the BlankComponent transition,
            //    i.e. anything opened from a menu): a brand new tab;
            //  - otherwise (view switch inside a tab, e.g. list → form): the
            //    currently active tab.
            let tab;
            if (this._reactivatingTab) {
                tab = this.tabs.find((t) => t.tid === this._reactivatingTab.tid);
            } else if (isHomeMenu) {
                // Menu client actions (tag="menu"): home menu has no action.id,
                // every other app menu does — so two distinct tabs survive
                // alongside each other.
                tab = this.tabs.find(
                    (t) =>
                        t.info?.componentProps?.action?.tag === "menu" &&
                        (t.info?.componentProps?.action?.id || undefined) ===
                            (action?.id || undefined)
                );
            } else if (!this._pendingRoot) {
                tab = this.tabs.find((t) => t.active);
            }
            this._pendingRoot = false;
            if (!tab) {
                tab = {
                    tid: ++this._tabSeq,
                    key: `__pending_${info.id}`,
                    title: "",
                    active: false,
                    pending: true,
                    // Declared up front so that the reactive proxy already
                    // tracks this key when _syncCurrentTab flips it.
                    fullscreen: false,
                };
                this.tabs.push(tab);
            }
            tab.info = info;
            // Fullscreen actions (Barcode, Shop Floor) are best identified by
            // ACTION_MANAGER:UI-UPDATED (see _syncCurrentTab): for act_window
            // controllers the action is not part of the props. Here only the
            // empty transition flag and the client-action target are available,
            // they merely avoid showing the bar for one frame. Never reset the
            // flag to false here: _syncCurrentTab is the authority for that.
            if (info.fullscreen || this._pendingFullscreen || action?.target === "fullscreen") {
                tab.fullscreen = true;
            }
            this._pendingFullscreen = false;
            this._dropHomeMenuTabs(tab);
            this._setActiveTab(tab);
            render(this);
        });
        useListener(this.env.bus, "ACTION_MANAGER:UI-UPDATED", ({ detail: mode }) =>
            this._syncCurrentTab(mode)
        );
    },

    // The enterprise home menu (client action "menu") must be unmounted as
    // soon as another action is displayed: its onWillUnmount clears the
    // `o_home_menu_background` body class, which this module's SCSS uses to
    // hide the tab bar while the home menu is shown. Keeping its tab mounted
    // (the whole point of this module) would leave that class on the body
    // forever, hiding the tab bar for good.
    _dropHomeMenuTabs(keep) {
        for (let i = this.tabs.length - 1; i >= 0; i--) {
            const t = this.tabs[i];
            const isHomeMenu = t.info?.componentProps?.action?.tag === "menu";
            if (isHomeMenu && (!keep || t.tid !== keep.tid)) {
                this.tabs.splice(i, 1);
            }
        }
    },

    _syncCurrentTab(mode) {
        const controller = this.actionService.currentController;
        let tab = this.tabs.find((t) => t.active);
        if (!controller || !tab) {
            return;
        }
        const state = _router.current;
        const app = this.menuService.getCurrentApp();
        if (tab.pending) {
            // New root action: one tab per root display name (same rule as the
            // 19 version's controllerStacks). Replace an existing tab with the
            // same name instead of duplicating it.
            const key = controller.displayName || tab.info?.componentProps?.name || "Home";
            const existing = this.tabs.find((t) => t.tid !== tab.tid && t.key === key);
            if (existing) {
                existing.info = tab.info;
                existing.fullscreen = !!tab.fullscreen;
                this.tabs.splice(this.tabs.indexOf(tab), 1);
                tab = existing;
            } else {
                tab.key = key;
            }
            tab.title = key;
            delete tab.pending;
            this._setActiveTab(tab);
        }
        if (mode && mode !== "new") {
            // Authoritative fullscreen flag (also true for act_window actions
            // with target="fullscreen", e.g. the Barcode "Operations" page).
            this._pendingFullscreen = false;
            tab.fullscreen = mode === "fullscreen";
            if (tab.fullscreen) {
                // The home menu must not stay mounted behind a fullscreen app:
                // the home_menu service would keep `hasHomeMenu = true`, making
                // its toggle() (the "apps" button) a no-op.
                this._dropHomeMenuTabs(tab);
            }
        }
        tab.state = state;
        tab.actionId = controller.action?.id;
        tab.controller = controller;
        if (app) {
            tab.appId = app.id;
        }
    },

    _setActiveTab(tab) {
        // NOTE: elements read back from this.tabs are reactive proxies, so an
        // identity comparison with the raw object just pushed would always be
        // false. Compare the stable tid instead.
        this.tabs.forEach((t) => {
            t.active = t.tid === tab.tid;
        });
    },

    // Tabs that may be listed in the bar: a fullscreen app (Barcode, Shop
    // Floor) keeps its controller mounted so that its state survives, but it is
    // never shown as a tab.
    get visibleTabs() {
        return this.tabs.filter((t) => !t.fullscreen);
    },

    // True when the active tab runs a fullscreen action: the bar has nothing to
    // show then.
    _isFullscreen() {
        if (this._pendingFullscreen) {
            return true;
        }
        const tab = this.tabs.find((t) => t.active);
        return !!tab?.fullscreen;
    },

    _go_home() {
        // Raw history.pushState doesn't trigger Odoo's router/action-service
        // reactivity, so resolve a real controller through the action service.
        const action = this._homeAction();
        if (action) {
            this.actionService.doAction(action, { clearBreadcrumbs: true });
        }
    },

    // The enterprise home menu is the client action "menu", which is not
    // registered in community; there the user's home action may also be unset,
    // in which case there simply is nowhere to go.
    _homeAction() {
        if (user.homeActionId) {
            return user.homeActionId;
        }
        return actionRegistry.contains("menu") ? "menu" : null;
    },

    // Switching tabs is done the same way Odoo navigates back through the
    // breadcrumbs: the action service is asked to restore the tab's own state
    // (action ids, resId, views...). This is what makes the controllerStack —
    // and therefore "New", buttons and breadcrumbs — point to the right
    // model/action again.
    //
    // Restoring re-creates the tab's views from their state (it is exactly what
    // a browser refresh or a breadcrumb click does), so the other tabs keep
    // their mounted controllers and unsaved content, while the tab being
    // activated is rebuilt from its saved state.
    async _activate_tab(tab) {
        if (!tab) {
            return;
        }
        this._setActiveTab(tab);
        if (tab.appId) {
            this.menuService.setCurrentMenu(tab.appId);
        }
        if (!tab.state) {
            return;
        }
        if (tab.controller && tab.controller === this.actionService.currentController) {
            // The tab is already the one the action service is displaying (its
            // controller is the stack top): a pure UI switch is enough, no need
            // to reload anything.
            this.env.bus.trigger("CUX_MULTI_TABS:TAB-ACTIVATED", {
                actionId: tab.actionId,
                appId: tab.appId,
            });
            return;
        }
        // Tell the UPDATE handler that the incoming controller belongs to this
        // tab, even though it is a root action (a BlankComponent transition is
        // emitted first, which would otherwise be read as a brand new tab).
        this._reactivatingTab = tab;
        try {
            await this.actionService.loadState(tab.state);
        } catch (e) {
            console.warn("[cux_multi_tabs] could not restore tab:", e);
        } finally {
            this._reactivatingTab = null;
        }
        this.env.bus.trigger("CUX_MULTI_TABS:TAB-ACTIVATED", {
            actionId: tab.actionId,
            appId: tab.appId,
        });
    },

    _on_close_action(tab) {
        const index = this.tabs.indexOf(tab);
        if (index < 0) {
            return;
        }
        if (this.tabs.length === 1) {
            // Keep the last tab when there is no home destination (community
            // without a home action): closing it would leave the content area
            // empty and trigger "action does not exist".
            if (!this._homeAction()) {
                return;
            }
            this.tabs.splice(index, 1);
            this._go_home();
            return;
        }
        const wasActive = tab.active;
        this.tabs.splice(index, 1);
        if (wasActive) {
            this._activate_tab(this.tabs[this.tabs.length - 1]);
        }
    },

    // The bar only lists `visibleTabs`, so the neighbour is resolved there.
    _on_multi_tab_next(tab) {
        if (tab) {
            this._activate_tab(tab);
        }
    },

    _on_multi_tab_prev(tab) {
        if (tab) {
            this._activate_tab(tab);
        }
    },

    _close_other_action(tab) {
        const keep = tab || this.tabs.find((t) => t.active);
        if (!keep) {
            return;
        }
        const wasActive = keep.active;
        this.tabs.splice(0, this.tabs.length, keep);
        if (!wasActive) {
            this._activate_tab(keep);
        }
    },

    _close_current_action() {
        const current = this.tabs.find((t) => t.active);
        if (current) {
            this._on_close_action(current);
        }
    },
});

patch(ActionContainer, {
    components: { ...ActionContainer.components, CuxMultiTab },
    template: xml`
        <t t-name="web.ActionContainer">
            <div class="o_action_manager d-flex flex-column">
                <CuxMultiTab
                    action_infos="this.visibleTabs"
                    active_action="(tab) => this._activate_tab(tab)"
                    close_action="(tab) => this._on_close_action(tab)"
                    close_current_action="() => this._close_current_action()"
                    close_other_action="(tab) => this._close_other_action(tab)"
                    multi_tab_next="(tab) => this._on_multi_tab_next(tab)"
                    multi_tab_prev="(tab) => this._on_multi_tab_prev(tab)"
                    hidden="this._isFullscreen()"/>
                <t t-if="this.blankInfo">
                    <!-- The action manager awaits this component's onMounted,
                         which fires even when hidden, so mount it invisibly:
                         its control panel placeholder must not take any
                         layout space (tabs are kept alive anyway). -->
                    <div class="d-none">
                        <t t-component="this.blankInfo.Component" className="'o_action'" t-props="this.blankInfo.componentProps" t-key="this.blankInfo.id"/>
                    </div>
                </t>
                <div class="cux_tabs_stack">
                    <t t-foreach="this.tabs" t-as="tab" t-key="tab.tid">
                        <div class="cux_controller_container d-flex flex-column" t-att-class="tab.active ? '' : 'cux_inactive'">
                            <t t-if="tab.info.Component" t-component="tab.info.Component" className="'o_action'" t-props="tab.info.componentProps" t-key="tab.info.id"/>
                        </div>
                    </t>
                </div>
            </div>
        </t>`,
});
