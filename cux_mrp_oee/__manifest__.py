{
    'name': 'OEE - Equipment Effectiveness',
    'version': '20.0.1.8.0',
    'summary': 'Overall Equipment Effectiveness for work centers',
    'description': """
OEE - Overall Equipment Effectiveness
=====================================

Compute the equipment effectiveness of work centers as:

    OEE = Availability x Performance x Quality

with dedicated menus:

- Overview: work center OEE kanban
- Operations: downtime records and production reports
- Reporting: OEE snapshots, downtime analysis, reject analysis
- Configuration: shifts, downtime reasons, reject reasons, theoretical cycles
    """,
    'category': 'Manufacturing/Manufacturing',
    'author': 'Custom',
    'license': 'LGPL-3',
    'depends': ['mrp', 'cux_mrp_base'],
    'data': [
        'security/ir.access.csv',
        'data/mrp_oee_loss_reason_data.xml',
        'data/mrp_oee_cron.xml',
        'wizard/mrp_oee_snapshot_wizard_views.xml',
        'views/mrp_workcenter_oee_views.xml',
        'views/mrp_oee_productivity_views.xml',
        'views/mrp_oee_production_views.xml',
        'views/mrp_oee_snapshot_views.xml',
        'views/mrp_oee_reports_views.xml',
        'views/mrp_oee_config_views.xml',
        'views/mrp_oee_menu.xml',
    ],
    'installable': True,
    'application': True,
}
