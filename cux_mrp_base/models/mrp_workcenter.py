# -*- coding: utf-8 -*-
from odoo import api, fields, models

SEARCH_PANEL_FIELDS = ('factory_id', 'shop_floor_id', 'production_line_id')


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
    team_ids = fields.Many2many(
        'mrp.team',
        'mrp_workcenter_mrp_team_rel',
        'workcenter_id',
        'team_id',
        string='Teams',
        help='Production teams assigned to this work center',
    )
    shift_ids = fields.Many2many(
        'mrp.shift',
        'mrp_workcenter_mrp_shift_rel',
        'workcenter_id',
        'shift_id',
        string='Shifts',
        help='Shifts available for this work center',
    )

    @api.model
    def search_panel_select_range(self, field_name, **kwargs):
        result = super().search_panel_select_range(field_name, **kwargs)
        if field_name in SEARCH_PANEL_FIELDS:
            # The search panel already indents the values by parent_id, while
            # mrp.production.line._rec_name is `complete_name`: every node
            # would repeat its ancestors ("Factory / Shop Floor / Line").
            # Label the nodes with their own name only.
            values = result.get('values') or []
            ids = [value['id'] for value in values if value.get('id')]
            names = {line.id: line.name for line in self.env['mrp.production.line'].browse(ids)}
            for value in values:
                if value.get('id') in names:
                    value['display_name'] = names[value['id']]
        return result
