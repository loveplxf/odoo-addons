import odoo.tests
from odoo.addons.web.tests.test_js import unit_test_error_checker


@odoo.tests.tagged("post_install", "-at_install")
class TestThemeUi(odoo.tests.HttpCase):

    def test_theme_tour(self):
        """Sidebar, app drawer, global search, bookmarks and settings in the real web client."""
        self.start_tour("/odoo", "dcs_backend_theme_tour", login="admin", timeout=180)
        settings = self.env.ref("base.user_admin").res_users_settings_id
        settings.invalidate_recordset()
        labels = [b["label"] for b in settings.cbt_bookmarks or []]
        self.assertIn("Users", labels, "the bookmark created in the tour is stored server side")

    def test_unit_tests(self):
        """Hoot unit tests of this module (services and components)."""
        self.browser_js(
            "/web/tests?headless&loglevel=2&preset=desktop&timeout=15000&filter=dcs_backend_theme",
            "",
            "",
            login="admin",
            timeout=900,
            success_signal="[HOOT] Test suite succeeded",
            error_checker=unit_test_error_checker,
        )
