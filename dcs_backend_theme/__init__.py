from . import models

CONFIG_PREFIX = "dcs_backend_theme."


def post_init_hook(env):
    """Clear the cached menus/session of open browsers is not possible from the
    server, but we make sure every existing user has a settings record so the
    theme preferences ship with the very first session_info."""
    users = env["res.users"].with_context(active_test=False).search([("share", "=", False)])
    settings_model = env["res.users.settings"].sudo()
    for user in users:
        settings_model._find_or_create_for_user(user)


def uninstall_hook(env):
    """Remove everything this module stored outside its own fields.

    Fields added on ``res.users.settings`` are dropped by the ORM. Here we
    remove the login-page configuration parameters and uploaded images so the
    database is left exactly as before installation.
    """
    params = env["ir.config_parameter"].sudo().search([("key", "=like", CONFIG_PREFIX + "%")])
    params.unlink()
    attachments = env["ir.attachment"].sudo().search([
        ("res_model", "=", "cbt.theme.config"),
    ])
    attachments.unlink()
