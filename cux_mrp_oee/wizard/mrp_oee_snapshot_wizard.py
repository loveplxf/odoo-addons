# -*- coding: utf-8 -*-
from odoo import _, fields, models
from odoo.exceptions import ValidationError


class MrpOeeSnapshotWizard(models.TransientModel):
    _name = 'mrp.oee.snapshot.wizard'
    _description = 'Generate OEE Snapshots'

    date_from = fields.Date(
        string='Date From',
        required=True,
        default=fields.Date.context_today,
    )
    date_to = fields.Date(
        string='Date To',
        required=True,
        default=fields.Date.context_today,
    )

    def action_generate(self):
        self.ensure_one()
        if self.date_to < self.date_from:
            raise ValidationError(_('The end date must be after the start date.'))
        count = self.env['mrp.oee.snapshot']._generate(self.date_from, self.date_to)
        return {
            'type': 'ir.actions.client',
            'tag': 'display_notification',
            'params': {
                'title': _('OEE Snapshots'),
                'message': _('%s snapshot(s) generated.') % count,
                'type': 'success',
                'sticky': False,
                'next': {'type': 'ir.actions.client', 'tag': 'reload'},
            },
        }
