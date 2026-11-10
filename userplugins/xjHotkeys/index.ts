/*
 * xImJxstinnCord – Tastenkürzel
 * Einstellbar unter: xImJxstinnCord Settings → Tastenkürzel
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { isPluginEnabled } from "@api/PluginManager";
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";

import { setStyle } from "../_xjShared";
import { applyPausedPlugins, applyVisibilityStyles, comboFromEvent, getActions, getBinds, hotkeyToast, migrateV4, recording, releasePausedPlugins } from "./actions";

const settings = definePluginSettings({
    binds: { type: OptionType.STRING, description: "Gespeicherte Kürzel", default: "", hidden: true },
    customPlugins: { type: OptionType.STRING, description: "Alte Liste (wird übernommen)", default: "", hidden: true },
    customHotkeys: { type: OptionType.STRING, description: "Eigene Kürzel", default: "", hidden: true },
    initialized: { type: OptionType.BOOLEAN, description: "Standard-Kürzel gesetzt", default: false, hidden: true },
    hideHiddenChannels: { type: OptionType.BOOLEAN, description: "(alt)", default: false, hidden: true },
    hideLoggedMessages: { type: OptionType.BOOLEAN, description: "(alt)", default: false, hidden: true },
    migratedV3: { type: OptionType.BOOLEAN, description: "Übernahme erledigt", default: false, hidden: true },
    showToasts: { type: OptionType.BOOLEAN, description: "Kurze Meldung anzeigen, wenn ein Kürzel benutzt wird", default: true },
    autoReload: { type: OptionType.BOOLEAN, description: "Discord automatisch neu laden, wenn ein Plugin einen Neustart braucht", default: false },
    paused: { type: OptionType.STRING, description: "Pausierte Plugins", default: "", hidden: true },
    migratedV4: { type: OptionType.BOOLEAN, description: "Übernahme erledigt", default: false, hidden: true }
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
    description: "Schalte Plugins per Tastenkürzel an und aus (z. B. ShowHiddenChannels mit Strg + Shift + H). Einstellbar unter „Tastenkürzel“ oder im Dialog jedes Plugins.",
    authors: [{ name: "xImJxstinn", id: 0n }],
    enabledByDefault: true,
    settings,
    start() {
        migrateV4();
        applyVisibilityStyles();
        // etwas warten, bis Discord und die anderen Plugins bereit sind
        setTimeout(applyPausedPlugins, 1500);
        window.addEventListener("keydown", onKey, true);
    },
    stop() {
        window.removeEventListener("keydown", onKey, true);
        releasePausedPlugins();
        setStyle("xj-hotkey-visibility", null);
    }
});
