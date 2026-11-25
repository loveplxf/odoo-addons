# -*- coding: utf-8 -*-
from odoo import api, fields, models


class MrpOeeProductivity(models.Model):
    _name = 'mrp.oee.productivity'
    _description = 'OEE Downtime Record'
    _order = 'date desc, id desc'

    date = fields.Date(
        string='Date',
        required=True,
        default=fields.Date.context_today,
        index=True,
    )
    shift_id = fields.Many2one(
        'mrp.shift',
        string='Shift',
        required=True,
        check_company=True,
        index=True,
    )
    workcenter_id = fields.Many2one(
        'mrp.workcenter',
        string='Work Center',
        required=True,
        check_company=True,
        index=True,
    )
    hour_from = fields.Float(
        string='Start Time',
        required=True,
        help='Format is hh:mm',
    )
    hour_to = fields.Float(
        string='End Time',
        required=True,
        help='Format is hh:mm, values lower than the start time are considered as the next day.',
    )
    duration = fields.Float(
        string='Downtime',
        compute='_compute_duration',
        store=True,
        digits=(16, 2),
        help='Duration in hours.',
    )
    loss_reason_id = fields.Many2one(
        'mrp.oee.loss.reason',
        string='Downtime Reason',
        required=True,
        index=True,
    )
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )

    @api.depends('hour_from', 'hour_to')
    def _compute_duration(self):
        for record in self:
            record.duration = round((record.hour_to - record.hour_from) % 24.0, 2)

    @api.onchange('shift_id')
    def _onchange_shift_id(self):
        for record in self:
            if record.shift_id:
                record.hour_from = record.shift_id.hour_from
                record.hour_to = record.shift_id.hour_to

    @api.onchange('workcenter_id')
    def _onchange_workcenter_id(self):
        for record in self:
            if record.workcenter_id:
                record.company_id = record.workcenter_id.company_id
