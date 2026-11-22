import { onMounted, onWillUnmount, signal } from "@odoo/owl";
import { getFirstAndLastTabableElements } from "@web/core/ui/ui_utils";

/**
 * Accessibility plumbing shared by the theme overlays:
 * - focuses the element with [data-autofocus] (or the first tabbable)
 * - keeps Tab inside the panel while it is open (it is modal)
 * - closes on Escape
 * - restores focus to the opener when the panel goes away
 */
/**
 * @param {string} _refName kept for API symmetry; OWL 3 refs are signals
 *   (`t-ref="this.rootRef"` in the template).
 */
export function usePanel(_refName, onClose) {
    const ref = signal.ref();
    let opener = null;

    function onKeydown(ev) {
        if (ev.key === "Escape") {
            ev.preventDefault();
            ev.stopPropagation();
            onClose();
            return;
        }
        if (ev.key !== "Tab" || !ref()) {
            return;
        }
        const [first, last] = getFirstAndLastTabableElements(ref());
        if (!first) {
            return;
        }
        if (ev.shiftKey && document.activeElement === first) {
            ev.preventDefault();
            last.focus();
        } else if (!ev.shiftKey && document.activeElement === last) {
            ev.preventDefault();
            first.focus();
        }
    }

    onMounted(() => {
        opener = document.activeElement;
        const el = ref();
        if (!el) {
            return;
        }
        el.addEventListener("keydown", onKeydown);
        const target = el.querySelector("[data-autofocus]") || getFirstAndLastTabableElements(el)[0];
        target?.focus();
    });
    onWillUnmount(() => {
        ref()?.removeEventListener("keydown", onKeydown);
        if (opener && document.contains(opener) && typeof opener.focus === "function") {
            opener.focus();
        }
    });
    return ref;
}
