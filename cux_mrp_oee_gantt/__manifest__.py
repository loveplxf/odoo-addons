{
    'name': 'OEE - Downtime Gantt',
    'version': '20.0.1.0.0',
    'summary': 'Gantt view for OEE downtime records',
    'description': """
OEE - Downtime Gantt
====================

Adds the gantt view of downtime records (``mrp.oee.productivity``).

The gantt view comes from ``web_gantt``, which is an Enterprise feature,
so it is kept in a separate module that is only installed on Enterprise.
    """,
    'category': 'Manufacturing/Manufacturing',
    'author': 'Custom',
    'license': 'LGPL-3',
    'depends': ['cux_mrp_oee', 'web_gantt'],
    'data': [
        'views/mrp_oee_productivity_gantt_views.xml',
    ],
    'installable': True,
    'application': False,
}
