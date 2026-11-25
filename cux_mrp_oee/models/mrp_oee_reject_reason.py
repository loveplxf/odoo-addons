# -*- coding: utf-8 -*-
from odoo import _, api, fields, models
from odoo.exceptions import ValidationError


class MrpOeeRejectReason(models.Model):
    _name = 'mrp.oee.reject.reason'
    _description = 'OEE Reject Reason'
    _order = 'sequence, id'

    name = fields.Char(string='Name', required=True, translate=True)
    sequence = fields.Integer(default=10)
    parent_id = fields.Many2one(
        'mrp.oee.reject.reason',
        string='Parent',
        index=True,
        ondelete='cascade',
    )
    complete_name = fields.Char(
        string='Complete Name',
        compute='_compute_complete_name',
        recursive=True,
        translate=True,
    )
    child_ids = fields.One2many(
        'mrp.oee.reject.reason',
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
                    raise ValidationError(_('A reject reason cannot be its own ancestor.'))
                parent = parent.parent_id
