/*
 * xImJxstinnCord – Tastenkürzel
 * Einstellbar unter: xImJxstinnCord Settings → Tastenkürzel
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

import { setStyle } from "../_xjShared";
import { applyVisibilityStyles, comboFromEvent, getActions, getBinds, hotkeyToast, recording } from "./actions";

const settings = definePluginSettings({
    binds: { type: OptionType.STRING, description: "Gespeicherte Kürzel", default: "", hidden: true },
    customPlugins: { type: OptionType.STRING, description: "Alte Liste (wird übernommen)", default: "", hidden: true },
    customHotkeys: { type: OptionType.STRING, description: "Eigene Kürzel", default: "", hidden: true },
    initialized: { type: OptionType.BOOLEAN, description: "Standard-Kürzel gesetzt", default: false, hidden: true },
    hideHiddenChannels: { type: OptionType.BOOLEAN, description: "Versteckte Kanäle ausgeblendet", default: false, hidden: true },
    hideLoggedMessages: { type: OptionType.BOOLEAN, description: "Gelöschte Nachrichten ausgeblendet", default: false, hidden: true },
    showToasts: { type: OptionType.BOOLEAN, description: "Kurze Meldung anzeigen, wenn ein Kürzel benutzt wird", default: true },
    autoReload: { type: OptionType.BOOLEAN, description: "Discord automatisch neu laden, wenn ein Plugin einen Neustart braucht", default: true }
});

function isTyping(e: KeyboardEvent) {
    const t = e.target as HTMLElement | null;
    return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}

function onKey(e: KeyboardEvent) {
    if (recording.active) return;
    const combo = comboFromEvent(e);
    if (!combo) return;
    // Beim Schreiben nur Kürzel mit Strg oder Alt auslösen
    if (isTyping(e) && !e.ctrlKey && !e.altKey) return;

    const binds = getBinds();
    const id = Object.keys(binds).find(k => binds[k] === combo);
    if (!id) return;
    const action = getActions().find(a => a.id === id);
    if (!action) return;

    e.preventDefault();
    e.stopPropagation();
    if (action.plugin && !action.togglesPlugin && !isPluginEnabled(action.plugin)) {
        hotkeyToast(`Plugin ${action.plugin} ist aus – schalte es zuerst ein`);
        return;
    }
    try {
        const msg = action.run();
        if (msg && settings.store.showToasts) hotkeyToast(msg);
    } catch (err) {
        console.error("[xImJxstinnCord] Tastenkürzel-Fehler", err);
        hotkeyToast("Fehler bei: " + action.label);
    }
}

export default definePlugin({
    name: "XJHotkeys",
    description: "Tastenkürzel für Plugins, z. B. versteckte Kanäle oder gelöschte Nachrichten ein- und ausblenden. Einstellbar unter „Tastenkürzel“.",
    authors: [{ name: "xImJxstinn", id: 0n }],
    enabledByDefault: true,
    settings,
    start() {
        applyVisibilityStyles();
        window.addEventListener("keydown", onKey, true);
    },
    stop() {
        window.removeEventListener("keydown", onKey, true);
        setStyle("xj-hotkey-visibility", null);
    }
});
