# -*- coding: utf-8 -*-
from datetime import timedelta

from odoo import api, fields, models


class MrpOeeSnapshot(models.Model):
    _name = 'mrp.oee.snapshot'
    _description = 'OEE Snapshot'
    _order = 'date desc, workcenter_id, shift_id'
    _rec_name = 'display_name'

    display_name = fields.Char(compute='_compute_display_name')
    date = fields.Date(string='Date', required=True, index=True)
    shift_id = fields.Many2one(
        'mrp.shift',
        string='Shift',
        required=True,
        ondelete='cascade',
        check_company=True,
        index=True,
    )
    workcenter_id = fields.Many2one(
        'mrp.workcenter',
        string='Work Center',
        required=True,
        ondelete='cascade',
        check_company=True,
        index=True,
    )
    company_id = fields.Many2one(
        'res.company',
        string='Company',
        required=True,
        default=lambda self: self.env.company,
        index=True,
    )

    shift_minutes = fields.Float(string='Shift Time (min)', digits=(16, 2))
    planned_minutes = fields.Float(string='Planned Production (min)', digits=(16, 2))
    planned_stop_minutes = fields.Float(string='Planned Stops (min)', digits=(16, 2))
    unplanned_minutes = fields.Float(string='Unplanned Downtime (min)', digits=(16, 2))
    run_minutes = fields.Float(string='Run Time (min)', digits=(16, 2))
    ideal_minutes = fields.Float(string='Ideal Time (min)', digits=(16, 2))

    total_qty = fields.Float(string='Total Quantity', digits=(16, 2))
    good_qty = fields.Float(string='Good Quantity', digits=(16, 2))
    reject_qty = fields.Float(string='Rejected Quantity', digits=(16, 2))

    availability = fields.Float(string='Availability (%)', digits=(5, 2))
    performance = fields.Float(string='Performance (%)', digits=(5, 2))
    quality = fields.Float(string='Quality (%)', digits=(5, 2))
    oee = fields.Float(string='OEE (%)', digits=(5, 2))

    state = fields.Selection(
        selection=[
            ('idle', 'Idle'),
            ('below', 'Below Target'),
            ('on_target', 'On Target'),
        ],
        string='Status',
        compute='_compute_state',
        store=True,
    )

    _uniq_snapshot = models.Constraint(
        'unique(date, shift_id, workcenter_id)',
        'An OEE snapshot already exists for this date, shift and work center.',
    )

    @api.depends('date', 'shift_id', 'workcenter_id')
    def _compute_display_name(self):
        for snapshot in self:
            snapshot.display_name = '%s - %s - %s' % (
                snapshot.workcenter_id.name or '',
                snapshot.shift_id.name or '',
                snapshot.date or '',
            )

    @api.depends('oee', 'planned_minutes', 'workcenter_id.oee_target')
    def _compute_state(self):
        for snapshot in self:
            if snapshot.planned_minutes <= 0:
                snapshot.state = 'idle'
            elif snapshot.oee >= (snapshot.workcenter_id.oee_target or 90.0):
                snapshot.state = 'on_target'
            else:
                snapshot.state = 'below'

    @api.model
    def _shift_window_minutes(self, shift):
        start = shift.hour_from or 0.0
        end = shift.hour_to or 0.0
        if end <= start:
            end += 24.0
        return (end - start) * 60.0

    @api.model
    def _kpi(self, planned, run, ideal, total, good):
        availability = run / planned * 100.0 if planned > 0 else 0.0
        if run <= 0:
            performance = 0.0
        elif ideal <= 0:
            # No theoretical cycle: assume full performance but keep a visible gap
            # through the missing ideal time.
            performance = 100.0 if total > 0 else 0.0
        else:
            performance = min(ideal / run * 100.0, 100.0)
        quality = good / total * 100.0 if total > 0 else 100.0
        oee = availability * performance * quality / 10000.0
        return {
            'availability': round(availability, 2),
            'performance': round(performance, 2),
            'quality': round(quality, 2),
            'oee': round(oee, 2),
        }

    @api.model
    def _prepare_values(self, day, shift, workcenter):
        window = self._shift_window_minutes(shift)
        if window <= 0:
            return {}

        records = self.env['mrp.oee.productivity'].search([
            ('date', '=', day),
            ('shift_id', '=', shift.id),
            ('workcenter_id', '=', workcenter.id),
        ])
        planned_stop = sum(records.filtered(
            lambda r: r.loss_reason_id.loss_type == 'planned').mapped('duration'))
        unplanned = sum(records.filtered(
            lambda r: r.loss_reason_id.loss_type == 'unplanned').mapped('duration'))

        base_minutes = (shift.work_hours or 0.0) * 60.0
        if base_minutes <= 0:
            base_minutes = max(window - (shift.break_hours or 0.0) * 60.0, 0.0)
        planned = max(base_minutes - planned_stop * 60.0, 0.0)
        run = max(planned - unplanned * 60.0, 0.0)

        productions = self.env['mrp.oee.production'].search([
            ('date', '=', day),
            ('shift_id', '=', shift.id),
            ('workcenter_id', '=', workcenter.id),
        ])
        if not records and not productions:
            # Nothing happened during this shift: do not clutter the overview
            # with empty snapshots.
            return {}
        cycle_map = {}
        operations = self.env['mrp.routing.workcenter'].search([
            ('workcenter_id', '=', workcenter.id),
        ])
        for operation in operations:
            template = operation.bom_id.product_tmpl_id
            if template and template.id not in cycle_map:
                cycle_map[template.id] = operation.time_cycle_manual or 0.0

        total_qty = sum(productions.mapped('qty'))
        good_qty = sum(productions.filtered(
            lambda p: p.report_type == 'good').mapped('qty'))
        ideal = sum(
            production.qty * cycle_map.get(production.product_id.product_tmpl_id.id, 0.0)
            for production in productions
        )

        values = {
            'date': day,
            'shift_id': shift.id,
            'workcenter_id': workcenter.id,
            'company_id': workcenter.company_id.id,
            'shift_minutes': round(window, 2),
            'planned_minutes': round(planned, 2),
            'planned_stop_minutes': round(planned_stop * 60.0, 2),
            'unplanned_minutes': round(unplanned * 60.0, 2),
            'run_minutes': round(run, 2),
            'ideal_minutes': round(ideal, 2),
            'total_qty': round(total_qty, 2),
            'good_qty': round(good_qty, 2),
            'reject_qty': round(total_qty - good_qty, 2),
        }
        values.update(self._kpi(planned, run, ideal, total_qty, good_qty))
        return values

    @api.model
    def _aggregate_values(self, values_list):
        totals = {
            'shift_minutes': 0.0,
            'planned_minutes': 0.0,
            'planned_stop_minutes': 0.0,
            'unplanned_minutes': 0.0,
            'run_minutes': 0.0,
            'ideal_minutes': 0.0,
            'total_qty': 0.0,
            'good_qty': 0.0,
            'reject_qty': 0.0,
        }
        for values in values_list:
            for key in totals:
                totals[key] += values.get(key, 0.0)
        totals.update(self._kpi(
            totals['planned_minutes'],
            totals['run_minutes'],
            totals['ideal_minutes'],
            totals['total_qty'],
            totals['good_qty'],
        ))
        return totals

    @api.model
    def _generate(self, date_from, date_to, workcenters=None, shifts=None):
        workcenters = workcenters or self.env['mrp.workcenter'].search([])
        shifts = shifts or self.env['mrp.shift'].search([])
        count = 0
        day = date_from
        while day <= date_to:
            for workcenter in workcenters:
                workcenter_shifts = shifts.filtered(
                    lambda s: not s.company_id or s.company_id == workcenter.company_id)
                for shift in workcenter_shifts:
                    values = self._prepare_values(day, shift, workcenter)
                    existing = self.search([
                        ('date', '=', day),
                        ('shift_id', '=', shift.id),
                        ('workcenter_id', '=', workcenter.id),
                    ], limit=1)
                    if not values:
                        # Keep stale snapshots in sync with their source records.
                        existing.unlink()
                        continue
                    if existing:
                        existing.write(values)
                    else:
                        self.create(values)
                    count += 1
            day += timedelta(days=1)
        return count

    @api.model
    def _cron_generate(self):
        today = fields.Date.context_today(self)
        self._generate(today - timedelta(days=1), today)
