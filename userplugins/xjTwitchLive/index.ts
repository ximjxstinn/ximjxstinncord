/*
 * xImJxstinnCord – Twitch-Live-Anzeige
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType, PluginNative } from "@utils/types";

import { makeBadge, removeBadge } from "../_xjShared";

const Native = VencordNative.pluginHelpers.XJTwitchLive as PluginNative<typeof import("./native")>;

const settings = definePluginSettings({
    channel: { type: OptionType.STRING, description: "Dein Twitch-Name (ohne Link)", default: "", onChange: () => restart() },
    showViewers: { type: OptionType.BOOLEAN, description: "Zuschauerzahl anzeigen", default: true, onChange: () => restart() },
    interval: {
        type: OptionType.SLIDER, description: "Aktualisieren alle … Sekunden", markers: [30, 60, 120, 180, 300],
        default: 60, stickToMarkers: true, onChange: () => restart()
    },
    posX: { type: OptionType.NUMBER, description: "Position X (wird beim Ziehen gesetzt, -1 = Standard)", default: -1, hidden: true },
    posY: { type: OptionType.NUMBER, description: "Position Y", default: -1, hidden: true }
});

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;
const BADGE_ID = "xj-twitch-badge";

function cleanChannel() {
    return String(settings.store.channel || "").trim().replace(/^.*twitch\.tv\//i, "").replace(/[^A-Za-z0-9_]/g, "");
}

function shortUptime(u: string) {
    const h = Number(/(\d+)\s*hour/.exec(u)?.[1] ?? 0);
    const m = Number(/(\d+)\s*minute/.exec(u)?.[1] ?? 0);
    return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

function startBadge() {
    const ch = cleanChannel();
    if (!ch) return;
    const badge = makeBadge(BADGE_ID, settings.store, { right: 20, bottom: 90 }, () => Native.openChannel(ch));
    badge.title = "Klicken: Twitch öffnen · Ziehen: verschieben";
    const dot = document.createElement("span");
    dot.className = "xj-dot";
    const txt = document.createElement("span");
    txt.textContent = `${ch} …`;
    badge.append(dot, txt);

    const update = async () => {
        const r: any = await Native.getStatus(ch).catch(e => ({ error: String(e) }));
        badge.classList.toggle("xj-live", !!r.live);
        if (r.error) txt.textContent = `${ch} · Fehler`;
        else if (r.live) txt.textContent = `LIVE · ${shortUptime(r.uptime)}${settings.store.showViewers && r.viewers != null ? ` · ${r.viewers} 👀` : ""}`;
        else txt.textContent = `${ch} · offline`;
    };
    update();
    timer = setInterval(update, Math.max(30, settings.store.interval) * 1000);
}

function stopBadge() {
    clearInterval(timer);
    timer = undefined;
    removeBadge(BADGE_ID);
}

function restart() {
    if (!running) return;
    stopBadge();
    startBadge();
}

export default definePlugin({
    name: "XJTwitchLive",
    description: "Zeigt in Discord, ob du auf Twitch live bist – mit Laufzeit und Zuschauern. Klick öffnet den Kanal, ziehen verschiebt das Abzeichen.",
    authors: [{ name: "xImJxstinn", id: 0n }],
    settings,
    start() { running = true; startBadge(); },
    stop() { running = false; stopBadge(); }
});
