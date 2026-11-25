# -*- coding: utf-8 -*-
from datetime import UTC, timedelta
from zoneinfo import ZoneInfo

from odoo import api, fields, models


class MrpOeeProductivity(models.Model):
    _name = 'mrp.oee.productivity'
    _description = 'OEE Downtime Record'
    _order = 'date_start desc, id desc'

    date = fields.Date(
        string='Date',
        required=True,
        default=fields.Date.context_today,
        index=True,
    )
    shift_id = fields.Many2one(
        'mrp.shift',
        string='Shift',
        required=True,
        check_company=True,
        index=True,
    )
    workcenter_id = fields.Many2one(
        'mrp.workcenter',
        string='Work Center',
        required=True,
        check_company=True,
        index=True,
    )
    date_start = fields.Datetime(
        string='Start Time',
        required=True,
    )
    date_end = fields.Datetime(
        string='End Time',
        required=True,
    )
    duration = fields.Float(
        string='Downtime',
        compute='_compute_duration',
        store=True,
        digits=(16, 2),
        help='Duration in hours.',
    )
    loss_type = fields.Selection(
        selection=[
            ('planned', 'Planned Stop'),
            ('unplanned', 'Unplanned Stop'),
        ],
        string='Category',
        compute='_compute_loss_type',
        inverse='_inverse_loss_type',
        store=True,
        readonly=False,
    )
    loss_reason_id = fields.Many2one(
        'mrp.oee.loss.reason',
        string='Downtime Reason',
        required=True,
        index=True,
        default=lambda self: self.env.ref(
            'cux_mrp_oee.loss_reason_undefined', raise_if_not_found=False
        ),
        domain="[('loss_type', '=', loss_type)]",
    )
    loss_reason_parent_id = fields.Many2one(
        'mrp.oee.loss.reason',
        string='Sub Category',
        compute='_compute_loss_reason_ids',
        inverse='_inverse_loss_reason_parent_id',
        readonly=False,
        domain="[('parent_id', '=', False), ('loss_type', '=', loss_type)]",
    )
    loss_reason_child_id = fields.Many2one(
        'mrp.oee.loss.reason',
        string='Reason',
        compute='_compute_loss_reason_ids',
        inverse='_inverse_loss_reason_child_id',
        readonly=False,
        domain="[('parent_id', '=', loss_reason_parent_id)]",
    )
    loss_reason_has_children = fields.Boolean(
        string='Has Sub Reasons',
        compute='_compute_loss_reason_ids',
    )
    loss_reason_color = fields.Integer(
        string='Reason Color',
        compute='_compute_loss_reason_color',
        help='Color index of the downtime reason used by the gantt view.',
    )
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )

    @api.depends('date_start', 'date_end', 'loss_reason_id', 'company_id.tz')
    def _compute_display_name(self):
        for record in self:
            # Stored datetimes are UTC: display them in the company (plant)
            # timezone instead of the logged-in user's one.
            tz = ZoneInfo(record.company_id.tz) if record.company_id.tz else record.env.tz
            start = record.date_start.replace(tzinfo=UTC).astimezone(tz) if record.date_start else False
            end = record.date_end.replace(tzinfo=UTC).astimezone(tz) if record.date_end else False
            record.display_name = '%s[%s-%s]' % (
                record.loss_reason_id.name or '',
                start.strftime('%H:%M') if start else '',
                end.strftime('%H:%M') if end else '',
            )

    @api.depends('date_start', 'date_end')
    def _compute_duration(self):
        for record in self:
            if record.date_start and record.date_end:
                seconds = (record.date_end - record.date_start).total_seconds()
                record.duration = round(max(seconds, 0.0) / 3600.0, 2)
            else:
                record.duration = 0.0

    @api.depends('loss_reason_id.loss_type')
    def _compute_loss_type(self):
        for record in self:
            # Only follow the reason when there is one: clearing the reason
            # (e.g. right after switching category) must not wipe the
            # category the user just picked.
            if record.loss_reason_id:
                record.loss_type = record.loss_reason_id.loss_type

    def _inverse_loss_type(self):
        """User changed the category directly → drop the reason so a new one can be picked."""
        for record in self:
            if record.loss_reason_id and record.loss_reason_id.loss_type != record.loss_type:
                record.loss_reason_id = False

    @api.onchange('loss_type')
    def _onchange_loss_type(self):
        # Inverses are not called during onchange: drop the sub category and
        # the reason (both derive from loss_reason_id) when they belong to
        # another category, otherwise they would stay selected but no longer
        # match the new one.
        for record in self:
            reason = record.loss_reason_id
            if reason and reason.loss_type != record.loss_type:
                record.loss_reason_id = False

    @api.depends('loss_reason_id.color', 'loss_reason_id.parent_id.color')
    def _compute_loss_reason_color(self):
        for record in self:
            reason = record.loss_reason_id
            # Reasons without their own color inherit the sub category color.
            record.loss_reason_color = (
                reason.color or (reason.parent_id.color if reason.parent_id else 0)
            )

    @api.depends('loss_reason_id')
    def _compute_loss_reason_ids(self):
        for record in self:
            reason = record.loss_reason_id
            parent = reason.parent_id or reason
            record.loss_reason_parent_id = parent
            record.loss_reason_child_id = reason if reason.parent_id else False
            record.loss_reason_has_children = bool(parent.child_ids)

    def _inverse_loss_reason_parent_id(self):
        for record in self:
            parent = record.loss_reason_parent_id
            current = record.loss_reason_id
            # keep the current sub reason when it still belongs to that parent
            if not (current and current.parent_id == parent):
                record.loss_reason_id = parent

    def _inverse_loss_reason_child_id(self):
        for record in self:
            child = record.loss_reason_child_id
            record.loss_reason_id = child or record.loss_reason_parent_id

    @api.onchange('loss_reason_parent_id')
    def _onchange_loss_reason_parent_id(self):
        # Non-stored computed fields with an inverse are not inverted by the
        # onchange mechanism, so keep loss_reason_id in sync here.
        for record in self:
            parent = record.loss_reason_parent_id
            current = record.loss_reason_id
            if not (current and current.parent_id == parent):
                record.loss_reason_id = parent

    @api.onchange('loss_reason_child_id')
    def _onchange_loss_reason_child_id(self):
        for record in self:
            record.loss_reason_id = record.loss_reason_child_id or record.loss_reason_parent_id

    def _float_hours_to_datetime(self, date, float_hours):
        """Build a Datetime from a Date and a float hour (e.g. 8.5 → 08:30)."""
        base = fields.Datetime.to_datetime(date)
        if not base:
            return False
        hours = int(float_hours)
        minutes = int(round((float_hours - hours) * 60))
        return base.replace(hour=hours % 24, minute=minutes, second=0, microsecond=0)

    @api.onchange('workcenter_id')
    def _onchange_workcenter_id(self):
        for record in self:
            if record.workcenter_id:
                record.company_id = record.workcenter_id.company_id
