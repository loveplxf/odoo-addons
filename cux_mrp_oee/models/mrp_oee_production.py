# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class MrpOeeProduction(models.Model):
    _name = 'mrp.oee.production'
    _description = 'OEE Production Record'
    _order = 'date desc, report_time desc, id desc'

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
    product_id = fields.Many2one(
        'product.product',
        string='Product',
        required=True,
        check_company=True,
        index=True,
    )
    cycle_time = fields.Float(
        string='Theoretical Cycle (min)',
        compute='_compute_cycle_time',
        digits=(16, 4),
        help='Theoretical cycle time in minutes, taken from the operation of the product on this work center.',
    )
    qty = fields.Float(
        string='Reported Quantity',
        required=True,
        default=1.0,
    )
    report_type = fields.Selection(
        selection=[
            ('good', 'Good'),
            ('reject', 'Reject'),
        ],
        string='Report Type',
        required=True,
        default='good',
    )
    reject_reason_id = fields.Many2one(
        'mrp.oee.reject.reason',
        string='Reject Reason',
    )
    report_time = fields.Datetime(
        string='Report Time',
        required=True,
        default=fields.Datetime.now,
    )
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )

    @api.depends('workcenter_id', 'product_id')
    def _compute_cycle_time(self):
        operation_model = self.env['mrp.routing.workcenter']
        for record in self:
            if record.workcenter_id and record.product_id:
                record.cycle_time = record._get_cycle_time(operation_model)
            else:
                record.cycle_time = 0.0

    def _get_cycle_time(self, operation_model=None):
        """Return the theoretical cycle time (minutes) of the product on the work center."""
        self.ensure_one()
        operation_model = operation_model or self.env['mrp.routing.workcenter']
        operation = operation_model.search([
            ('workcenter_id', '=', self.workcenter_id.id),
            ('bom_id.product_tmpl_id', '=', self.product_id.product_tmpl_id.id),
        ], order='id', limit=1)
        return operation.time_cycle_manual or 0.0

    @api.onchange('report_type')
    def _onchange_report_type(self):
        for record in self:
            if record.report_type == 'good':
                record.reject_reason_id = False

    @api.onchange('workcenter_id')
    def _onchange_workcenter_id(self):
        for record in self:
            if record.workcenter_id:
                record.company_id = record.workcenter_id.company_id

    @api.constrains('qty', 'report_type', 'reject_reason_id')
    def _check_values(self):
        for record in self:
            if record.qty <= 0:
                raise ValidationError(_('The reported quantity must be positive.'))
            if record.report_type == 'reject' and not record.reject_reason_id:
                raise ValidationError(_('A reject reason is required for rejected quantities.'))
