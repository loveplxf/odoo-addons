# -*- coding: utf-8 -*-
from odoo import api, fields, models


class MrpProduction(models.Model):
    _inherit = "mrp.production"

    cux_workorder_progress = fields.Json(
        string="Operations Progress",
        compute="_compute_cux_workorder_progress",
        help="Progress of every work order of the order, drawn as rings in the list view.",
    )

    @api.depends(
        "workorder_ids",
        "workorder_ids.qty_produced",
        "workorder_ids.qty_to_produce",
        "workorder_ids.state",
    )
    def _compute_cux_workorder_progress(self):
        for production in self:
            production.cux_workorder_progress = [
                {
                    "id": workorder.id,
                    "name": workorder.name,
                    "progress": round(workorder.mrp_workorder_progress, 1),
                }
                for workorder in production.workorder_ids
            ]
