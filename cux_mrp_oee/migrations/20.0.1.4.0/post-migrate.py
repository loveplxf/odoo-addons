# Preset downtime reasons were reorganised: planned stops in a fixed order and
# unplanned stops grouped by category. Only the records that already exist need
# to be renumbered (new records carry their sequence in the data file).
from odoo import api, SUPERUSER_ID

SEQUENCES = {
    'loss_reason_meal': 10,
    'loss_reason_rest': 11,
    'loss_reason_no_demand': 13,
    'loss_reason_planned_repair': 14,
    'loss_reason_planned_maintenance': 15,
    'loss_reason_operator': 20,
    'loss_reason_equipment': 30,
    'loss_reason_material': 40,
    'loss_reason_process': 50,
    'loss_reason_environment': 60,
    'loss_reason_other': 70,
}


def migrate(cr, version):
    if not version:
        return
    env = api.Environment(cr, SUPERUSER_ID, {})
    for xmlid, sequence in SEQUENCES.items():
        record = env.ref('cux_mrp_oee.%s' % xmlid, raise_if_not_found=False)
        if record:
            record.sequence = sequence
