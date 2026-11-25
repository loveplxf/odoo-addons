# "Planned Maintenance" was renamed to 计划性维护 in Chinese. Translations of
# noupdate records are not refreshed by a module upgrade, so apply it here.
from odoo import api, SUPERUSER_ID


def migrate(cr, version):
    if not version:
        return
    env = api.Environment(cr, SUPERUSER_ID, {})
    record = env.ref('cux_mrp_oee.loss_reason_planned_maintenance', raise_if_not_found=False)
    if record:
        record.with_context(lang='zh_CN').write({'name': '计划性维护'})
