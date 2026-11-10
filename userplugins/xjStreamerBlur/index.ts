/*
 * xImJxstinnCord – Streamer-Blur
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import { showToast } from "@webpack/common";
import definePlugin, { OptionType } from "@utils/types";

import { setStyle } from "../_xjShared";

const STYLE_ID = "xj-streamer-blur";

const settings = definePluginSettings({
    active: { type: OptionType.BOOLEAN, description: "Blur gerade aktiv (Umschalten: Strg + Shift + B)", default: true, onChange: () => apply() },
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

function onKey(e: KeyboardEvent) {
    if (e.ctrlKey && e.shiftKey && !e.altKey && typeof e.key === "string" && e.key.toLowerCase() === "b") {
        e.preventDefault();
        e.stopPropagation();
        settings.store.active = !settings.store.active;
        apply();
        showToast({ text: settings.store.active ? "🙈 Streamer-Blur an" : "👀 Streamer-Blur aus", variant: "primary" } as any);
    }
}

export default definePlugin({
    name: "XJStreamerBlur",
    description: "Verwischt Nachrichten, Bilder und DMs, bis du mit der Maus drüberfährst – ideal beim Streamen. Strg + Shift + B schaltet um.",
    authors: [{ name: "xImJxstinn", id: 0n }],
    settings,
    start() {
        running = true;
        apply();
        window.addEventListener("keydown", onKey, true);
    },
    stop() {
        running = false;
        apply();
        window.removeEventListener("keydown", onKey, true);
    }
});
