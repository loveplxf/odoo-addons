from unittest.mock import patch

from odoo.exceptions import ValidationError
from odoo.tests import tagged
from odoo.tests.common import TransactionCase, new_test_user

from odoo.addons.dcs_backend_theme.models.res_users_settings import MAX_BOOKMARKS

THEME_FIELDS = [
    "cbt_theme_mode", "cbt_palette", "cbt_primary_color", "cbt_nav_mode", "cbt_sidebar_mode",
    "cbt_sidebar_locked", "cbt_sidebar_position", "cbt_sidebar_style", "cbt_font_family",
    "cbt_font_size", "cbt_radius", "cbt_density", "cbt_chatter_position", "cbt_drawer_style",
    "cbt_icon_style", "cbt_animation", "cbt_split_view", "cbt_favorite_apps", "cbt_bookmarks",
]


@tagged("post_install", "-at_install")
class TestThemePreferences(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.user_a = new_test_user(cls.env, login="cbt_user_a", groups="base.group_user")
        cls.user_b = new_test_user(cls.env, login="cbt_user_b", groups="base.group_user")
        cls.Settings = cls.env["res.users.settings"]

    def _settings(self, user):
        return self.Settings.with_user(user)._find_or_create_for_user(user).with_user(user)

    def test_defaults_shipped_in_session_payload(self):
        """All theme fields are part of the formatted settings sent with session_info."""
        data = self._settings(self.user_a)._res_users_settings_format()
        for fname in THEME_FIELDS:
            self.assertIn(fname, data)
        self.assertEqual(data["cbt_theme_mode"], "light")
        self.assertEqual(data["cbt_nav_mode"], "vertical")
        # empty JSON lists may be stored as NULL; the client treats both alike
        self.assertFalse(data["cbt_bookmarks"])
        self.assertFalse(data["cbt_favorite_apps"])

    def test_user_can_update_own_preferences_via_standard_rpc(self):
        settings = self._settings(self.user_a)
        result = settings.set_res_users_settings({
            "cbt_theme_mode": "dark",
            "cbt_palette": "custom",
            "cbt_primary_color": "#123abc",
            "cbt_split_view": True,
            "not_a_field": "ignored",
        })
        self.assertEqual(result["cbt_theme_mode"], "dark")
        self.assertEqual(settings.cbt_primary_color, "#123abc")
        self.assertTrue(settings.cbt_split_view)
        self.assertNotIn("not_a_field", result)

    def test_preferences_are_isolated_per_user(self):
        self._settings(self.user_a).set_res_users_settings({"cbt_density": "compact"})
        self.assertEqual(self._settings(self.user_b).cbt_density, "comfortable")
        # record rule: a user cannot read another user's settings
        other = self.Settings.sudo()._find_or_create_for_user(self.user_a)
        self.assertFalse(self.Settings.with_user(self.user_b).search([("id", "=", other.id)]))

    def test_invalid_values_are_rejected(self):
        settings = self._settings(self.user_a)
        with self.assertRaises(ValidationError):
            settings.write({"cbt_primary_color": "red; background:url(x)"})
        with self.assertRaises(ValueError):
            settings.write({"cbt_nav_mode": "sideways"})

    def test_bookmark_validation(self):
        settings = self._settings(self.user_a)
        good = [
            {"id": "bm_1", "type": "menu", "label": "Leads", "menuId": 4, "appId": 1},
            {"id": "bm_2", "type": "record", "label": "Acme", "resModel": "res.partner", "resId": 7},
            {"id": "bm_3", "type": "action", "label": "Report", "actionId": 9, "viewType": "pivot"},
        ]
        settings.write({"cbt_bookmarks": good})
        self.assertEqual(settings.cbt_bookmarks, good)

        bad_payloads = [
            {"cbt_bookmarks": {"not": "a list"}},
            {"cbt_bookmarks": [{"id": "x", "type": "script", "label": "x"}]},
            {"cbt_bookmarks": [{"id": "x", "type": "menu", "label": "x", "menuId": "4"}]},
            {"cbt_bookmarks": [{"id": "x", "type": "menu", "label": "x", "evil": 1}]},
            {"cbt_bookmarks": [{"id": f"b{i}", "type": "menu", "label": "x"} for i in range(MAX_BOOKMARKS + 1)]},
            {"cbt_favorite_apps": ["crm.menu"] * 61},
            {"cbt_favorite_apps": [1, 2]},
        ]
        for payload in bad_payloads:
            with self.subTest(payload=str(payload)[:60]), self.assertRaises(ValidationError):
                settings.write(payload)


@tagged("post_install", "-at_install")
class TestColorScheme(TransactionCase):
    """ir.http.color_scheme() picks the light or dark compiled bundle."""

    def _scheme(self, user, cookie=None):
        IrHttp = self.env["ir.http"].with_user(user)

        class FakeRequest:
            class session:
                uid = user.id

            class httprequest:
                cookies = {"color_scheme": cookie} if cookie else {}

        with patch("odoo.addons.dcs_backend_theme.models.ir_http.request", FakeRequest):
            return IrHttp.color_scheme()

    def test_color_scheme(self):
        user = new_test_user(self.env, login="cbt_scheme", groups="base.group_user")
        settings = self.env["res.users.settings"]._find_or_create_for_user(user)
        self.assertEqual(self._scheme(user), "light")
        settings.cbt_theme_mode = "dark"
        self.assertEqual(self._scheme(user), "dark")
        settings.cbt_theme_mode = "system"
        self.assertEqual(self._scheme(user), "light")
        self.assertEqual(self._scheme(user, cookie="dark"), "dark")
        settings.cbt_theme_mode = "light"
        self.assertEqual(self._scheme(user, cookie="dark"), "light")

    def test_portal_users_are_untouched(self):
        portal = new_test_user(self.env, login="cbt_portal", groups="base.group_portal")
        self.assertEqual(self._scheme(portal, cookie="dark"), "light")
