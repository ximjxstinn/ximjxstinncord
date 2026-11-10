/*
 * xImJxstinnCord – Streamer-Blur
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

import { setStyle } from "../_xjShared";

const STYLE_ID = "xj-streamer-blur";

const settings = definePluginSettings({
    active: { type: OptionType.BOOLEAN, description: "Blur gerade aktiv (Kürzel einstellbar unter „Tastenkürzel“)", default: true, onChange: () => apply() },
    strength: {
        type: OptionType.SLIDER, description: "Stärke (px)", markers: [2, 4, 7, 10, 15, 20],
        default: 7, stickToMarkers: false, onChange: () => apply()
    },
    dms: { type: OptionType.BOOLEAN, description: "Auch die DM-Liste verwischen", default: true, onChange: () => apply() }
});

let running = false;

function apply() {
    if (!running || !settings.store.active) { setStyle(STYLE_ID, null); return; }
    const { strength, dms } = settings.store;
    setStyle(STYLE_ID, `
[class*="messageContent"], [class*="embedWrapper"], [class*="imageWrapper"], [class*="attachment"]${dms ? `,
[class*="privateChannels"] [class*="name_"], [class*="privateChannels"] [class*="avatar"]` : ""} { filter: blur(${strength}px); transition: filter .2s; }
[class*="message_"]:hover [class*="messageContent"], [class*="message_"]:hover [class*="embedWrapper"],
[class*="message_"]:hover [class*="imageWrapper"], [class*="message_"]:hover [class*="attachment"],
[class*="privateChannels"] li:hover [class*="name_"], [class*="privateChannels"] li:hover [class*="avatar"] { filter: none; }`);
}

/** Für das Tastenkürzel (XJHotkeys): schaltet den Blur um und gibt den neuen Zustand zurück */
export function toggleStreamerBlur() {
    settings.store.active = !settings.store.active;
    apply();
    return settings.store.active;
}

export default definePlugin({
    name: "XJStreamerBlur",
    description: "Verwischt Nachrichten, Bilder und DMs, bis du mit der Maus drüberfährst – ideal beim Streamen. Umschalten per Tastenkürzel (Standard: Strg + Shift + B).",
    authors: [{ name: "xImJxstinn", id: 0n }],
    settings,
    start() {
        running = true;
        apply();
    },
    stop() {
        running = false;
        apply();
    }
});
