# -*- coding: utf-8 -*-
from odoo import fields, models


class MrpTeam(models.Model):
    _name = 'mrp.team'
    _description = 'Production Team'
    _order = 'sequence, name'

    name = fields.Char(
        string='Name',
        required=True,
    )
    sequence = fields.Integer(
        string='Sequence',
        default=10,
    )
    code = fields.Char(
        string='Code',
        copy=False,
    )
    leader_id = fields.Many2one(
        'hr.employee',
        string='Team Leader',
        help='Leader of the production team',
    )
    member_ids = fields.Many2many(
        'hr.employee',
        'mrp_team_hr_employee_rel',
        'team_id',
        'employee_id',
        string='Team Members',
        help='Members of the production team',
    )
    active = fields.Boolean(
        string='Active',
        default=True,
    )
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        default=lambda self: self.env.company,
    )
