import { useSubEnv } from "@web/owl2/utils";
import { patch } from "@web/core/utils/patch";
import { WebClient } from "@web/webclient/webclient";

/**
 * Marks the environment of the real web client. The theme's main components
 * (sidebar, overlays) only render under it, so components mounted on their
 * own (dialogs in other apps, embedded views, unit tests) are unaffected.
 */
patch(WebClient.prototype, {
    setup() {
        super.setup(...arguments);
        useSubEnv({ cbtInWebClient: true });
    },
});
