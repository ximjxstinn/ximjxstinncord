/*
 * xImJxstinnCord – Twitch-Live-Anzeige (Hauptprozess)
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { IpcMainInvokeEvent, net, shell } from "electron";

const VALID = /^[A-Za-z0-9_]{1,30}$/;

async function get(url: string) {
    const res = await net.fetch(url, { headers: { "User-Agent": "xImJxstinnCord" } });
    return (await res.text()).trim();
}

// Status über decapi.me – ohne Login oder API-Key
export async function getStatus(_: IpcMainInvokeEvent, channel: string) {
    if (!VALID.test(channel)) return { error: "Ungültiger Kanalname" };
    try {
        const [uptime, viewers] = await Promise.all([
            get(`https://decapi.me/twitch/uptime/${channel}`),
            get(`https://decapi.me/twitch/viewercount/${channel}`)
        ]);
        const offline = /offline/i.test(uptime);
        return {
            live: !offline,
            uptime: offline ? "" : uptime,
            viewers: /^\d+$/.test(viewers) ? Number(viewers) : null
        };
    } catch (e) {
        return { error: String(e) };
    }
}

export function openChannel(_: IpcMainInvokeEvent, channel: string) {
    if (VALID.test(channel)) shell.openExternal(`https://www.twitch.tv/${channel.toLowerCase()}`);
}
