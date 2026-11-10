/*
 * xImJxstinnCord – xImJxstinn-Designer
 * Eigenes Farbschema: Presets, Akzentfarbe, Hintergrundbild, Schrift, Rundungen.
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

import { setStyle } from "../_xjShared";

const STYLE_ID = "xj-design";

const PRESETS: Record<string, { accent: string; lowest: string; lower: string; low: string; high: string; text: string; muted: string; }> = {
    twitch: { accent: "#9146ff", lowest: "#0a0a0c", lower: "#0e0e10", low: "#18181b", high: "#1f1f23", text: "#efeff1", muted: "#adadb8" },
    galaxy: { accent: "#b388ff", lowest: "#06061a", lower: "#0b0b24", low: "#121233", high: "#1b1b45", text: "#ebe8ff", muted: "#9d97c9" },
    minecraft: { accent: "#5dbb3a", lowest: "#0c0f0b", lower: "#121611", low: "#191e17", high: "#222920", text: "#e8f2e4", muted: "#9fb398" },
    rot: { accent: "#ff4655", lowest: "#0d0809", lower: "#130c0d", low: "#1a1112", high: "#241719", text: "#f5e9ea", muted: "#b89a9d" },
    ozean: { accent: "#2ec5ff", lowest: "#060c12", lower: "#0a131c", low: "#0f1b27", high: "#152534", text: "#e4f3fb", muted: "#8eaabb" }
};

const FONTS: Record<string, { css: string; url?: string; }> = {
    standard: { css: "" },
    poppins: { css: "'Poppins', sans-serif", url: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap" },
    pixel: { css: "'Pixelify Sans', sans-serif", url: "https://fonts.googleapis.com/css2?family=Pixelify+Sans:wght@400;500;600;700&display=swap" },
    nunito: { css: "'Nunito', sans-serif", url: "https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800&display=swap" }
};

const settings = definePluginSettings({
    preset: {
        type: OptionType.SELECT, description: "Farb-Preset", onChange: () => apply(),
        options: [
            { label: "Twitch Lila", value: "twitch", default: true },
            { label: "Galaxy", value: "galaxy" },
            { label: "Minecraft Grün", value: "minecraft" },
            { label: "Rot", value: "rot" },
            { label: "Ozean Blau", value: "ozean" }
        ]
    },
    accent: { type: OptionType.STRING, description: "Eigene Akzentfarbe als Hex, z. B. #ff0000 (leer = Preset-Farbe)", default: "", onChange: () => apply() },
    gradient: { type: OptionType.BOOLEAN, description: "Farbverlauf auf Buttons", default: true, onChange: () => apply() },
    background: { type: OptionType.STRING, description: "Hintergrundbild-Link (leer = kein Bild)", default: "", onChange: () => apply() },
    opacity: { type: OptionType.SLIDER, description: "Deckkraft der Flächen über dem Hintergrundbild (%)", markers: [30, 50, 70, 80, 90, 100], default: 80, stickToMarkers: false, onChange: () => apply() },
    blur: { type: OptionType.SLIDER, description: "Unschärfe des Hintergrundbilds (px)", markers: [0, 2, 4, 8, 12, 20], default: 4, stickToMarkers: false, onChange: () => apply() },
    font: {
        type: OptionType.SELECT, description: "Schriftart", onChange: () => apply(),
        options: [
            { label: "Discord Standard", value: "standard", default: true },
            { label: "Poppins", value: "poppins" },
            { label: "Pixelify Sans (Minecraft)", value: "pixel" },
            { label: "Nunito", value: "nunito" }
        ]
    },
    round: { type: OptionType.SLIDER, description: "Ecken-Rundung (px)", markers: [0, 4, 8, 12, 16, 20], default: 12, stickToMarkers: false, onChange: () => apply() },
    glow: { type: OptionType.BOOLEAN, description: "Leuchtende @-Erwähnungen", default: true, onChange: () => apply() }
});

let running = false;

const normHex = (x: string) => {
    let h = (x || "").trim().replace(/^#/, "");
    if (/^[0-9a-f]{3}$/i.test(h)) h = h.split("").map(c => c + c).join("");
    return /^[0-9a-f]{6}$/i.test(h) ? "#" + h.toLowerCase() : null;
};
const rgb = (x: string) => [0, 2, 4].map(i => parseInt(x.slice(1 + i, 3 + i), 16));
const rgba = (x: string, a: number) => { const [r, g, b] = rgb(x); return `rgba(${r}, ${g}, ${b}, ${a})`; };
const shade = (x: string, amt: number) => "#" + rgb(x).map(c => {
    const v = amt >= 0 ? c + (255 - c) * amt : c * (1 + amt);
    return Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
}).join("");

function buildCss() {
    const s = settings.store;
    const p = PRESETS[s.preset] ?? PRESETS.twitch;
    const A = normHex(s.accent) ?? p.accent;
    const light = shade(A, 0.25), hover = shade(A, -0.12);
    const bgUrl = (s.background || "").trim().replace(/["\\\n\r]/g, encodeURIComponent);
    const hasBg = bgUrl.length > 0;
    const bg = (x: string) => hasBg ? rgba(x, s.opacity / 100) : x;
    const font = FONTS[s.font] ?? FONTS.standard;
    const fill = s.gradient ? `linear-gradient(135deg, ${A}, ${light})` : A;

    return `
${font.url ? `@import url("${font.url}");` : ""}
:root, .theme-dark, .theme-light, .visual-refresh, .visual-refresh.theme-dark {
  --xj-accent: ${A};
  --brand-500: ${A} !important; --brand-560: ${hover} !important; --brand-600: ${shade(A, -0.22)} !important; --brand-360: ${light} !important;
  --brand-experiment: ${A} !important; --brand-experiment-560: ${hover} !important;
  --button-filled-brand-background: ${A} !important; --button-filled-brand-background-hover: ${hover} !important;
  --control-brand-foreground: ${A} !important; --text-link: ${light} !important;
  --background-base-lowest: ${bg(p.lowest)} !important; --background-base-lower: ${bg(p.lower)} !important; --background-base-low: ${bg(p.low)} !important;
  --background-surface-high: ${bg(p.high)} !important; --background-surface-higher: ${bg(shade(p.high, 0.04))} !important; --background-surface-highest: ${bg(shade(p.high, 0.08))} !important;
  --chat-background-default: ${bg(p.low)} !important; --bg-overlay-chat: ${bg(p.low)} !important;
  --background-primary: ${bg(p.low)} !important; --background-secondary: ${bg(p.lower)} !important; --background-tertiary: ${bg(p.lowest)} !important;
  --background-floating: ${p.high} !important; --channeltextarea-background: ${bg(p.high)} !important;
  --background-modifier-hover: ${rgba(A, 0.08)} !important; --background-modifier-selected: ${rgba(A, 0.18)} !important;
  --background-mentioned: ${rgba(A, 0.1)} !important; --background-mentioned-hover: ${rgba(A, 0.15)} !important;
  --text-default: ${p.text} !important; --text-normal: ${p.text} !important; --header-primary: ${p.text} !important;
  --text-muted: ${p.muted} !important; --header-secondary: ${p.muted} !important; --channels-default: ${p.muted} !important;
  --interactive-normal: ${p.muted} !important; --interactive-hover: ${p.text} !important;
  --scrollbar-thin-thumb: ${rgba(A, 0.5)} !important; --scrollbar-auto-thumb: ${rgba(A, 0.5)} !important;
}
${font.css ? `:root, body { --font-primary: ${font.css} !important; --font-display: ${font.css} !important; --font-headline: ${font.css} !important; }` : ""}
${hasBg ? `
#app-mount::before { content: ""; position: fixed; inset: -${s.blur * 2}px; background: url("${bgUrl}") center / cover no-repeat; filter: blur(${s.blur}px); z-index: -1; pointer-events: none; }
#app-mount [class*="bg_"] { background: transparent !important; }` : ""}
::selection { background: ${rgba(A, 0.45)}; }
button[class*="colorBrand"] { background: ${fill} !important; border: none !important; }
[class*="channelTextArea"] [class*="scrollableContainer"] { border-radius: ${s.round}px !important; }
[class*="menu_"], [class*="userPopoutOuter"], [class*="embedFull"] { border-radius: ${s.round}px !important; }
${s.glow ? `[class*="mentioned_"] { box-shadow: inset 3px 0 0 ${A}, 0 0 14px ${rgba(A, 0.18)} !important; }` : ""}`;
}

function apply() {
    setStyle(STYLE_ID, running ? buildCss() : null);
}

export default definePlugin({
    name: "XJDesign",
    description: "xImJxstinn-Designer: eigenes Farbschema mit Presets (Twitch, Galaxy, Minecraft …), Akzentfarbe, Hintergrundbild, Schriftart und Rundungen.",
    authors: [{ name: "xImJxstinn", id: 0n }],
    settings,
    start() { running = true; apply(); },
    stop() { running = false; apply(); }
});
