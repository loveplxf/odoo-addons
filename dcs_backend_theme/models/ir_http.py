from odoo import models
from odoo.http import request


class IrHttp(models.AbstractModel):
    _inherit = "ir.http"

    def session_info(self):
        """Ship the global brand mark (top-left logo and name) with the page,
        so the web client needs no extra RPC at start-up."""
        info = super().session_info()
        user = self.env.user
        if user and not user._is_public() and user._is_internal():
            info["cbt_brand"] = self.env["cbt.theme.config"].sudo().get_nav_brand()
        return info

    def color_scheme(self):
        """Select the light or dark asset bundle for the web client.

        Odoo 19 Community renders ``web.assets_web_dark`` when this returns
        ``"dark"``. This module compiles its dark variables into that bundle,
        so dark mode is a real recompiled theme (no CSS filter).

        * ``light`` / ``dark``: the user's explicit choice.
        * ``system``: the browser cannot tell the server its OS preference on
          the very first request, so the client stores the resolved value in
          the ``color_scheme`` cookie (the cookie Odoo itself reads for lazy
          bundles and chart colors) and reloads once if needed.
        """
        scheme = super().color_scheme()
        if not request or not request.session.uid:
            return scheme
        user = self.env.user
        if user._is_public() or not user._is_internal():
            return scheme
        settings = user.sudo().res_users_settings_id
        mode = settings.cbt_theme_mode if settings else "light"
        if mode == "dark":
            return "dark"
        if mode == "system":
            return "dark" if request.httprequest.cookies.get("color_scheme") == "dark" else "light"
        return "light"
