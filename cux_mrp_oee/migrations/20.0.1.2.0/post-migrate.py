# Downtime categories are no longer preset records: the reasons themselves
# carry the category (planned / unplanned). Detach the reasons that where
# nested under the preset "Planned Stop" / "Unplanned Stop" records, then
# remove those two records, and renumber the preset reasons by name.
from odoo import api, SUPERUSER_ID

CATEGORY_XMLIDS = (
    'cux_mrp_oee.loss_reason_planned',
    'cux_mrp_oee.loss_reason_unplanned',
)

SEQUENCES = {
    'loss_reason_meal': 10,
    'loss_reason_planned_maintenance': 11,
    'loss_reason_planned_repair': 12,
    'loss_reason_no_demand': 13,
    'loss_reason_rest': 14,
    'loss_reason_method': 20,
    'loss_reason_operator': 21,
    'loss_reason_equipment': 22,
    'loss_reason_material': 23,
}


def migrate(cr, version):
    if not version:
        return
    env = api.Environment(cr, SUPERUSER_ID, {})
    Reason = env['mrp.oee.loss.reason']
    categories = env['mrp.oee.loss.reason']
    for xmlid in CATEGORY_XMLIDS:
        categories |= env.ref(xmlid, raise_if_not_found=False)
    if categories:
        # parent_id is ondelete='cascade': detach the reasons first so that
        # removing the categories does not remove them as well.
        Reason.with_context(active_test=False).search(
            [('parent_id', 'in', categories.ids)]
        ).write({'parent_id': False})
        categories.unlink()
    for xmlid, sequence in SEQUENCES.items():
        record = env.ref('cux_mrp_oee.%s' % xmlid, raise_if_not_found=False)
        if record:
            record.sequence = sequence
