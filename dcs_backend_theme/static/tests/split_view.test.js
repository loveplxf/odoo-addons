import { defineMailModels } from "@mail/../tests/mail_test_helpers";
import { describe, expect, test } from "@odoo/hoot";
import { resize } from "@odoo/hoot-dom";
import { animationFrame } from "@odoo/hoot-mock";
import {
    contains,
    defineModels,
    fields,
    getService,
    models,
    mountWithCleanup,
} from "@web/../tests/web_test_helpers";
import { registry } from "@web/core/registry";
import { listView } from "@web/views/list/list_view";
import { ListController } from "@web/views/list/list_controller";
import { WebClient } from "@web/webclient/webclient";

describe.current.tags("desktop");

class Partner extends models.Model {
    _name = "partner";
    name = fields.Char();
    _records = [
        { id: 1, name: "First partner" },
        { id: 2, name: "Second partner" },
    ];
}

defineMailModels();
defineModels([Partner]);

/**
 * Same pattern as sale/account "file upload" lists: a subclass that copies
 * ListController.components into its own static map at definition time.
 */
class SubclassedListController extends ListController {
    static components = { ...ListController.components };
}
registry.category("views").add("cbt_test_subclassed_list", {
    ...listView,
    Controller: SubclassedListController,
});

async function openPartners(jsClass) {
    Partner._views = {
        list: `<list ${jsClass ? `js_class="${jsClass}"` : ""}><field name="name"/></list>`,
        form: `<form><field name="name"/></form>`,
        search: `<search/>`,
    };
    // Odoo 20: the UI size comes from media queries (UI plugin), so the
    // mocked window is made wide enough for the split view (XL+).
    await resize({ width: 1600, height: 900 });
    await mountWithCleanup(WebClient);
    await getService("cbt_theme").setPrefs({ cbt_split_view: true });
    await getService("action").doAction({
        type: "ir.actions.act_window",
        res_model: "partner",
        views: [
            [false, "list"],
            [false, "form"],
        ],
    });
    await animationFrame();
}

test("split view opens the record beside a standard list", async () => {
    await openPartners();
    await contains(".o_data_row:nth-child(2) .o_data_cell").click();
    await animationFrame();
    expect(".o_list_view.cbt-split-active").toHaveCount(1);
    expect(".cbt-split-pane .o_form_view .o_field_widget[name=name] input").toHaveValue("Second partner");
});

test("split view works for ListController subclasses with their own components", async () => {
    await openPartners("cbt_test_subclassed_list");
    await contains(".o_data_row:nth-child(1) .o_data_cell").click();
    await animationFrame();
    expect(".cbt-split-pane .o_form_view .o_field_widget[name=name] input").toHaveValue("First partner");

    // switching rows reuses the pane
    await contains(".o_data_row:nth-child(2) .o_data_cell").click();
    await animationFrame();
    expect(".cbt-split-pane").toHaveCount(1);
    expect(".cbt-split-pane .o_form_view .o_field_widget[name=name] input").toHaveValue("Second partner");
    expect(".o_data_row.cbt-split-current").toHaveCount(1);

    // closing the pane returns to the plain list
    await contains(".cbt-split-pane__header button:last-child").click();
    await animationFrame();
    expect(".cbt-split-pane").toHaveCount(0);
});
