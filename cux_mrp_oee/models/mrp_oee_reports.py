# -*- coding: utf-8 -*-
from odoo import fields, models, tools


class MrpOeeLossReport(models.Model):
    _name = 'mrp.oee.loss.report'
    _description = 'OEE Downtime Analysis'
    _auto = False
    _order = 'date desc'

    id = fields.Id()
    date = fields.Date(string='Date', readonly=True)
    shift_id = fields.Many2one('mrp.shift', string='Shift', readonly=True)
    workcenter_id = fields.Many2one('mrp.workcenter', string='Work Center', readonly=True)
    loss_reason_id = fields.Many2one('mrp.oee.loss.reason', string='Downtime Reason', readonly=True)
    loss_type = fields.Selection(
        selection=[
            ('productive', 'Normal Production'),
            ('planned', 'Planned Stop'),
            ('unplanned', 'Unplanned Stop'),
        ],
        string='Category',
        readonly=True,
    )
    duration = fields.Float(string='Downtime (h)', digits=(16, 2), readonly=True)
    company_id = fields.Many2one('res.company', string='Company', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT p.id AS id,
                       p.date AS date,
                       p.shift_id AS shift_id,
                       p.workcenter_id AS workcenter_id,
                       p.loss_reason_id AS loss_reason_id,
                       r.loss_type AS loss_type,
                       MOD(MOD((p.hour_to - p.hour_from)::numeric, 24) + 24, 24)::float AS duration,
                       p.company_id AS company_id
                  FROM mrp_oee_productivity p
                  JOIN mrp_oee_loss_reason r ON r.id = p.loss_reason_id
            )
        """ % self._table)


class MrpOeeRejectReport(models.Model):
    _name = 'mrp.oee.reject.report'
    _description = 'OEE Reject Analysis'
    _auto = False
    _order = 'date desc'

    id = fields.Id()
    date = fields.Date(string='Date', readonly=True)
    shift_id = fields.Many2one('mrp.shift', string='Shift', readonly=True)
    workcenter_id = fields.Many2one('mrp.workcenter', string='Work Center', readonly=True)
    product_id = fields.Many2one('product.product', string='Product', readonly=True)
    reject_reason_id = fields.Many2one('mrp.oee.reject.reason', string='Reject Reason', readonly=True)
    qty = fields.Float(string='Rejected Quantity', digits=(16, 2), readonly=True)
    company_id = fields.Many2one('res.company', string='Company', readonly=True)

    def init(self):
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT p.id AS id,
                       p.date AS date,
                       p.shift_id AS shift_id,
                       p.workcenter_id AS workcenter_id,
                       p.product_id AS product_id,
                       p.reject_reason_id AS reject_reason_id,
                       p.qty AS qty,
                       p.company_id AS company_id
                  FROM mrp_oee_production p
                 WHERE p.report_type = 'reject'
            )
        """ % self._table)
