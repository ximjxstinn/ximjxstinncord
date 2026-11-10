/*
 * xImJxstinnCord – Stream-Uhr
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

import { makeBadge, removeBadge } from "../_xjShared";

const settings = definePluginSettings({
    seconds: { type: OptionType.BOOLEAN, description: "Sekunden anzeigen", default: true },
    stopwatch: { type: OptionType.BOOLEAN, description: "Stoppuhr seit dem Discord-Start anzeigen", default: false },
    posX: { type: OptionType.NUMBER, description: "Position X", default: -1, hidden: true },
    posY: { type: OptionType.NUMBER, description: "Position Y", default: -1, hidden: true }
});

const ID = "xj-stream-clock";
let timer: ReturnType<typeof setInterval> | undefined;
const startedAt = Date.now();
const pad = (n: number) => String(n).padStart(2, "0");

export default definePlugin({
    name: "XJStreamClock",
    description: "Kleine verschiebbare Uhr in Discord – optional mit Stoppuhr für deinen Stream.",
    authors: [{ name: "xImJxstinn", id: 0n }],
    settings,
    start() {
        const el = makeBadge(ID, settings.store, { right: 20, bottom: 130 }, () => { });
        el.style.cursor = "grab";
        el.title = "Ziehen zum Verschieben";
        const tick = () => {
            const d = new Date();
            let txt = `🕒 ${pad(d.getHours())}:${pad(d.getMinutes())}${settings.store.seconds ? ":" + pad(d.getSeconds()) : ""}`;
            if (settings.store.stopwatch) {
                const s = Math.floor((Date.now() - startedAt) / 1000);
                txt += ` · ⏱ ${Math.floor(s / 3600)}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
            }
            el.textContent = txt;
        };
        tick();
        timer = setInterval(tick, 1000);
    },
    stop() {
        clearInterval(timer);
        removeBadge(ID);
    }
});
