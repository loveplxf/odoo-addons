import { Component, proxy } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { useService } from "@web/core/utils/hooks";
import { AppIcon } from "../app_icon/app_icon";
import { usePanel } from "../../core/use_panel";

/** Side sheet listing the user's bookmarks (synced via res.users.settings). */
export class BookmarksPanel extends Component {
    static template = "dcs_backend_theme.BookmarksPanel";
    static components = { AppIcon };

    setup() {
        this.themeService = useService("cbt_theme");
        this.nav = useService("cbt_nav");
        this.data = proxy(this.themeService.data);
        this.state = proxy({ editingId: null, draft: "", announce: "" });
        this.rootRef = usePanel("root", () => this.close());
        // Snapshot when the panel opens (the action stack does not change while it is open).
        this.current = this.nav.describeCurrentPage();
    }

    get bookmarks() {
        return this.data.bookmarks;
    }

    get currentBookmark() {
        return this.current ? this.nav.currentBookmark() : null;
    }

    appOf(bookmark) {
        return bookmark.appId ? this.nav.getMenu(bookmark.appId) : null;
    }

    typeLabel(bookmark) {
        return {
            menu: _t("Menu"),
            action: _t("View"),
            record: _t("Record"),
        }[bookmark.type];
    }

    close() {
        this.themeService.closePanel("bookmarks");
    }

    toggleCurrent() {
        // The list updates in place; a toast would cover the panel, so the
        // change is announced to assistive technologies instead.
        const added = this.nav.toggleCurrentPage();
        this.state.announce = added
            ? _t("“%s” added to bookmarks", added.label)
            : _t("Removed from bookmarks");
    }

    async open(bookmark) {
        this.close();
        await this.nav.openBookmark(bookmark);
    }

    startRename(bookmark) {
        this.state.editingId = bookmark.id;
        this.state.draft = bookmark.label;
    }

    commitRename() {
        if (this.state.editingId) {
            this.nav.renameBookmark(this.state.editingId, this.state.draft);
        }
        this.state.editingId = null;
    }

    onRenameKeydown(ev) {
        if (ev.key === "Enter") {
            ev.preventDefault();
            this.commitRename();
        } else if (ev.key === "Escape") {
            ev.preventDefault();
            ev.stopPropagation();
            this.state.editingId = null;
        }
    }

    move(bookmark, delta) {
        this.nav.moveBookmark(bookmark.id, delta);
    }

    remove(bookmark) {
        this.nav.removeBookmark(bookmark.id);
    }

    get labels() {
        return {
            title: _t("Bookmarks"),
            add: _t("Bookmark this page"),
            remove: _t("Remove this page"),
            notBookmarkable: _t("This page cannot be bookmarked"),
            empty: _t("No bookmarks yet"),
            emptyHelp: _t("Bookmark menus, views and records you use often. They follow you on every device."),
            rename: _t("Rename"),
            up: _t("Move up"),
            down: _t("Move down"),
            delete: _t("Delete"),
            close: _t("Close"),
        };
    }
}
