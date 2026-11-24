# -*- coding: utf-8 -*-
from odoo import fields, models


class MrpWorkcenter(models.Model):
    _inherit = 'mrp.workcenter'

    production_line_id = fields.Many2one(
        'mrp.production.line',
        string='生产线',
        domain="[('type', '=', 'production_line')]",
        help='所属产线（仅允许选择类型为"产线"的记录）',
    )
    shop_floor_id = fields.Many2one(
        'mrp.production.line',
        string='车间',
        related='production_line_id.parent_id',
        store=True,
        help='所属车间（由产线自动带出）',
    )
    factory_id = fields.Many2one(
        'mrp.production.line',
        string='工厂',
        related='shop_floor_id.parent_id',
        store=True,
        help='所属工厂（由车间自动带出）',
    )
