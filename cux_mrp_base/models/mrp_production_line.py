# -*- coding: utf-8 -*-
from odoo import api, fields, models, _
from odoo.exceptions import ValidationError


class MrpProductionLine(models.Model):
    _name = "mrp.production.line"
    _description = "Production Line"
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = "sequence, parent_path"
    _parent_name = "parent_id"
    _parent_store = True
    _rec_name = 'complete_name'

    name = fields.Char(
        string='Name',
        required=True,
        tracking=True,
    )
    code = fields.Char(
        string='Code',
        copy=False,
    )
    sequence = fields.Integer(
        string='Sequence',
        default=10,
    )
    complete_name = fields.Char(
        string='Complete Name',
        compute='_compute_complete_name',
        recursive=True,
        store=True,
    )
    type = fields.Selection([
        ('factory', 'Factory'),
        ('shop_floor', 'Shop Floor'),
        ('production_line', 'Production Line'),
    ], string='Type', required=True, default='production_line', tracking=True)

    # Parent-child hierarchy
    parent_id = fields.Many2one(
        'mrp.production.line',
        string='Parent',
        index=True,
        ondelete='cascade',
        tracking=True,
        help='Parent production line / shop floor / factory',
    )
    parent_path = fields.Char(
        index=True,
        unaccent=False,
    )
    child_ids = fields.One2many(
        'mrp.production.line',
        'parent_id',
        string='Children',
    )
    child_count = fields.Integer(
        string='Child Count',
        compute='_compute_child_count',
    )
    parent_type = fields.Selection(
        [
            ('factory', 'Factory'),
            ('shop_floor', 'Shop Floor'),
            ('production_line', 'Production Line'),
        ],
        related='parent_id.type',
        string='Parent Type',
        store=True,
    )

    # Linked work centers
    workcenter_ids = fields.One2many(
        'mrp.workcenter',
        'production_line_id',
        string='Work Centers',
    )
    workcenter_count = fields.Integer(
        string='Work Center Count',
        compute='_compute_workcenter_count',
    )

    description = fields.Text(string='Description')
    active = fields.Boolean(string='Active', default=True)
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        default=lambda self: self.env.company,
    )

    @api.depends('name', 'parent_id.complete_name')
    def _compute_complete_name(self):
        for record in self:
            if record.parent_id:
                record.complete_name = '%s / %s' % (record.parent_id.complete_name, record.name)
            else:
                record.complete_name = record.name

    @api.depends('child_ids')
    def _compute_child_count(self):
        for record in self:
            record.child_count = len(record.child_ids)

    @api.depends('workcenter_ids')
    def _compute_workcenter_count(self):
        for record in self:
            record.workcenter_count = len(record.workcenter_ids)

    @api.onchange('type')
    def _onchange_type(self):
        """Clear parent_id when type changes"""
        self.parent_id = False

    @api.constrains('parent_id')
    def _check_parent_id(self):
        """Prevent circular parent references"""
        for record in self:
            seen = set()
            current = record
            while current and current.parent_id:
                if current.parent_id.id in seen or current.parent_id.id == record.id:
                    raise ValidationError(_('Circular parent reference is not allowed.'))
                seen.add(current.id)
                current = current.parent_id

    @api.constrains('type', 'parent_id')
    def _check_type_parent_consistency(self):
        """Validate parent-child type rules:
        - factory: no parent allowed
        - shop_floor: parent must be factory
        - production_line: parent must be shop_floor
        """
        for record in self:
            if record.type == 'factory' and record.parent_id:
                raise ValidationError(_('A factory cannot have a parent.'))
            if record.type == 'shop_floor' and record.parent_id and record.parent_id.type != 'factory':
                raise ValidationError(_('The parent of a shop floor must be a factory.'))
            if record.type == 'production_line' and record.parent_id:
                if record.parent_id.type != 'shop_floor':
                    raise ValidationError(_('The parent of a production line must be a shop floor.'))

    def action_view_children(self):
        """Open child records"""
        self.ensure_one()
        return {
            'name': _('Children'),
            'type': 'ir.actions.act_window',
            'res_model': 'mrp.production.line',
            'view_mode': 'list,form',
            'domain': [('parent_id', '=', self.id)],
            'context': {'default_parent_id': self.id},
        }

    def action_view_workcenters(self):
        """Open linked work centers"""
        self.ensure_one()
        return {
            'name': _('Work Centers'),
            'type': 'ir.actions.act_window',
            'res_model': 'mrp.workcenter',
            'view_mode': 'list,form',
            'domain': [('production_line_id', '=', self.id)],
            'context': {'default_production_line_id': self.id},
        }
