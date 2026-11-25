# -*- coding: utf-8 -*-
from odoo import api, fields, models


class MrpWorkcenter(models.Model):
    _inherit = 'mrp.workcenter'

    oee_availability = fields.Float(
        string='Availability (%)',
        compute='_compute_oee_kpis',
        digits=(5, 2),
    )
    oee_performance = fields.Float(
        string='Performance (%)',
        compute='_compute_oee_kpis',
        digits=(5, 2),
    )
    oee_quality = fields.Float(
        string='Quality (%)',
        compute='_compute_oee_kpis',
        digits=(5, 2),
    )
    oee_rate = fields.Float(
        string='OEE (%)',
        compute='_compute_oee_kpis',
        digits=(5, 2),
    )
    oee_state = fields.Selection(
        selection=[
            ('idle', 'Idle'),
            ('below', 'Below Target'),
            ('on_target', 'On Target'),
        ],
        string='OEE Status',
        compute='_compute_oee_kpis',
    )

    @api.depends('oee_target')
    def _compute_oee_kpis(self):
        snapshot_model = self.env['mrp.oee.snapshot']
        shift_model = self.env['mrp.shift']
        today = fields.Date.context_today(self)
        for workcenter in self:
            shifts = shift_model.search([
                ('company_id', 'in', [workcenter.company_id.id, False]),
            ])
            values_list = [
                values
                for values in (
                    snapshot_model._prepare_values(today, shift, workcenter)
                    for shift in shifts
                )
                if values
            ]
            totals = snapshot_model._aggregate_values(values_list) if values_list else {}
            workcenter.oee_availability = totals.get('availability', 0.0)
            workcenter.oee_performance = totals.get('performance', 0.0)
            workcenter.oee_quality = totals.get('quality', 0.0)
            workcenter.oee_rate = totals.get('oee', 0.0)
            if not totals or totals.get('planned_minutes', 0.0) <= 0:
                workcenter.oee_state = 'idle'
            elif workcenter.oee_rate >= (workcenter.oee_target or 90.0):
                workcenter.oee_state = 'on_target'
            else:
                workcenter.oee_state = 'below'
