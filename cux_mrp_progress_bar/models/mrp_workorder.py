# -*- coding: utf-8 -*-
from odoo import api, fields, models


class MrpWorkorder(models.Model):
    _inherit = "mrp.workorder"

    mrp_workorder_progress = fields.Float(
        string="Progress",
        compute="_compute_mrp_workorder_progress",
        digits=(16, 2),
        help="Percentage of the work order quantity already produced "
             "(produced / quantity to produce).",
    )

    @api.depends("qty_produced", "qty_to_produce")
    def _compute_mrp_workorder_progress(self):
        for workorder in self:
            if workorder.qty_to_produce:
                progress = workorder.qty_produced / workorder.qty_to_produce * 100.0
                workorder.mrp_workorder_progress = min(progress, 100.0)
            else:
                workorder.mrp_workorder_progress = 0.0
