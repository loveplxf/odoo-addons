from odoo.tests import tagged
from odoo.tests.common import TransactionCase


@tagged("post_install", "-at_install")
class TestAssets(TransactionCase):
    """The theme must compile in every bundle it touches, in LTR and RTL."""

    def _css(self, bundle_name, rtl=False):
        bundle = self.env["ir.qweb"]._get_asset_bundle(bundle_name, rtl=rtl)
        content = "".join(a.raw.decode() for a in bundle.css())
        self.assertFalse(bundle.css_errors, f"{bundle_name}: {bundle.css_errors}")
        return content

    def test_light_and_dark_bundles(self):
        light = self._css("web.assets_web")
        dark = self._css("web.assets_web_dark")
        self.assertIn("--cbt-scheme: light", light)
        self.assertIn("--cbt-scheme: dark", dark)
        self.assertIn(".cbt-sidebar", light)
        # dark-only rules never leak into the light bundle
        self.assertNotIn("Flat app icons: keep monochrome", light)

    def test_rtl_bundle(self):
        css = self._css("web.assets_web", rtl=True)
        self.assertIn(".cbt-sidebar", css)

    def test_lazy_and_frontend_bundles(self):
        self._css("web.assets_backend_lazy")
        self._css("web.assets_backend_lazy_dark")
        frontend = self._css("web.assets_frontend")
        self.assertIn(".cbt-login", frontend)

    def test_backend_js_bundle(self):
        bundle = self.env["ir.qweb"]._get_asset_bundle("web.assets_web")
        js = "".join(a.raw.decode() for a in bundle.js())
        for module in (
            "@dcs_backend_theme/core/theme_service",
            "@dcs_backend_theme/core/navigation_service",
            "@dcs_backend_theme/components/sidebar/sidebar",
            "@dcs_backend_theme/patches/navbar_patch",
            "@dcs_backend_theme/patches/list_split_view",
            "@dcs_backend_theme/patches/chatter_position",
        ):
            self.assertIn(module, js)
