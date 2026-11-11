# -*- coding: utf-8 -*-
{
    'name': "Multi Tabs",
    'description': """
        Multi Tabs in Odoo 20.0
    """,
    'version': '0.1',
    'depends': ['base','web'],
    "installable": True,
    "auto_install": False,
    'author': 'Hubin',
    'category': 'Services',
    "assets": {
        "web.assets_backend": [
           "cux_multi_tabs/static/src/**/*",
        ],
    },
    "images": [
        'static/description/image.jpg'
    ],
    'license': 'LGPL-3'
            
}
