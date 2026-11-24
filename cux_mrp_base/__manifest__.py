# -*- coding: utf-8 -*-
{
    'name': "MRP Base Extension",
    'summary': "Multi-level Production Line / Factory / Shop Floor hierarchy",
    'description': """
MRP Base Extension
==================

Adds a "Production Line" master data model to the Manufacturing app,
supporting a multi-level parent-child hierarchy:

- Factory (level 1, top)
- Shop Floor (level 2)
- Production Line (level 3)
    """,
    'version': '20.0.1.2.0',
    'depends': ['mrp', 'hr'],
    'installable': True,
    'application': False,
    'auto_install': False,
    'author': 'Hubin',
    'category': 'Supply Chain/Manufacturing',
    'license': 'LGPL-3',
    'data': [
        'security/ir.access.csv',
        'views/mrp_production_line_views.xml',
        'views/mrp_team_views.xml',
        'views/mrp_shift_views.xml',
        'views/mrp_workcenter_views.xml',
        'views/menu.xml',
    ],
    'assets': {},
}
