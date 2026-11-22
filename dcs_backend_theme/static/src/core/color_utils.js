/** Small color helpers (no dependency). */

export function isHexColor(value) {
    return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function channel(c) {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance([r, g, b]) {
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(rgbA, rgbB) {
    const a = relativeLuminance(rgbA);
    const b = relativeLuminance(rgbB);
    const [hi, lo] = a > b ? [a, b] : [b, a];
    return (hi + 0.05) / (lo + 0.05);
}

/**
 * Text color to put on top of `hex`: white unless contrast is too low
 * (e.g. yellow or very light custom colors), then a near-black ink.
 */
export function onColor(hex) {
    const rgb = hexToRgb(hex);
    return contrastRatio(rgb, [255, 255, 255]) >= 3 ? "#ffffff" : "#10131a";
}
