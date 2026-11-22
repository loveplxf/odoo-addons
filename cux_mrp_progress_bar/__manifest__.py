# -*- coding: utf-8 -*-
{
    'name': "MRP Progress Bar",
    'summary': "Show the manufacturing order progress as a progress bar",
    'description': """
Manufacturing Order Progress Bar
================================

Adds a progress bar on the manufacturing order form, at the order level.

The bar compares the produced quantity with the quantity to produce::

    progress = quantity produced / quantity to produce

The value is displayed next to the bar (for instance ``8 / 12``) and the bar
fills up as the finished moves of the order are validated.
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
        'views/mrp_production_views.xml',
        'views/mrp_workorder_views.xml',
    ],
    'assets': {
        'web.assets_backend': [
            'cux_mrp_progress_bar/static/src/**/*',
        ],
    },
}
