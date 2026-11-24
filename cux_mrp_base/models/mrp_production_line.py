# -*- coding: utf-8 -*-
from odoo import api, fields, models, _


class MrpProductionLine(models.Model):
    _name = "mrp.production.line"
    _description = "Production Line"
    _inherit = ['mail.thread', 'mail.activity.mixin']
    _order = "parent_path"
    _parent_name = "parent_id"
    _parent_store = True
    _rec_name = 'complete_name'

    name = fields.Char(
        string='名称',
        required=True,
        tracking=True,
    )
    code = fields.Char(
        string='编码',
        copy=False,
    )
    complete_name = fields.Char(
        string='全名',
        compute='_compute_complete_name',
        recursive=True,
        store=True,
    )
    type = fields.Selection([
        ('factory', '工厂'),
        ('shop_floor', '车间'),
        ('production_line', '产线'),
    ], string='类型', required=True, default='production_line', tracking=True)

    # 父子关系
    parent_id = fields.Many2one(
        'mrp.production.line',
        string='上级',
        index=True,
        ondelete='cascade',
        tracking=True,
        help='上级生产线/车间/工厂',
    )
    parent_path = fields.Char(
        index=True,
        unaccent=False,
    )
    child_ids = fields.One2many(
        'mrp.production.line',
        'parent_id',
        string='下级',
    )
    child_count = fields.Integer(
        string='下级数量',
        compute='_compute_child_count',
    )
    parent_type = fields.Selection(
        [
            ('factory', '工厂'),
            ('shop_floor', '车间'),
            ('production_line', '产线'),
        ],
        related='parent_id.type',
        string='上级类型',
        store=True,
    )

    # 关联工作中心
    workcenter_ids = fields.One2many(
        'mrp.workcenter',
        'production_line_id',
        string='工作中心',
    )
    workcenter_count = fields.Integer(
        string='工作中心数',
        compute='_compute_workcenter_count',
    )

    # 其他字段
    description = fields.Text(string='描述')
    active = fields.Boolean(string='启用', default=True)
    company_id = fields.Many2one(
        'res.company',
        string='公司',
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
        """根据类型自动限制 parent_id 的可选项"""
        self.parent_id = False

    @api.constrains('parent_id')
    def _check_parent_id(self):
        if not self._check_recursion():
            raise models.ValidationError(_('不允许循环引用父级。'))

    @api.constrains('type', 'parent_id')
    def _check_type_parent_consistency(self):
        """校验父子类型的一致性：
        - factory 的 parent_id 必须为空
        - shop_floor 的 parent_id 必须是 factory
        - production_line 的 parent_id 必须是 shop_floor
        """
        for record in self:
            if record.type == 'factory' and record.parent_id:
                raise models.ValidationError(_('工厂不能有上级。'))
            if record.type == 'shop_floor' and record.parent_id and record.parent_id.type != 'factory':
                raise models.ValidationError(_('车间的上级必须是工厂。'))
            if record.type == 'production_line' and record.parent_id:
                if record.parent_id.type != 'shop_floor':
                    raise models.ValidationError(_('产线的上级必须是车间。'))

    def action_view_children(self):
        """查看下级记录"""
        self.ensure_one()
        return {
            'name': _('下级'),
            'type': 'ir.actions.act_window',
            'res_model': 'mrp.production.line',
            'view_mode': 'list,form',
            'domain': [('parent_id', '=', self.id)],
            'context': {'default_parent_id': self.id},
        }

    def action_view_workcenters(self):
        """查看关联的工作中心"""
        self.ensure_one()
        return {
            'name': _('工作中心'),
            'type': 'ir.actions.act_window',
            'res_model': 'mrp.workcenter',
            'view_mode': 'list,form',
            'domain': [('production_line_id', '=', self.id)],
            'context': {'default_production_line_id': self.id},
        }

    def toggle_active(self):
        """切换启用/禁用状态"""
        for record in self:
            record.active = not record.active
        return True
