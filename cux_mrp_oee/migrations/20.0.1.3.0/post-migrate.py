# "Method / External" was split into Process / Environment / Other. Drop the
# old reason and renumber the remaining unplanned ones (the new records are
# created by the data file, so only the noupdate ones need renumbering here).
from odoo import api, SUPERUSER_ID

SEQUENCES = {
    'loss_reason_operator': 22,
    'loss_reason_equipment': 23,
    'loss_reason_material': 24,
}


def migrate(cr, version):
    if not version:
        return
    env = api.Environment(cr, SUPERUSER_ID, {})
    obsolete = env.ref('cux_mrp_oee.loss_reason_method', raise_if_not_found=False)
    if obsolete:
        obsolete.unlink()
    for xmlid, sequence in SEQUENCES.items():
        record = env.ref('cux_mrp_oee.%s' % xmlid, raise_if_not_found=False)
        if record:
            record.sequence = sequence
