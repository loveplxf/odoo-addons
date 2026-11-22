import { Component, useProps } from "@odoo/owl";
import { _t } from "@web/core/l10n/translation";
import { registry } from "@web/core/registry";
import { standardFieldProps } from "@web/views/fields/standard_field_props";

const RADIUS = 13;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export class WorkorderProgressRings extends Component {
    static template = "cux_mrp_progress_bar.WorkorderProgressRings";

    props = useProps({ ...standardFieldProps });

    get rings() {
        let value = this.props.record.data[this.props.name];
        if (typeof value === "string") {
            try {
                value = JSON.parse(value);
            } catch {
                value = [];
            }
        }
        return Array.isArray(value) ? value : [];
    }

    progressOf(ring) {
        return Math.min(Math.max(Number(ring.progress) || 0, 0), 100);
    }

    isDone(ring) {
        return this.progressOf(ring) >= 100;
    }

    getRingClass(ring) {
        if (this.isDone(ring)) {
            return "o_cux_ring o_cux_ring_done";
        }
        return this.progressOf(ring) > 0 ? "o_cux_ring" : "o_cux_ring o_cux_ring_zero";
    }

    getLabel(ring) {
        return `${Math.round(this.progressOf(ring))}%`;
    }

    getArcStyle(ring) {
        const offset = CIRCUMFERENCE * (1 - this.progressOf(ring) / 100);
        return `stroke-dasharray: ${CIRCUMFERENCE}; stroke-dashoffset: ${offset};`;
    }

    getTitle(ring) {
        return `${ring.name || ""} ${this.getLabel(ring)}`.trim();
    }
}

export const workorderProgressRingsField = {
    component: WorkorderProgressRings,
    displayName: _t("Work Order Progress Rings"),
    supportedTypes: ["json"],
};

registry.category("fields").add("workorder_progress_rings", workorderProgressRingsField);
