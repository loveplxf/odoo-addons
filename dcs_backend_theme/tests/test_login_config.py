import base64

from odoo.exceptions import AccessError, ValidationError
from odoo.tests import tagged
from odoo.tests.common import HttpCase, TransactionCase, new_test_user

# 1x1 transparent PNG
PNG = base64.b64encode(bytes.fromhex(
    "89504e470d0a1a0a0000000d4948445200000001000000010806000000"
    "1f15c4890000000d49444154789c6300010000000500010d0a2db40000000049454e44ae426082"
)).decode()


@tagged("post_install", "-at_install")
class TestLoginConfig(TransactionCase):

    @classmethod
    def setUpClass(cls):
        super().setUpClass()
        cls.admin = new_test_user(cls.env, login="cbt_admin", groups="base.group_user,base.group_system")
        cls.employee = new_test_user(cls.env, login="cbt_employee", groups="base.group_user")
        cls.Config = cls.env["cbt.theme.config"]

    def test_defaults(self):
        values = self.Config.get_login_values()
        self.assertEqual(values["layout"], "split")
        self.assertEqual(values["brand_name"], self.env.company.name)
        self.assertTrue(values["show_powered_by"])
        self.assertFalse(values["logo_url"])

    def test_admin_can_configure(self):
        config = self.Config.with_user(self.admin)
        config.set_login_settings({
            "layout": "corporate",
            "brand_name": "Acme",
            "title": "Hello",
            "primary_color": "#0d9488",
            "show_powered_by": False,
            "logo": {"data": PNG, "mimetype": "image/png", "name": "logo.png"},
        })
        values = self.Config.get_login_values()
        self.assertEqual(values["layout"], "corporate")
        self.assertEqual(values["brand_name"], "Acme")
        self.assertEqual(values["primary_color"], "#0d9488")
        self.assertFalse(values["show_powered_by"])
        self.assertTrue(values["logo_url"].startswith("/web/image/"))
        attachment = self.env["ir.attachment"].search([("res_model", "=", "cbt.theme.config")])
        self.assertEqual(len(attachment), 1)
        self.assertTrue(attachment.public)

        # replacing then removing the logo leaves no orphan attachment
        config.set_login_settings({"logo": {"data": PNG, "mimetype": "image/png", "name": "2.png"}})
        self.assertEqual(self.env["ir.attachment"].search_count([("res_model", "=", "cbt.theme.config")]), 1)
        config.set_login_settings({"logo": False})
        self.assertEqual(self.env["ir.attachment"].search_count([("res_model", "=", "cbt.theme.config")]), 0)
        self.assertFalse(self.Config.get_login_values()["logo_url"])

    def test_validation(self):
        config = self.Config.with_user(self.admin)
        for payload in (
            {"layout": "fancy"},
            {"primary_color": "javascript:alert(1)"},
            {"background_style": "video"},
            {"logo": {"data": PNG, "mimetype": "text/html", "name": "x"}},
            {"logo": {"data": "not base64!!", "mimetype": "image/png", "name": "x"}},
        ):
            with self.subTest(payload=payload), self.assertRaises(ValidationError):
                config.set_login_settings(payload)
        # text is truncated, not rejected
        config.set_login_settings({"brand_name": "x" * 500})
        self.assertEqual(len(self.Config.get_login_values()["brand_name"]), 80)

    def test_non_admin_cannot_configure(self):
        with self.assertRaises(AccessError):
            self.Config.with_user(self.employee).set_login_settings({"layout": "minimal"})
        with self.assertRaises(AccessError):
            self.Config.with_user(self.employee).get_login_settings()


@tagged("post_install", "-at_install")
class TestLoginPage(HttpCase):

    def test_login_page_renders_each_layout(self):
        icp = self.env["ir.config_parameter"].sudo()
        for layout in ("minimal", "corporate", "split", "illustration"):
            icp.set_str("dcs_backend_theme.login_layout", layout)
            icp.set_str("dcs_backend_theme.login_title", "Welcome <b>team</b>")
            response = self.url_open("/web/login")
            self.assertEqual(response.status_code, 200)
            self.assertIn(f"cbt-login--{layout}", response.text)
            # the login form itself is untouched
            self.assertIn('name="login"', response.text)
            self.assertIn('name="password"', response.text)
            # user-provided text is escaped
            self.assertNotIn("<b>team</b>", response.text)
