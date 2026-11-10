/*
 * xImJxstinnCord – Menü-Design
 * Modernes Aussehen für die xImJxstinnCord-Einstellungen: leuchtende Plugin-Karten,
 * runde Ecken, Farbverläufe in deiner Akzentfarbe, schönere Suche und Tabs.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

import { setStyle } from "../_xjShared";

const STYLE_ID = "xj-style";

const settings = definePluginSettings({
    accent: {
        type: OptionType.STRING,
        description: "Akzentfarbe fürs Menü als Hex, z. B. #9146ff (leer = Farbe aus XJDesign bzw. Discord)",
        default: "",
        onChange: () => apply()
    },
    glow: { type: OptionType.BOOLEAN, description: "Leuchteffekt bei aktiven Plugins", default: true, onChange: () => apply() },
    animations: { type: OptionType.BOOLEAN, description: "Animationen beim Drüberfahren", default: true, onChange: () => apply() }
});

let running = false;

function css() {
    const custom = /^#?[0-9a-f]{6}$/i.test(settings.store.accent.trim()) ? "#" + settings.store.accent.trim().replace(/^#/, "") : null;
    const A = custom ?? "var(--xj-accent, var(--brand-500, #9146ff))";
    const anim = settings.store.animations;
    return `
:root { --xjs-accent: ${A}; --xjs-radius: 14px; }

/* ---------- Plugin- und Theme-Karten ---------- */
.vc-plugins-grid, .vc-settings-theme-grid { gap: 12px !important; }
.vc-addon-card {
    position: relative;
    border-radius: var(--xjs-radius) !important;
    padding: 14px 14px 12px !important;
    background:
        linear-gradient(160deg, color-mix(in srgb, var(--xjs-accent) 7%, transparent), transparent 55%),
        var(--card-background-default, var(--background-base-lower)) !important;
    border: 1px solid color-mix(in srgb, var(--xjs-accent) 14%, var(--border-subtle, transparent)) !important;
    overflow: hidden;
    ${anim ? "transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease, opacity .18s ease !important;" : ""}
}
.vc-addon-card:not(.vc-addon-card-disabled) {
    border-color: color-mix(in srgb, var(--xjs-accent) 55%, transparent) !important;
    ${settings.store.glow ? "box-shadow: 0 0 0 1px color-mix(in srgb, var(--xjs-accent) 18%, transparent), 0 6px 22px -10px color-mix(in srgb, var(--xjs-accent) 70%, transparent);" : ""}
}
.vc-addon-card:not(.vc-addon-card-disabled)::before {
    content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 3px;
    background: linear-gradient(180deg, var(--xjs-accent), color-mix(in srgb, var(--xjs-accent) 40%, #fff));
}
.vc-addon-card-disabled { opacity: .72 !important; }
.vc-addon-card:hover {
    ${anim ? "transform: translateY(-3px) !important;" : ""}
    border-color: var(--xjs-accent) !important;
    box-shadow: 0 10px 30px -12px color-mix(in srgb, var(--xjs-accent) 80%, transparent) !important;
    opacity: 1 !important;
}
.vc-addon-title { font-weight: 700 !important; letter-spacing: .01em; }
.vc-addon-note { opacity: .85; line-height: 1.35; }
.vc-addon-author { opacity: .65; }
.vc-addon-badge {
    border-radius: 99px !important; font-weight: 800 !important; letter-spacing: .03em;
    background: linear-gradient(135deg, var(--xjs-accent), color-mix(in srgb, var(--xjs-accent) 55%, #ff4fd8)) !important;
    color: #fff !important;
}

/* ---------- Suche und Filter ---------- */
.vc-plugins-filter-controls input, .vc-plugins-filter-controls [class*="inputDefault"],
.vc-plugins-filter-controls [class*="input_"] {
    border-radius: 12px !important;
    transition: box-shadow .15s, border-color .15s;
}
.vc-plugins-filter-controls input:focus, .vc-plugins-filter-controls [class*="input_"]:focus-within {
    border-color: var(--xjs-accent) !important;
    box-shadow: 0 0 0 3px color-mix(in srgb, var(--xjs-accent) 25%, transparent) !important;
}

/* ---------- Info-Karten (Hinweise oben) ---------- */
.vc-plugins-info-card, .vc-settings-donate, .vc-special-card-special {
    border-radius: var(--xjs-radius) !important;
    border: 1px solid color-mix(in srgb, var(--xjs-accent) 30%, transparent) !important;
    background: linear-gradient(135deg, color-mix(in srgb, var(--xjs-accent) 16%, transparent), color-mix(in srgb, var(--xjs-accent) 4%, transparent)) !important;
}

/* ---------- Schnellaktionen ---------- */
.vc-settings-quickActions-card { border-radius: var(--xjs-radius) !important; gap: 8px !important; }
.vc-settings-quickActions-pill {
    border-radius: 12px !important;
    border: 1px solid color-mix(in srgb, var(--xjs-accent) 25%, transparent) !important;
    ${anim ? "transition: transform .15s, background .15s, border-color .15s !important;" : ""}
}
.vc-settings-quickActions-pill:hover {
    background: color-mix(in srgb, var(--xjs-accent) 22%, transparent) !important;
    border-color: var(--xjs-accent) !important;
    ${anim ? "transform: translateY(-2px);" : ""}
}

/* ---------- Tabs (z. B. Lokale/Online-Themes) ---------- */
.vc-settings-tab-bar { gap: 6px !important; border-bottom: none !important; margin-bottom: 14px !important; }
.vc-settings-tab-bar-item {
    border-radius: 99px !important; padding: 6px 14px !important;
    background: color-mix(in srgb, var(--xjs-accent) 8%, transparent) !important;
    border: 1px solid transparent !important;
}
.vc-settings-tab-bar-item[aria-selected="true"], .vc-settings-tab-bar-item[class*="selected"] {
    background: var(--xjs-accent) !important; color: #fff !important;
    box-shadow: 0 4px 14px -6px var(--xjs-accent);
}

/* ---------- Theme-Links-Feld und Plugin-Fenster ---------- */
.vc-settings-theme-links { border-radius: 12px !important; }
.vc-settings-theme-links:focus { border-color: var(--xjs-accent) !important; }
.vc-plugin-modal-header { gap: 10px; }
.vc-plugin-modal-tag {
    border-radius: 99px !important;
    background: color-mix(in srgb, var(--xjs-accent) 20%, transparent) !important;
}
.vc-plugins-restart-button {
    background: linear-gradient(135deg, var(--xjs-accent), color-mix(in srgb, var(--xjs-accent) 55%, #ff4fd8)) !important;
    border-radius: 10px !important;
}
`;
}

function apply() {
    setStyle(STYLE_ID, running ? css() : null);
}

export default definePlugin({
    name: "XJStyle",
    description: "Modernes Design für das xImJxstinnCord-Menü: leuchtende Plugin-Karten, runde Ecken und Farbverläufe in deiner Akzentfarbe.",
    authors: [{ name: "xImJxstinn", id: 0n }],
    enabledByDefault: true,
    settings,
    start() { running = true; apply(); },
    stop() { running = false; apply(); }
});
