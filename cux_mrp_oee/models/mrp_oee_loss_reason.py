# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class MrpOeeLossReason(models.Model):
    _name = 'mrp.oee.loss.reason'
    _description = 'OEE Downtime Reason'
    _order = 'sequence, complete_name'

    name = fields.Char(string='Name', required=True, translate=True)
    sequence = fields.Integer(default=10)
    loss_type = fields.Selection(
        selection=[
            ('productive', 'Normal Production'),
            ('planned', 'Planned Stop'),
            ('unplanned', 'Unplanned Stop'),
        ],
        string='Category',
        required=True,
        default='unplanned',
        help='Planned stops are removed from the planned production time, '
             'unplanned stops reduce the availability.',
    )
    parent_id = fields.Many2one(
        'mrp.oee.loss.reason',
        string='Parent',
        index=True,
        ondelete='cascade',
    )
    complete_name = fields.Char(
        string='Complete Name',
        compute='_compute_complete_name',
        recursive=True,
        store=True,
    )
    child_ids = fields.One2many(
        'mrp.oee.loss.reason',
        'parent_id',
        string='Children',
    )
    active = fields.Boolean(default=True)

    @api.depends('name', 'parent_id.complete_name')
    def _compute_complete_name(self):
        for reason in self:
            if reason.parent_id:
                reason.complete_name = '%s / %s' % (reason.parent_id.complete_name, reason.name)
            else:
                reason.complete_name = reason.name

    @api.constrains('parent_id')
    def _check_parent_id(self):
        for reason in self:
            parent = reason.parent_id
            while parent:
                if parent == reason:
                    raise ValidationError(_('A downtime reason cannot be its own ancestor.'))
                parent = parent.parent_id
