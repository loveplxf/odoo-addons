# Drop the obsolete "Normal Production" downtime reason and renumber the
# preset reasons so that the list follows their complete name.
from odoo import api, SUPERUSER_ID

SEQUENCES = {
    'loss_reason_planned': 10,
    'loss_reason_meal': 11,
    'loss_reason_planned_maintenance': 12,
    'loss_reason_planned_repair': 13,
    'loss_reason_no_demand': 14,
    'loss_reason_rest': 15,
    'loss_reason_unplanned': 20,
    'loss_reason_method': 21,
    'loss_reason_operator': 22,
    'loss_reason_equipment': 23,
    'loss_reason_material': 24,
}


def migrate(cr, version):
    if not version:
        return
    env = api.Environment(cr, SUPERUSER_ID, {})
    obsolete = env.ref('cux_mrp_oee.loss_reason_productive', raise_if_not_found=False)
    if obsolete:
        obsolete.unlink()
    for xmlid, sequence in SEQUENCES.items():
        record = env.ref('cux_mrp_oee.%s' % xmlid, raise_if_not_found=False)
        if record:
            record.sequence = sequence
