{
    'name': '预览Many2Many字段中的附件',
    'version': '1.0',
    'category': 'Tools',
    'summary': '预览Many2Many字段中的附件',
    'author': 'Hubin',
    'website': 'https://www.faway.com',
    'description': """
        This module adds a preview functionality for all Many2Many fields
        using the 'Many2Many' widget in Odoo 17.
    """,

    'depends': ['base', 'web'],

    'assets': {
        'web.assets_backend': [
            'ps_m2m_field_attachment_preview/static/src/js/m2m_field_preview.js',
            'ps_m2m_field_attachment_preview/static/src/xml/m2m_field_preview_template.xml',
        ],
    },

    'installable': True,
    'auto_install': False,
    'application': False,
    'license': 'LGPL-3',
}
