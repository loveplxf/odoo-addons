"""Company-wide (database-wide) theme configuration: the login page.

Values live in ``ir.config_parameter`` under the ``dcs_backend_theme.``
prefix, images in public ``ir.attachment`` records linked to this model.
Nothing is created until an administrator saves the login settings, and the
uninstall hook removes all of it.
"""
import base64
import binascii
import re

from odoo import api, models
from odoo.exceptions import AccessError, ValidationError

PREFIX = "dcs_backend_theme.login_"
HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{6}$")
IMAGE_MIMETYPES = {"image/png", "image/jpeg", "image/webp", "image/svg+xml", "image/gif"}
MAX_IMAGE_SIZE = 4 * 1024 * 1024

LOGIN_DEFAULTS = {
    "layout": "split",
    "brand_name": "",
    "title": "",
    "subtitle": "",
    "footer_text": "",
    "primary_color": "#4f46e5",
    "background_style": "gradient",
    "background_color": "#1e1b4b",
    "show_powered_by": "1",
    "show_nav_brand": "1",
    "system_name": "",
    "logo_attachment_id": "",
    "background_attachment_id": "",
}
LOGIN_CHOICES = {
    "layout": {"minimal", "corporate", "split", "illustration"},
    "background_style": {"plain", "gradient", "image"},
}
TEXT_LIMITS = {"brand_name": 80, "system_name": 80, "title": 120, "subtitle": 300, "footer_text": 200}


class CbtThemeConfig(models.AbstractModel):
    _name = "cbt.theme.config"
    _description = "Backend Theme Configuration"

    # ------------------------------------------------------------------
    # Read
    # ------------------------------------------------------------------
    @api.model
    def _get_raw_login_settings(self):
        icp = self.env["ir.config_parameter"].sudo()
        return {key: icp.get_str(PREFIX + key, default) for key, default in LOGIN_DEFAULTS.items()}

    @api.model
    def get_login_values(self):
        """Values used by the login templates (rendered for anonymous users,
        hence ``sudo``; only display data is exposed)."""
        raw = self._get_raw_login_settings()
        company = self.env.company.sudo()
        values = {
            "layout": raw["layout"] if raw["layout"] in LOGIN_CHOICES["layout"] else "split",
            "brand_name": raw["brand_name"] or company.name or "",
            "title": raw["title"],
            "subtitle": raw["subtitle"],
            "footer_text": raw["footer_text"],
            "primary_color": raw["primary_color"] if HEX_COLOR.match(raw["primary_color"] or "") else "#4f46e5",
            "background_style": raw["background_style"],
            "background_color": raw["background_color"] if HEX_COLOR.match(raw["background_color"] or "") else "#1e1b4b",
            "show_powered_by": raw["show_powered_by"] == "1",
            "logo_url": self._attachment_url(raw["logo_attachment_id"]),
            "background_url": self._attachment_url(raw["background_attachment_id"]),
        }
        return values

    @api.model
    def get_nav_brand(self):
        """Brand mark for the backend top-left corner (shipped in session_info).

        Unlike ``get_login_values``, the name/logo are returned raw: the web
        client falls back to the *active* company name and logo."""
        raw = self._get_raw_login_settings()
        return {
            "show": raw["show_nav_brand"] == "1",
            "name": raw["system_name"],
            "logo": self._attachment_url(raw["logo_attachment_id"]),
        }

    @api.model
    def _attachment_url(self, attachment_id):
        if not attachment_id or not str(attachment_id).isdigit():
            return False
        attachment = self.env["ir.attachment"].sudo().browse(int(attachment_id)).exists()
        if not attachment or not attachment.public:
            return False
        return f"/web/image/{attachment.id}?unique={attachment.checksum or ''}"

    @api.model
    def get_login_settings(self):
        self._check_admin()
        raw = self._get_raw_login_settings()
        values = self.get_login_values()
        raw["show_powered_by"] = raw["show_powered_by"] == "1"
        raw["show_nav_brand"] = raw["show_nav_brand"] == "1"
        raw["logo_url"] = values["logo_url"]
        raw["background_url"] = values["background_url"]
        return raw

    # ------------------------------------------------------------------
    # Write
    # ------------------------------------------------------------------
    @api.model
    def set_login_settings(self, values):
        """Save login settings. ``values`` may contain ``logo`` /
        ``background`` dicts ``{"data": <base64>, "mimetype": str, "name": str}``
        or ``False`` to remove the image."""
        self._check_admin()
        if not isinstance(values, dict):
            raise ValidationError(self.env._("Invalid settings."))
        icp = self.env["ir.config_parameter"].sudo()
        for key, value in values.items():
            if key in ("logo", "background"):
                self._set_image(key, value)
                continue
            if key not in LOGIN_DEFAULTS or key.endswith("attachment_id"):
                continue
            if key in LOGIN_CHOICES and value not in LOGIN_CHOICES[key]:
                raise ValidationError(self.env._("Invalid value for %s.", key))
            if key in ("primary_color", "background_color") and not HEX_COLOR.match(value or ""):
                raise ValidationError(self.env._("Colors must be #RRGGBB hex values."))
            if key in ("show_powered_by", "show_nav_brand"):
                value = "1" if value else "0"
            if key in TEXT_LIMITS:
                value = (value or "")[: TEXT_LIMITS[key]]
            icp.set_str(PREFIX + key, value)
        return self.get_login_settings()

    @api.model
    def _set_image(self, kind, payload):
        icp = self.env["ir.config_parameter"].sudo()
        param = PREFIX + f"{kind}_attachment_id"
        old_id = icp.get_str(param)
        Attachment = self.env["ir.attachment"].sudo()
        if old_id and old_id.isdigit():
            Attachment.browse(int(old_id)).exists().unlink()
        if not payload:
            icp.set_str(param, "")
            return
        mimetype = payload.get("mimetype")
        if mimetype not in IMAGE_MIMETYPES:
            raise ValidationError(self.env._("Unsupported image type."))
        try:
            raw = base64.b64decode(payload.get("data") or "", validate=True)
        except (binascii.Error, ValueError):
            raise ValidationError(self.env._("The image could not be read."))
        if not raw or len(raw) > MAX_IMAGE_SIZE:
            raise ValidationError(self.env._("Images must be smaller than 4 MB."))
        attachment = Attachment.create({
            "name": (payload.get("name") or f"login_{kind}")[:120],
            "raw": raw,
            "mimetype": mimetype,
            "public": True,
            "res_model": self._name,
            "res_id": 0,
        })
        icp.set_str(param, str(attachment.id))

    @api.model
    def _check_admin(self):
        if not self.env.user.has_group("base.group_system"):
            raise AccessError(self.env._("Only administrators can change the login page."))
