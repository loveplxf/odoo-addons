# Drop the "因素" suffix from the unplanned downtime categories. Translations
# of noupdate records are not refreshed by a module upgrade, so apply it here.
from odoo import api, SUPERUSER_ID

RENAMES = {
    'loss_reason_operator': '人员',
    'loss_reason_equipment': '设备',
    'loss_reason_material': '物料',
    'loss_reason_process': '工艺',
    'loss_reason_environment': '环境',
}


def migrate(cr, version):
    if not version:
        return
    env = api.Environment(cr, SUPERUSER_ID, {})
    for xmlid, name in RENAMES.items():
        record = env.ref('cux_mrp_oee.%s' % xmlid, raise_if_not_found=False)
        if record:
            record.with_context(lang='zh_CN').write({'name': name})
