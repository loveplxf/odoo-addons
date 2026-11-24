# -*- coding: utf-8 -*-
from odoo import fields, models


class MrpWorkcenter(models.Model):
    _inherit = 'mrp.workcenter'

    production_line_id = fields.Many2one(
        'mrp.production.line',
        string='Production Line',
        domain="[('type', '=', 'production_line')]",
        help='Linked production line (only records of type "Production Line" are allowed)',
    )
    shop_floor_id = fields.Many2one(
        'mrp.production.line',
        string='Shop Floor',
        related='production_line_id.parent_id',
        store=True,
        help='Linked shop floor (auto-derived from production line)',
    )
    factory_id = fields.Many2one(
        'mrp.production.line',
        string='Factory',
        related='shop_floor_id.parent_id',
        store=True,
        help='Linked factory (auto-derived from shop floor)',
    )
