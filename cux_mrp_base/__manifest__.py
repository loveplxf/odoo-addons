# -*- coding: utf-8 -*-
{
    'name': "MRP Base Extension",
    'summary': "生产线/工厂/车间多级父子结构管理",
    'description': """
MRP Base Extension
==================

在制造模块中增加"生产线"基础数据模型，支持多级父子结构：
- 工厂 (factory)
- 车间 (shop_floor)
- 产线 (production_line)
    """,
    'version': '20.0.1.0.0',
    'depends': ['mrp'],
    'installable': True,
    'application': False,
    'auto_install': False,
    'author': 'Hubin',
    'category': 'Supply Chain/Manufacturing',
    'license': 'LGPL-3',
    'data': [
        'security/ir.model.access.csv',
        'views/mrp_production_line_views.xml',
        'views/mrp_workcenter_views.xml',
        'views/menu.xml',
    ],
}
