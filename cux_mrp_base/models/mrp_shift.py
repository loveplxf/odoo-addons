# -*- coding: utf-8 -*-
import math

from odoo import _, api, fields, models
from odoo.tools.float_utils import float_round


def float_to_time_string(hours):
    """ Convert a number of hours into a ``HH:MM`` string. """
    fractional, integral = math.modf(hours)
    return '%02d:%02d' % (int(integral), int(float_round(60 * fractional, precision_digits=0)))


class MrpShift(models.Model):
    _name = 'mrp.shift'
    _description = 'Shift'
    _order = 'sequence, name'

    name = fields.Char(string='Name', required=True)
    sequence = fields.Integer(string='Sequence', default=10)
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        default=lambda self: self.env.company,
    )
    work_hours = fields.Float(
        string='Work Hours',
        compute='_compute_work_hours',
        store=True,
        digits=(2, 2),
    )
    break_hours = fields.Float(
        string='Break Hours',
        compute='_compute_break_hours',
        store=True,
        digits=(2, 2),
    )
    worktime_ids = fields.One2many(
        'mrp.shift.worktime',
        'shift_id',
        string='Work Times',
        copy=True,
    )
    hour_from = fields.Float(compute='_compute_hour_from_to', store=True)
    hour_to = fields.Float(compute='_compute_hour_from_to', store=True)

    @api.depends('worktime_ids.next_day', 'worktime_ids.hour_from', 'worktime_ids.hour_to')
    def _compute_hour_from_to(self):
        for shift in self:
            # Do not rely on the comodel order when the records are not yet
            # saved: sort explicitly by (next day, start hour).
            worktimes = shift.worktime_ids.sorted(lambda rec: (rec.next_day, rec.hour_from))
            shift.hour_from = worktimes[0].hour_from if worktimes else 0.0
            shift.hour_to = worktimes[-1].hour_to if worktimes else 0.0

    @api.depends('worktime_ids.hour_from', 'worktime_ids.hour_to', 'worktime_ids.day_period')
    def _compute_work_hours(self):
        for shift in self:
            attendances = shift.worktime_ids.filtered(lambda rec: rec.day_period != 'break')
            shift.work_hours = float_round(
                sum(attendance.hour_to - attendance.hour_from for attendance in attendances),
                precision_digits=2,
            )

    @api.depends('worktime_ids.hour_from', 'worktime_ids.hour_to', 'worktime_ids.day_period')
    def _compute_break_hours(self):
        for shift in self:
            breaks = shift.worktime_ids.filtered(lambda rec: rec.day_period == 'break')
            shift.break_hours = float_round(
                sum(worktime.hour_to - worktime.hour_from for worktime in breaks),
                precision_digits=2,
            )

    @api.depends('name', 'hour_from', 'hour_to')
    def _compute_display_name(self):
        super()._compute_display_name()
        for shift in self:
            shift.display_name = '%s [%s-%s]' % (
                shift.name or '',
                float_to_time_string(shift.hour_from),
                float_to_time_string(shift.hour_to),
            )

    def copy(self, default=None):
        self.ensure_one()
        default = dict(default or {})
        if not default.get('name'):
            default['name'] = _('%s (copy)', self.name)
        return super().copy(default)


class MrpShiftWorktime(models.Model):
    _name = 'mrp.shift.worktime'
    _description = 'Shift Worktime'
    _order = 'next_day, hour_from'

    name = fields.Char(string='Name', required=True)
    shift_id = fields.Many2one(
        'mrp.shift',
        string='Shift',
        required=True,
        ondelete='cascade',
    )
    next_day = fields.Boolean(
        string='Next Day',
        help='Check if the shift crosses midnight',
    )
    hour_from = fields.Float(
        string='Work Start',
        required=True,
        index=True,
        help='Format is hh:mm, 24:00 is interpreted as 23:59:59.999999.',
    )
    hour_to = fields.Float(
        string='Work End',
        required=True,
        help='Format is hh:mm, 24:00 is interpreted as 23:59:59.999999.',
    )
    day_period = fields.Selection([
        ('morning', 'Morning'),
        ('afternoon', 'Afternoon'),
        ('evening', 'Evening'),
        ('break', 'Break'),
    ], string='Day Period', required=True, default='morning')

    @api.onchange('hour_from', 'hour_to')
    def _onchange_hours(self):
        # avoid negative or after midnight
        self.hour_from = min(max(self.hour_from, 0.0), 24.0)
        self.hour_to = min(max(self.hour_to, 0.0), 24.0)

        # avoid wrong order
        self.hour_to = max(self.hour_to, self.hour_from)
