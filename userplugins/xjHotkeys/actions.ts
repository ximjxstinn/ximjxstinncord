/*
 * xImJxstinnCord – Tastenkürzel: Aktionen, Speicher und Ausführung
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import {
    isPluginEnabled, pluginRequiresRestart, plugins,
    startDependenciesRecursive, startPlugin, stopPlugin
} from "@api/PluginManager";
import { Settings } from "@api/Settings";
import { insertTextIntoChatInputBox } from "@utils/discord";
import { NavigationRouter } from "@webpack/common";

import { setStyle } from "../_xjShared";
import { toggleStreamerBlur } from "../xjStreamerBlur";

export interface HotkeyAction {
    id: string;
    label: string;
    description: string;
    /** Plugin, das aktiv sein muss (optional) */
    plugin?: string;
    /** Standard-Kürzel beim ersten Start */
    defaultCombo?: string;
    /** Aktion schaltet das Plugin selbst an/aus (dann muss es nicht aktiv sein) */
    togglesPlugin?: boolean;
    /** Eigenes Kürzel (bearbeitbar/löschbar) */
    custom?: CustomHotkey;
    run(): string | void; // Rückgabe = Meldung
}

export type CustomType = "plugin" | "setting" | "text" | "link" | "channel" | "css";

export interface CustomHotkey {
    id: string;
    type: CustomType;
    label: string;
    plugin?: string;
    setting?: string;
    text?: string;
    url?: string;
    css?: string;
    on?: boolean;
}

export const CUSTOM_TYPES: { type: CustomType; label: string; hint: string; }[] = [
    { type: "plugin", label: "Plugin an/aus", hint: "Schaltet ein beliebiges Plugin ein oder aus" },
    { type: "setting", label: "Plugin-Einstellung umschalten", hint: "Schaltet eine Ja/Nein-Einstellung eines Plugins um" },
    { type: "text", label: "Text in den Chat einfügen", hint: "Fügt deinen Text ins Eingabefeld ein, z. B. deinen Twitch-Link" },
    { type: "link", label: "Link öffnen", hint: "Öffnet eine Webseite im Browser" },
    { type: "channel", label: "Kanal öffnen", hint: "Springt direkt zu einem Discord-Kanal (Rechtsklick auf Kanal → Link kopieren)" },
    { type: "css", label: "CSS-Schnipsel an/aus", hint: "Schaltet eigenes CSS per Taste ein oder aus" }
];

// ---------------------------------------------------------------------------
// Meldung unten in Discord
// ---------------------------------------------------------------------------
export function hotkeyToast(text: string) {
    const t = document.createElement("div");
    t.textContent = text;
    Object.assign(t.style, {
        position: "fixed", left: "50%", bottom: "30px", zIndex: "10001", transform: "translate(-50%, 16px)", opacity: "0",
        padding: "11px 18px", borderRadius: "14px", font: "600 14px var(--font-primary, sans-serif)", color: "#fff",
        background: "#15151d", border: "1px solid var(--xj-accent, #9146ff)", boxShadow: "0 12px 30px rgba(0,0,0,.5)",
        transition: ".25s", pointerEvents: "none"
    });
    document.body.append(t);
    requestAnimationFrame(() => { t.style.opacity = "1"; t.style.transform = "translate(-50%, 0)"; });
    setTimeout(() => { t.style.opacity = "0"; setTimeout(() => t.remove(), 300); }, 1800);
}

const store = () => Settings.plugins.XJHotkeys as any;

// ---------------------------------------------------------------------------
// Automatisch neu laden (für Plugins, die einen Neustart brauchen)
// ---------------------------------------------------------------------------
export const autoReloadEnabled = () => store()?.autoReload !== false;

let reloadTimer: ReturnType<typeof setTimeout> | undefined;
export function scheduleReload(reason?: string) {
    hotkeyToast((reason ? reason + " – " : "") + "Discord lädt neu …");
    clearTimeout(reloadTimer);
    // kurz warten, damit die Einstellung sicher gespeichert ist und mehrere Klicks zusammengefasst werden
    reloadTimer = setTimeout(() => location.reload(), 1200);
}

// ---------------------------------------------------------------------------
// Plugin an/aus
// ---------------------------------------------------------------------------
export function canToggleLive(name: string) {
    const p = plugins[name];
    return !!p && !p.required && !pluginRequiresRestart(p);
}

/** Schaltet ein Plugin um – live, oder mit automatischem Neu-Laden, wenn es nicht anders geht. */
export function togglePlugin(name: string): string {
    const p = plugins[name];
    if (!p) return `${name} gibt es nicht`;
    if (p.required) return `${name} kann nicht ausgeschaltet werden`;
    const st = Settings.plugins[name];
    const on = isPluginEnabled(name);

    if (!canToggleLive(name)) {
        st.enabled = !on;
        if (autoReloadEnabled()) { scheduleReload(`${name} ${on ? "aus" : "an"}`); return ""; }
        return `${name} ${on ? "aus" : "an"} – wirkt nach dem Neu-Laden (Strg + R)`;
    }
    if (!on) {
        const { restartNeeded, failures } = startDependenciesRecursive(p);
        if (failures.length) return `${name}: Abhängigkeiten konnten nicht starten`;
        if (restartNeeded) {
            st.enabled = true;
            if (autoReloadEnabled()) { scheduleReload(`${name} an`); return ""; }
            return `${name} an – wirkt nach dem Neu-Laden`;
        }
    }
    const ok = on ? stopPlugin(p) : startPlugin(p);
    if (!ok) return `Fehler bei ${name}`;
    st.enabled = !on;
    return `${name} ${on ? "aus" : "an"}`;
}

// ---------------------------------------------------------------------------
// Zustände der Ein-/Ausblenden-Aktionen (bleiben über Neustarts erhalten)
// ---------------------------------------------------------------------------
export function applyVisibilityStyles() {
    const s = store();
    const css: string[] = [];
    if (s?.hideHiddenChannels)
        css.push(`li:has(.vc-shc-hidden-channel-icon), [class*="containerDefault"]:has(.vc-shc-hidden-channel-icon) { display: none !important; }`);
    if (s?.hideLoggedMessages)
        css.push(`.messagelogger-deleted, .messagelogger-edited, .messagelogger-edit-marker { display: none !important; }`);
    for (const c of getCustomHotkeys()) if (c.type === "css" && c.on && c.css) css.push(c.css);
    setStyle("xj-hotkey-visibility", css.join("\n") || null);
}

function flip(key: string) {
    const s = store();
    s[key] = !s[key];
    applyVisibilityStyles();
    return !s[key];
}

const settingFlip = (plugin: string, key: string) => {
    const st = Settings.plugins[plugin] as any;
    st[key] = !st[key];
    return !!st[key];
};

// ---------------------------------------------------------------------------
// Eingebaute Aktionen
// ---------------------------------------------------------------------------
export const BUILTIN_ACTIONS: HotkeyAction[] = [
    {
        id: "shc", plugin: "ShowHiddenChannels", defaultCombo: "ctrl+shift+h",
        label: "Versteckte Kanäle ein-/ausblenden",
        description: "Blendet die Kanäle mit Schloss sofort aus oder wieder ein – ohne Neu-Laden",
        run: () => flip("hideHiddenChannels") ? "🔒 Versteckte Kanäle sichtbar" : "🙈 Versteckte Kanäle ausgeblendet"
    },
    {
        id: "shc-plugin", plugin: "ShowHiddenChannels", togglesPlugin: true,
        label: "ShowHiddenChannels komplett an/aus",
        description: "Schaltet das ganze Plugin um – Discord lädt dafür kurz neu",
        run: () => togglePlugin("ShowHiddenChannels")
    },
    {
        id: "ml", plugin: "MessageLogger", defaultCombo: "ctrl+shift+l",
        label: "Gelöschte Nachrichten ein-/ausblenden",
        description: "Zeigt oder versteckt gelöschte und bearbeitete Nachrichten vom MessageLogger",
        run: () => flip("hideLoggedMessages") ? "🗑 Gelöschte Nachrichten sichtbar" : "🙈 Gelöschte Nachrichten ausgeblendet"
    },
    {
        id: "blur", plugin: "XJStreamerBlur", defaultCombo: "ctrl+shift+b",
        label: "Streamer-Blur umschalten",
        description: "Verwischt Chats und DMs – oder hebt es wieder auf",
        run: () => toggleStreamerBlur() ? "🙈 Streamer-Blur an" : "👀 Streamer-Blur aus"
    },
    {
        id: "silent", plugin: "SilentTyping",
        label: "Unsichtbar tippen umschalten",
        description: "Andere sehen nicht, dass du tippst (SilentTyping)",
        run: () => settingFlip("SilentTyping", "isEnabled") ? "🤫 Unsichtbar tippen an" : "⌨️ Unsichtbar tippen aus"
    },
    {
        id: "translate", plugin: "Translate",
        label: "Automatisch übersetzen umschalten",
        description: "Deine Nachrichten werden vor dem Senden übersetzt (Translate)",
        run: () => settingFlip("Translate", "autoTranslate") ? "🌍 Auto-Übersetzen an" : "🌍 Auto-Übersetzen aus"
    },
    {
        id: "design", plugin: "XJDesign", togglesPlugin: true,
        label: "Designer an/aus",
        description: "Schaltet dein xImJxstinn-Farbschema ein oder aus",
        run: () => togglePlugin("XJDesign")
    },
    {
        id: "twitch", plugin: "XJTwitchLive", togglesPlugin: true,
        label: "Twitch-Anzeige an/aus",
        description: "Blendet das LIVE-Abzeichen ein oder aus",
        run: () => togglePlugin("XJTwitchLive")
    },
    {
        id: "clock", plugin: "XJStreamClock", togglesPlugin: true,
        label: "Stream-Uhr an/aus",
        description: "Blendet die Uhr ein oder aus",
        run: () => togglePlugin("XJStreamClock")
    },
    {
        id: "quickcss",
        label: "Eigenes CSS an/aus",
        description: "Schaltet dein QuickCSS ein oder aus",
        run: () => { Settings.useQuickCss = !Settings.useQuickCss; return Settings.useQuickCss ? "🎨 Eigenes CSS an" : "🎨 Eigenes CSS aus"; }
    },
    {
        id: "reload",
        label: "Discord neu laden",
        description: "Lädt Discord neu (wie Strg + R)",
        run: () => { location.reload(); }
    }
];

// ---------------------------------------------------------------------------
// Eigene Kürzel
// ---------------------------------------------------------------------------
function readJson<T>(key: string, fallback: T): T {
    try { return JSON.parse(store()?.[key] || "") ?? fallback; } catch { return fallback; }
}

export function getCustomHotkeys(): CustomHotkey[] {
    const s = store();
    // Übernahme der alten „Plugin an/aus“-Liste
    if (s?.customPlugins) {
        const old = readJson<string[]>("customPlugins", []);
        const list = readJson<CustomHotkey[]>("customHotkeys", []);
        for (const name of old) {
            const id = "toggle:" + name;
            if (!list.some(c => c.id === id)) list.push({ id, type: "plugin", label: `${name} an/aus`, plugin: name });
        }
        s.customHotkeys = JSON.stringify(list);
        s.customPlugins = "";
    }
    return readJson<CustomHotkey[]>("customHotkeys", []);
}

export function saveCustomHotkey(c: CustomHotkey) {
    const list = getCustomHotkeys();
    const i = list.findIndex(x => x.id === c.id);
    if (i >= 0) list[i] = c; else list.push(c);
    store().customHotkeys = JSON.stringify(list);
    applyVisibilityStyles();
}

export function deleteCustomHotkey(id: string) {
    store().customHotkeys = JSON.stringify(getCustomHotkeys().filter(c => c.id !== id));
    setBind(id, null);
    applyVisibilityStyles();
}

export const newCustomId = () => "c" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function channelPath(url?: string) {
    const m = /channels\/(@me|\d+)(?:\/(\d+))?(?:\/(\d+))?/.exec(url || "");
    return m ? "/channels/" + [m[1], m[2], m[3]].filter(Boolean).join("/") : null;
}

function customToAction(c: CustomHotkey): HotkeyAction {
    const fallback = c.type === "plugin" && c.plugin ? `${c.plugin} an/aus`
        : c.type === "setting" && c.plugin ? `${c.plugin}: ${c.setting} umschalten`
            : CUSTOM_TYPES.find(t => t.type === c.type)?.label || "Eigenes Kürzel";
    const base = { id: c.id, label: c.label?.trim() || fallback, custom: c };
    switch (c.type) {
        case "plugin":
            return { ...base, plugin: c.plugin, togglesPlugin: true, description: `Schaltet ${c.plugin} ein oder aus`, run: () => togglePlugin(c.plugin!) };
        case "setting":
            return {
                ...base, plugin: c.plugin, description: `Schaltet „${c.setting}“ von ${c.plugin} um`,
                run: () => `${c.plugin}: ${c.setting} ${settingFlip(c.plugin!, c.setting!) ? "an" : "aus"}`
            };
        case "text":
            return {
                ...base, description: "Fügt ein: " + (c.text ?? "").slice(0, 60),
                run: () => { insertTextIntoChatInputBox(c.text ?? ""); return "✏️ Text eingefügt"; }
            };
        case "link":
            return {
                ...base, description: "Öffnet " + (c.url ?? ""),
                run: () => {
                    if (!/^https?:\/\//i.test(c.url ?? "")) return "Ungültiger Link";
                    VencordNative.native.openExternal(c.url!);
                    return "🔗 Link geöffnet";
                }
            };
        case "channel":
            return {
                ...base, description: "Springt zu " + (channelPath(c.url) ?? "?"),
                run: () => {
                    const path = channelPath(c.url);
                    if (!path) return "Ungültiger Kanal-Link";
                    NavigationRouter.transitionTo(path);
                    return "";
                }
            };
        case "css":
        default:
            return {
                ...base, description: "Eigenes CSS-Schnipsel" + (c.on ? " (gerade an)" : ""),
                run: () => { c.on = !c.on; saveCustomHotkey(c); return c.on ? "🎨 CSS-Schnipsel an" : "🎨 CSS-Schnipsel aus"; }
            };
    }
}

/** Alle Aktionen inkl. eigener Kürzel */
export function getActions(): HotkeyAction[] {
    return [...BUILTIN_ACTIONS, ...getCustomHotkeys().map(customToAction)];
}

// ---------------------------------------------------------------------------
// Speicher der Kürzel
// ---------------------------------------------------------------------------
export function getBinds(): Record<string, string> {
    const s = store();
    if (s && !s.initialized) {
        const defaults: Record<string, string> = {};
        for (const a of BUILTIN_ACTIONS) if (a.defaultCombo) defaults[a.id] = a.defaultCombo;
        s.binds = JSON.stringify(defaults);
        s.initialized = true;
    }
    return readJson<Record<string, string>>("binds", {});
}

export function setBind(id: string, combo: string | null) {
    const binds = getBinds();
    if (combo) {
        // dasselbe Kürzel darf nur einmal vergeben sein
        for (const [k, v] of Object.entries(binds)) if (v === combo) delete binds[k];
        binds[id] = combo;
    } else delete binds[id];
    store().binds = JSON.stringify(binds);
}

// ---------------------------------------------------------------------------
// Tastenkombinationen
// ---------------------------------------------------------------------------
export function comboFromEvent(e: KeyboardEvent): string | null {
    if (typeof e.key !== "string") return null;
    if (["Control", "Shift", "Alt", "Meta", "AltGraph"].includes(e.key)) return null;
    let key = e.code?.startsWith("Key") ? e.code.slice(3).toLowerCase()
        : e.code?.startsWith("Digit") ? e.code.slice(5)
            : e.key.toLowerCase();
    if (key === " ") key = "space";
    const parts: string[] = [];
    if (e.ctrlKey) parts.push("ctrl");
    if (e.altKey) parts.push("alt");
    if (e.shiftKey) parts.push("shift");
    parts.push(key);
    return parts.join("+");
}

export function formatCombo(combo?: string | null) {
    if (!combo) return "—";
    const names: Record<string, string> = { ctrl: "Strg", alt: "Alt", shift: "Shift", space: "Leertaste", arrowup: "↑", arrowdown: "↓", arrowleft: "←", arrowright: "→", escape: "Esc" };
    return combo.split("+").map(p => names[p] ?? (p.length === 1 ? p.toUpperCase() : p.replace(/^f(\d+)$/, "F$1").replace(/^./, c => c.toUpperCase()))).join(" + ");
}

/** Während ein Kürzel aufgenommen wird, sollen keine Aktionen auslösen */
export const recording = { active: false };
